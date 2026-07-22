import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useTheme } from './ThemeProvider'
import cidadesPE from '../data/pe-cidades.json'

// ============================================================================
// Mapa Estratégico de Pernambuco — MapLibre GL (vetorial)
// ----------------------------------------------------------------------------
// Trocamos o Leaflet + tiles raster por MapLibre GL com o basemap VETORIAL da
// CARTO (positron no claro, dark-matter no escuro). Vantagens que o usuário pediu:
//  - Ruas aparecem nitidamente ao dar zoom (dado vetorial, não imagem borrada).
//  - Nome de cada município numa camada de símbolos própria, com anti-sobreposição
//    nativa: no overview aparecem os maiores; conforme aproxima, cada município.
//  - Heatmap e coloração por área (choropleth) usando as camadas nativas do GL.
// Os estilos da CARTO não exigem API key.
// ============================================================================

const STYLE_URL = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}

// Fonte de glyphs presente nos estilos da CARTO (usada nos rótulos de município).
const FONT = ['Open Sans Bold']

function corCalor(intensidade: number) {
  const h = Math.round(45 - intensidade * 45)
  const l = Math.round(58 - intensidade * 14)
  return `hsl(${h}, 95%, ${l}%)`
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface CidadeCoord { nome: string; lat: number; lng: number }
const COORD_POR_CIDADE = new Map<string, CidadeCoord>(
  (cidadesPE as CidadeCoord[]).map((c) => [normalizar(c.nome), c]),
)

// Bounds de PE em ordem MapLibre: [ [oeste, sul], [leste, norte] ] (lng, lat).
function calcularBounds(geo: any): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  const walk = (c: any) => {
    if (typeof c[0] === 'number') {
      const [lng, lat] = c
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    } else c.forEach(walk)
  }
  for (const f of geo.features) walk(f.geometry.coordinates)
  return [[minLng, minLat], [maxLng, maxLat]]
}

interface MapaEstrategicoProps {
  pontosGeo: { id?: string; cidade: string | null; local_votacao: string | null; lat: number | null; lng: number | null; count?: number }[]
  statsPorCidade: { label: string; total: number }[]
  cidadeSelecionada: string | null
  onCidadeSelect: (cidade: string | null) => void
  modoVisualizacao: 'calor' | 'mapa'
  height?: string
  className?: string
}

export function MapaEstrategico({ pontosGeo, statsPorCidade, cidadeSelecionada, onCidadeSelect, modoVisualizacao, height = '400px', className }: MapaEstrategicoProps) {
  const { theme } = useTheme()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const prontoRef = useRef(false)

  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  const [mapaAtivo, setMapaAtivo] = useState(!isMobile)

  // Props mais recentes para os handlers/helpers imperativos do MapLibre
  // (que rodam fora do ciclo de render e não enxergam o valor via closure).
  const onSelectRef = useRef(onCidadeSelect)
  const modoRef = useRef(modoVisualizacao)
  const selRef = useRef(cidadeSelecionada)
  useEffect(() => { onSelectRef.current = onCidadeSelect }, [onCidadeSelect])
  useEffect(() => { modoRef.current = modoVisualizacao }, [modoVisualizacao])
  useEffect(() => { selRef.current = cidadeSelecionada }, [cidadeSelecionada])

  // ---- Carrega o contorno dos municípios ----
  useEffect(() => {
    fetch('/pe-municipios.geojson')
      .then((r) => r.json())
      .then((geo) => {
        setGeoData(geo)
        setBounds(calcularBounds(geo))
      })
      .catch(() => {})
  }, [])

  const countPorCidadeNorm = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of statsPorCidade) {
      if (!s.label) continue
      const k = normalizar(s.label)
      m.set(k, (m.get(k) || 0) + s.total)
    }
    return m
  }, [statsPorCidade])

  const maxChoropleth = Math.max(1, ...countPorCidadeNorm.values())

  // ---- Agrega os eleitores por LOCAL DE VOTAÇÃO (mesma lógica de antes) ----
  const locaisVotacao = useMemo(() => {
    const jaAgregado = pontosGeo.length > 0 && pontosGeo[0].count != null
    const m = new Map<string, { local: string; cidade: string; count: number; latSum: number; lngSum: number }>()
    for (const p of pontosGeo) {
      if (p.lat == null || p.lng == null) continue
      const chave = `${(p.local_votacao || 'Desconhecido').toLowerCase().trim()}|${(p.cidade || '').toLowerCase().trim()}`
      const c = jaAgregado ? (p.count ?? 1) : 1
      const ex = m.get(chave)
      if (ex) {
        ex.count += c
        ex.latSum += p.lat * c
        ex.lngSum += p.lng * c
      } else {
        m.set(chave, { local: p.local_votacao || 'Desconhecido', cidade: p.cidade || '', count: c, latSum: p.lat * c, lngSum: p.lng * c })
      }
    }
    return [...m.values()].map((l) => ({ local: l.local, cidade: l.cidade, lat: l.latSum / l.count, lng: l.lngSum / l.count, count: l.count }))
  }, [pontosGeo])

  const maxLocalCount = Math.max(1, ...locaisVotacao.map((l) => l.count))
  const maxCount = maxChoropleth

  // ---- GeoJSON dos municípios com count/intensidade/label injetados ----
  const munisFC = useMemo(() => {
    if (!geoData) return null
    return {
      type: 'FeatureCollection',
      features: geoData.features.map((f: any) => {
        const c = countPorCidadeNorm.get(normalizar(f.properties.nome)) || 0
        return { ...f, properties: { ...f.properties, count: c, intensidade: c / maxChoropleth } }
      }),
    }
  }, [geoData, countPorCidadeNorm, maxChoropleth])

  // ---- GeoJSON de pontos (locais de votação) para heatmap + marcadores ----
  const pontosFC = useMemo(() => ({
    type: 'FeatureCollection',
    features: locaisVotacao.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: { local: l.local, cidade: l.cidade, count: l.count, peso: Math.min(1, l.count / maxLocalCount) },
    })),
  }), [locaisVotacao, maxLocalCount])

  // (Re)cria todas as fontes e camadas custom no estilo atual do mapa.
  function montarCamadas() {
    const map = mapRef.current
    if (!map || !munisFC || !bounds) return
    const dark = theme === 'dark'

    // --- Fontes ---
    if (!map.getSource('munis')) map.addSource('munis', { type: 'geojson', data: munisFC as any })
    else (map.getSource('munis') as maplibregl.GeoJSONSource).setData(munisFC as any)

    if (!map.getSource('pontos')) map.addSource('pontos', { type: 'geojson', data: pontosFC as any })
    else (map.getSource('pontos') as maplibregl.GeoJSONSource).setData(pontosFC as any)

    const modoMapa = modoVisualizacao === 'mapa'

    // --- Preenchimento (choropleth) ---
    if (!map.getLayer('munis-fill')) {
      map.addLayer({
        id: 'munis-fill',
        type: 'fill',
        source: 'munis',
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'intensidade'],
            0, dark ? '#1e293b' : '#e2e8f0',
            0.01, corCalor(0.05),
            0.5, corCalor(0.5),
            1, corCalor(1),
          ],
          'fill-opacity': modoMapa
            ? ['case', ['>', ['get', 'count'], 0], 0.82, 0.28]
            : 0.06,
        },
      })
    }

    // --- Bordas dos municípios ---
    if (!map.getLayer('munis-line')) {
      map.addLayer({
        id: 'munis-line',
        type: 'line',
        source: 'munis',
        paint: { 'line-color': dark ? '#475569' : '#94a3b8', 'line-width': 0.7 },
      })
    }

    // --- Realce do município selecionado ---
    if (!map.getLayer('munis-sel')) {
      map.addLayer({
        id: 'munis-sel',
        type: 'line',
        source: 'munis',
        paint: { 'line-color': dark ? '#ffffff' : '#0f172a', 'line-width': 2.5 },
        filter: ['==', ['get', 'nome'], '___nenhum___'],
      })
    }

    // --- Rótulo do nome de CADA município (anti-sobreposição nativa) ---
    if (!map.getLayer('munis-label')) {
      map.addLayer({
        id: 'munis-label',
        type: 'symbol',
        source: 'munis',
        layout: {
          'text-field': ['get', 'nome'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 9, 12, 13, 15],
          // Municípios com mais eleitores têm prioridade quando falta espaço.
          'symbol-sort-key': ['-', 0, ['get', 'count']],
          'text-padding': 6,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': dark ? '#f1f5f9' : '#1e293b',
          'text-halo-color': dark ? '#0f172a' : '#ffffff',
          'text-halo-width': 1.4,
        },
      })
    }

    // --- Heatmap (modo Calor) ---
    if (!map.getLayer('calor-heat')) {
      map.addLayer({
        id: 'calor-heat',
        type: 'heatmap',
        source: 'pontos',
        maxzoom: 14,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, maxLocalCount, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 14, 2.2],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(30,58,138,0)', 0.2, '#1e3a8a', 0.4, '#06b6d4', 0.55, '#22c55e', 0.72, '#facc15', 0.86, '#f97316', 1, '#dc2626',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 16, 14, 32],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 14, 0.45],
        },
      })
    }

    // --- Marcadores numerados por local (aparecem ao aproximar) ---
    if (!map.getLayer('pontos-circulo')) {
      map.addLayer({
        id: 'pontos-circulo',
        type: 'circle',
        source: 'pontos',
        minzoom: 9,
        paint: {
          // Math.max(2, ...): quando todo local tem 1 eleitor, maxLocalCount = 1 e os
          // dois inputs do interpolate ficariam iguais (o MapLibre exige crescente).
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 9, Math.max(2, maxLocalCount), 20],
          'circle-color': '#4f46e5',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })
    }
    if (!map.getLayer('pontos-num')) {
      map.addLayer({
        id: 'pontos-num',
        type: 'symbol',
        source: 'pontos',
        minzoom: 9,
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-font': FONT,
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      })
    }

    aplicarModo()
    aplicarSelecao()
  }

  // Alterna visibilidade/opacidade conforme Calor x Áreas.
  function aplicarModo() {
    const map = mapRef.current
    if (!map || !map.getLayer('munis-fill')) return
    const modoMapa = modoRef.current === 'mapa'
    map.setPaintProperty('munis-fill', 'fill-opacity', modoMapa
      ? ['case', ['>', ['get', 'count'], 0], 0.82, 0.28]
      : 0.06)
    const vis = modoMapa ? 'none' : 'visible'
    for (const id of ['calor-heat', 'pontos-circulo', 'pontos-num']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }

  function aplicarSelecao() {
    const map = mapRef.current
    if (!map || !map.getLayer('munis-sel')) return
    map.setFilter('munis-sel', ['==', ['get', 'nome'], selRef.current ?? '___nenhum___'])
  }

  // ---- Inicializa o mapa (uma vez, quando o GeoJSON estiver pronto) ----
  useEffect(() => {
    if (!containerRef.current || !bounds || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL[theme === 'dark' ? 'dark' : 'light'],
      bounds,
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
      dragPan: !isMobile,
      scrollZoom: !isMobile,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      prontoRef.current = true
      montarCamadas()
    })
    // Reaplica as camadas custom sempre que o estilo troca (tema claro/escuro).
    map.on('style.load', () => {
      if (prontoRef.current) montarCamadas()
    })

    // Clique num município → seleciona/deseleciona.
    map.on('click', 'munis-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const nome = e.features?.[0]?.properties?.nome as string | undefined
      if (nome) onSelectRef.current(selRef.current === nome ? null : nome)
    })
    map.on('mouseenter', 'munis-fill', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'munis-fill', () => { map.getCanvas().style.cursor = '' })

    // Popup ao clicar num local de votação.
    map.on('click', 'pontos-circulo', (e: maplibregl.MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties as any
      if (!p) return
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: false })
        .setLngLat((e.features![0].geometry as any).coordinates)
        .setHTML(
          `<div style="font-family:inherit;padding:2px 4px;min-width:150px">
             <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${p.cidade || ''}</div>
             <div style="font-size:13px;font-weight:700;color:#1e293b;margin:2px 0 6px">${p.local || ''}</div>
             <div style="display:inline-flex;align-items:center;gap:6px;background:#eef2ff;color:#4338ca;font-weight:800;font-size:12px;padding:3px 8px;border-radius:8px">${p.count} eleitores</div>
           </div>`,
        )
        .addTo(map)
    })
    map.on('mouseenter', 'pontos-circulo', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'pontos-circulo', () => { map.getCanvas().style.cursor = '' })

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      prontoRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  // ---- Troca o estilo ao mudar o tema ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !prontoRef.current) return
    map.setStyle(STYLE_URL[theme === 'dark' ? 'dark' : 'light'])
  }, [theme])

  // ---- Atualiza dados das fontes quando os props mudam ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !prontoRef.current || !munisFC) return
    ;(map.getSource('munis') as maplibregl.GeoJSONSource | undefined)?.setData(munisFC as any)
    ;(map.getSource('pontos') as maplibregl.GeoJSONSource | undefined)?.setData(pontosFC as any)
  }, [munisFC, pontosFC])

  // ---- Reaplica o modo (Calor/Áreas) ----
  useEffect(() => { aplicarModo() /* eslint-disable-next-line */ }, [modoVisualizacao])

  // ---- Voa para a cidade selecionada (ou volta pro estado) ----
  const primeiraSel = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !prontoRef.current) return
    aplicarSelecao()
    if (cidadeSelecionada) {
      const c = COORD_POR_CIDADE.get(normalizar(cidadeSelecionada))
      if (c) map.flyTo({ center: [c.lng, c.lat], zoom: isMobile ? 10 : 11, duration: 1200 })
    } else if (!primeiraSel.current && bounds) {
      map.fitBounds(bounds, { padding: 20, duration: 1200 })
    }
    primeiraSel.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidadeSelecionada])

  // ---- Recalcula o tamanho ao entrar/sair de tela cheia ----
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = setTimeout(() => map.resize(), 220)
    return () => clearTimeout(t)
  }, [telaCheia])

  // ---- Liga/desliga o arraste no mobile (evita scroll trap) ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMobile) return
    if (mapaAtivo) { map.dragPan.enable(); map.scrollZoom.enable() }
    else { map.dragPan.disable(); map.scrollZoom.disable() }
  }, [mapaAtivo])

  return (
    <div className={telaCheia ? 'fixed inset-0 z-[2000] bg-white dark:bg-slate-950' : `relative w-full sm:rounded-2xl overflow-hidden border-y sm:border-x sm:border-y border-slate-200 dark:border-slate-800 shadow-sm ${className || ''}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" style={telaCheia || className ? undefined : { height }} />

      {/* Overlay de interação mobile (resolve scroll trap) */}
      {isMobile && !mapaAtivo && (
        <div
          className="absolute inset-0 z-[1200] flex flex-col items-center justify-center bg-slate-900/30 backdrop-blur-[2px] transition-opacity cursor-pointer"
          onClick={() => setMapaAtivo(true)}
          onTouchStart={() => setMapaAtivo(true)}
        >
          <div className="rounded-3xl bg-white/95 dark:bg-slate-800/95 px-6 py-5 shadow-2xl flex flex-col items-center gap-3 animate-slide-up mx-6 text-center">
            <div className="bg-brand-100 dark:bg-brand-900/50 p-3 rounded-full"><span className="text-2xl block animate-bounce">👆</span></div>
            <div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">Toque para explorar o mapa</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Evitamos deixar ativo direto para não travar a rolagem da sua tela.</p>
            </div>
          </div>
        </div>
      )}
      {isMobile && mapaAtivo && (
        <button
          onClick={() => setMapaAtivo(false)}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-white shadow-xl backdrop-blur transition active:scale-95 border border-white/10"
        >
          <span>🔒</span> Travar mapa para rolar a tela
        </button>
      )}

      <button
        onClick={() => setTelaCheia((v) => !v)}
        className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white active:scale-95 dark:border-slate-700/70 dark:bg-slate-900/85 dark:text-slate-200"
      >
        {telaCheia ? '✕ Sair' : '⛶ Tela cheia'}
      </button>
      {cidadeSelecionada && (
        <button
          onClick={() => onCidadeSelect(null)}
          className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-600/95 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-brand-700 active:scale-95"
        >
          ← Pernambuco · saindo de {cidadeSelecionada}
        </button>
      )}

      {/* Legenda flutuante */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/85">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Concentração</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400">{modoVisualizacao === 'calor' ? 'menos' : '0'}</span>
          <div
            className="h-2.5 w-28 rounded-full"
            style={{
              background: modoVisualizacao === 'calor'
                ? 'linear-gradient(to right, #1e3a8a, #06b6d4, #22c55e, #facc15, #f97316, #dc2626)'
                : 'linear-gradient(to right, hsl(45,95%,58%), hsl(22,95%,51%), hsl(0,95%,44%))',
            }}
          />
          <span className="text-[10px] font-semibold text-slate-400">{modoVisualizacao === 'calor' ? 'mais' : maxCount}</span>
        </div>
      </div>
    </div>
  )
}
