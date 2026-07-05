import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { feature as topoFeature } from 'topojson-client'
import { useTheme } from './ThemeProvider'
import cidadesPE from '../data/pe-cidades.json'

// ============================================================================
// Mapa Estratégico de Pernambuco (Leaflet)
// - Basemap CARTO Voyager (invertido no dark via CSS: .dark .leaflet-tile-pane)
// - Modo "calor": heatmap dos cadastros + marcadores das cidades líderes
// - Modo "mapa": choropleth (municípios coloridos pela quantidade)
// - Clique no município seleciona/aproxima; tela cheia; legenda
// ============================================================================

// Basemap CARTO Voyager (dados do OpenStreetMap). No dark, o CSS inverte a
// camada de tiles para o visual escuro, mantendo os rótulos de ruas e bairros.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

// ---------- utilitários ----------

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Dispersão determinística (~metros) para cadastros sem lat/lng não empilharem
function jitter(seed: string, escala = 0.05) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * escala
}

// Cor do choropleth: amarelo (poucos) → vermelho (muitos)
function corCalor(intensidade: number) {
  const h = Math.round(45 - intensidade * 45)
  const l = Math.round(58 - intensidade * 14)
  return `hsl(${h}, 95%, ${l}%)`
}

interface CidadeCoord { nome: string; lat: number; lng: number }
const COORD_POR_CIDADE = new Map<string, CidadeCoord>(
  (cidadesPE as CidadeCoord[]).map((c) => [normalizar(c.nome), c])
)

// Bounding box do estado a partir do GeoJSON decodificado
function calcularBounds(geo: any): LatLngBoundsExpression {
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
  return [[minLat, minLng], [maxLat, maxLng]]
}

// ---------- subcomponentes de mapa ----------

// Recalcula o tamanho quando o container muda (ex.: tela cheia)
function AjustarTamanho({ dep }: { dep: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

// Camada de calor (leaflet.heat)
function CamadaCalor({ pontos }: { pontos: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    const layer = (L as any).heatLayer(pontos, {
      radius: isMobile ? 20 : 30,
      blur: isMobile ? 16 : 24,
      minOpacity: 0.35,
      maxZoom: 12,
      gradient: {
        0.0: '#1e3a8a',
        0.3: '#06b6d4',
        0.5: '#22c55e',
        0.7: '#facc15',
        0.85: '#f97316',
        1.0: '#dc2626',
      },
    })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, pontos])
  return null
}

// Abre o mapa já enquadrado e aproximado em PE, e impede afastar além disso
// (evita mostrar o Nordeste inteiro).
function ZoomInicialPE({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [6, 6] })
    const z = map.getZoom()
    map.setMinZoom(z)                                 // não deixa afastar além de PE
    map.setZoom(Math.min(z + 0.6, map.getMaxZoom()))  // foca um pouco mais no estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// Aproxima na cidade selecionada; volta ao estado quando deseleciona
function VooParaCidade({ centro, boundsPE }: { centro: [number, number] | null; boundsPE: LatLngBoundsExpression }) {
  const map = useMap()
  const primeiro = useRef(true)
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return }
    if (centro) map.flyTo(centro, isMobile ? 9 : 10, { duration: 1.1 })
    else map.flyToBounds(boundsPE, { duration: 1.1 })
  }, [centro, boundsPE, map])
  return null
}

// Helper to watch active map zoom
function ZoomWatcher({ onChange }: { onChange: (z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const cb = () => onChange(map.getZoom())
    map.on('zoomend', cb)
    map.on('zoom', cb)
    // Initial call
    cb()
    return () => {
      map.off('zoomend', cb)
      map.off('zoom', cb)
    }
  }, [map, onChange])
  return null
}

// ---------- componente principal ----------

interface MapaEstrategicoProps {
  pontosGeo: { id: string; cidade: string | null; lat: number | null; lng: number | null }[]
  statsPorCidade: { label: string; total: number }[]
  cidadeSelecionada: string | null
  onCidadeSelect: (cidade: string | null) => void
  modoVisualizacao: 'calor' | 'mapa'
  height?: string
  className?: string
}

export function MapaEstrategico({
  pontosGeo,
  statsPorCidade,
  cidadeSelecionada,
  onCidadeSelect,
  modoVisualizacao,
  height = '400px',
  className,
}: MapaEstrategicoProps) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [zoomAtual, setZoomAtual] = useState(7)

  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)

  // Carrega o contorno dos municípios (TopoJSON → GeoJSON, ~60% menor)
  useEffect(() => {
    let vivo = true
    fetch('/pe-municipios.topojson')
      .then((r) => r.json())
      .then((topo) => {
        if (!vivo) return
        const geo = topoFeature(topo, topo.objects.municipios) as any
        setGeoData(geo)
        setBounds(calcularBounds(geo))
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  // Quantidade de eleitores por cidade (chave normalizada)
  const countPorCidade = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of statsPorCidade) {
      if (!s.label) continue
      const k = normalizar(s.label)
      m.set(k, (m.get(k) || 0) + s.total)
    }
    return m
  }, [statsPorCidade])

  const maxCidade = Math.max(1, ...countPorCidade.values())

  // Pontos do heatmap (lat/lng real; senão, centro da cidade com dispersão)
  const pontosCalor = useMemo(() => {
    const arr: [number, number, number][] = []
    for (const e of pontosGeo) {
      if (e.lat != null && e.lng != null) {
        arr.push([e.lat, e.lng, 0.9])
      } else if (e.cidade) {
        const c = COORD_POR_CIDADE.get(normalizar(e.cidade))
        if (c) arr.push([c.lat + jitter(e.id + 'a'), c.lng + jitter(e.id + 'b'), 0.7])
      }
    }
    return arr
  }, [pontosGeo])

  // Cidades com voto (para os marcadores/rótulos e a coroa da líder)
  const cidadesComVoto = useMemo(() => {
    const pts: { cidade: string; count: number; lat: number; lng: number }[] = []
    for (const [norm, count] of countPorCidade) {
      const c = COORD_POR_CIDADE.get(norm)
      if (c) pts.push({ cidade: c.nome, count, lat: c.lat, lng: c.lng })
    }
    return pts.sort((a, b) => b.count - a.count)
  }, [countPorCidade])

  const topCidades = cidadesComVoto.slice(0, 5)
  const cidadeLider = cidadesComVoto[0]?.cidade ?? null

  // Estilo de cada município — reaplicado imperativamente (sem remontar a camada)
  const estiloFeature = useCallback((feature: any) => {
    const norm = normalizar(feature.properties.nome)
    const sel = !!cidadeSelecionada && normalizar(cidadeSelecionada) === norm
    const c = countPorCidade.get(norm) || 0
    const isZoomed = zoomAtual >= 9.5

    if (modoVisualizacao === 'mapa') {
      return {
        color: sel ? (dark ? '#ffffff' : '#0f172a') : (isZoomed ? 'transparent' : '#ffffff'),
        weight: sel ? 3 : 0.6,
        fillColor: sel
          ? (dark ? '#ffffff' : '#0f172a')
          : (c > 0 ? corCalor(c / maxCidade) : dark ? '#1e293b' : '#e2e8f0'),
        fillOpacity: isZoomed ? 0 : (sel ? 0.12 : (c > 0 ? 0.85 : 0.35)),
      }
    }
    // modo calor: municípios quase transparentes só para dar contorno/clique
    return {
      color: sel ? (dark ? '#ffffff' : '#0f172a') : (isZoomed ? 'transparent' : (dark ? '#64748b' : '#94a3b8')),
      weight: sel ? 3 : 0.7,
      fillColor: sel ? (dark ? '#ffffff' : '#0f172a') : '#000000',
      fillOpacity: isZoomed ? 0 : (sel ? 0.12 : 0.02),
    }
  }, [cidadeSelecionada, countPorCidade, maxCidade, modoVisualizacao, dark, zoomAtual])

  // Handlers do Leaflet montam 1x → usamos um ref com o estado mais recente
  const geoRef = useRef<any>(null)
  const estadoRef = useRef({ cidadeSelecionada, onCidadeSelect, estiloFeature })
  estadoRef.current = { cidadeSelecionada, onCidadeSelect, estiloFeature }

  // Reaplica estilo + tooltip quando dados/seleção mudam (sem recriar polígonos)
  useEffect(() => {
    const layer = geoRef.current
    if (!layer) return
    layer.setStyle(estiloFeature)
    layer.eachLayer((l: any) => {
      const nome = l.feature?.properties?.nome
      if (!nome) return
      const c = countPorCidade.get(normalizar(nome)) || 0
      l.setTooltipContent(`<strong>${nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`)
    })
  }, [estiloFeature, countPorCidade, zoomAtual])

  const centroSelecionado = useMemo<[number, number] | null>(() => {
    if (!cidadeSelecionada) return null
    const c = COORD_POR_CIDADE.get(normalizar(cidadeSelecionada))
    return c ? [c.lat, c.lng] : null
  }, [cidadeSelecionada])

  if (!geoData || !bounds) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 ${className || ''}`}
        style={{ height: className ? undefined : height }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div
      className={
        telaCheia
          ? 'fixed inset-0 z-[2000] bg-white dark:bg-slate-950'
          : `relative w-full overflow-hidden border-y border-slate-200 shadow-sm sm:rounded-2xl sm:border-x dark:border-slate-800 ${className || ''}`
      }
    >
      {/* Tela cheia */}
      <button
        onClick={() => setTelaCheia((v) => !v)}
        className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white active:scale-95 dark:border-slate-700/70 dark:bg-slate-900/85 dark:text-slate-200"
      >
        {telaCheia ? '✕ Sair' : '⛶ Tela cheia'}
      </button>

      {/* Voltar da cidade selecionada */}
      {cidadeSelecionada && (
        <button
          onClick={() => onCidadeSelect(null)}
          className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-600/95 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-brand-700 active:scale-95"
        >
          ← Pernambuco · saindo de {cidadeSelecionada}
        </button>
      )}

      <MapContainer
        bounds={bounds}
        maxBounds={bounds}
        maxBoundsViscosity={0.9}
        minZoom={6}
        zoomSnap={0.25}
        zoomControl={false}
        scrollWheelZoom={!isMobile}
        style={{
          height: telaCheia ? '100vh' : (className ? '100%' : height),
          minHeight: className ? undefined : height,
          width: '100%',
          background: dark ? '#0f172a' : '#eef2f6',
        }}
      >
        <ZoomWatcher onChange={setZoomAtual} />
        <AjustarTamanho dep={telaCheia} />
        <ZoomInicialPE bounds={bounds} />
        <VooParaCidade centro={centroSelecionado} boundsPE={bounds} />

        <TileLayer url={TILE_URL} attribution={TILE_ATTR} subdomains="abcd" maxZoom={20} detectRetina crossOrigin="anonymous" />

        <GeoJSON
          key={`${modoVisualizacao}-${theme}`}
          ref={geoRef}
          data={geoData}
          style={estiloFeature}
          onEachFeature={(feature: any, layer: any) => {
            const nome = feature.properties.nome
            const c = countPorCidade.get(normalizar(nome)) || 0
            layer.bindTooltip(
              `<strong>${nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`,
              { sticky: true, className: 'mapa-tooltip', direction: 'top', opacity: 1 }
            )
            layer.on({
              mouseover: (e: any) => {
                if (estadoRef.current.cidadeSelecionada === nome) return
                e.target.setStyle({ weight: 2.4, color: dark ? '#ffffff' : '#0f172a' })
                e.target.bringToFront()
              },
              mouseout: (e: any) => e.target.setStyle(estadoRef.current.estiloFeature(feature)),
              click: () =>
                estadoRef.current.onCidadeSelect(
                  estadoRef.current.cidadeSelecionada === nome ? null : nome
                ),
            })
          }}
        />

        {/* Modo calor: heatmap + marcadores das cidades líderes */}
        {modoVisualizacao === 'calor' && (
          <>
            <CamadaCalor pontos={pontosCalor} />
            {topCidades.map((p) => {
              const ehLider = p.cidade === cidadeLider
              return (
                <CircleMarker
                  key={p.cidade}
                  center={[p.lat, p.lng]}
                  radius={ehLider ? 5 : 3}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: ehLider ? '#dc2626' : '#0f172a', fillOpacity: 1 }}
                  eventHandlers={{ click: () => onCidadeSelect(cidadeSelecionada === p.cidade ? null : p.cidade) }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]} className="!border-0 !bg-transparent !text-xs !font-bold !text-slate-800 !shadow-none dark:!text-white">
                    {ehLider ? '👑 ' : ''}{p.cidade} · {p.count}
                  </Tooltip>
                </CircleMarker>
              )
            })}
          </>
        )}
      </MapContainer>

      {/* Legenda */}
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
          <span className="text-[10px] font-semibold text-slate-400">{modoVisualizacao === 'calor' ? 'mais' : maxCidade}</span>
        </div>
      </div>
    </div>
  )
}
