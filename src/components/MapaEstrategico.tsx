import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  GeoJSON,
  useMap,
  ZoomControl,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { useTheme } from './ThemeProvider'
import cidadesPE from '../data/pe-cidades.json'

const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    boundary: '#94a3b8',
    fill: '#1e293b',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    boundary: '#475569',
    fill: '#cbd5e1',
  },
}

function corCalor(intensidade: number) {
  const h = Math.round(45 - intensidade * 45)
  const l = Math.round(58 - intensidade * 14)
  return `hsl(${h}, 95%, ${l}%)`
}

function InvalidarTamanho({ dep }: { dep: boolean }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

function CamadaCalor({ pontos }: { pontos: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    
    // Raio e blur otimizados e fixos. Recriar a camada a cada zoom causava os travamentos (lag spikes).
    const baseR = isMobile ? 18 : 22
    const baseB = isMobile ? 15 : 20
    
    const layer = (L as any).heatLayer(pontos, {
      radius: baseR,
      blur: baseB,
      minOpacity: 0.35,
      maxZoom: 13,
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
    return () => {
      map.removeLayer(layer)
    }
  }, [map, pontos])
  return null
}

function ZoomNaCidade({
  cidade,
  centro,
  boundsPE,
}: {
  cidade: string | null
  centro: [number, number] | null
  boundsPE: LatLngBoundsExpression
}) {
  const map = useMap()
  const anterior = useRef<string | null>(null)
  useEffect(() => {
    if (cidade && centro) {
      map.flyTo(centro, isMobile ? 9 : 10, { duration: 1.2 })
    } else if (!cidade && anterior.current) {
      map.flyToBounds(boundsPE, { duration: 1.2 })
    }
    anterior.current = cidade
  }, [cidade, centro, boundsPE, map])
  return null
}


function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface CidadeCoord { nome: string; lat: number; lng: number }
const COORD_POR_CIDADE = new Map<string, CidadeCoord>(
  (cidadesPE as CidadeCoord[]).map((c) => [normalizar(c.nome), c])
)

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
  const tema = theme === 'dark' ? TILES.dark : TILES.light
  
  const mapRef = useRef<any>(null)
  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  
  // Controle de interação no mobile para evitar scroll trap
  const [mapaAtivo, setMapaAtivo] = useState(!isMobile)

  useEffect(() => {
    if (mapRef.current && isMobile) {
      if (mapaAtivo) {
        mapRef.current.dragging.enable()
      } else {
        mapRef.current.dragging.disable()
      }
    }
  }, [mapaAtivo])

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

  // Pontos por LOCAL DE VOTAÇÃO. O backend novo já envia agregado (com count e
  // posição média). Se vier no formato antigo (um item por eleitor), agregamos
  // aqui — mantém compatibilidade caso o front atualize antes do backend.
  const locaisVotacao = useMemo(() => {
    const jaAgregado = pontosGeo.length > 0 && pontosGeo[0].count != null

    // Caminho agregado: re-consolida pela chave normalizada (une variações de
    // maiúsculas/espaços) usando média ponderada — resultado idêntico ao antigo.
    if (jaAgregado) {
      const m = new Map<string, { local: string; cidade: string; count: number; latSum: number; lngSum: number }>()
      for (const p of pontosGeo) {
        if (p.lat == null || p.lng == null) continue
        const chave = `${(p.local_votacao || 'Desconhecido').toLowerCase().trim()}|${(p.cidade || '').toLowerCase().trim()}`
        const c = p.count ?? 1
        const ex = m.get(chave)
        if (ex) {
          ex.count += c
          ex.latSum += p.lat * c
          ex.lngSum += p.lng * c
        } else {
          m.set(chave, {
            local: p.local_votacao || 'Desconhecido',
            cidade: p.cidade || '',
            count: c,
            latSum: p.lat * c,
            lngSum: p.lng * c,
          })
        }
      }
      return [...m.values()].map((l) => ({
        local: l.local,
        cidade: l.cidade,
        lat: l.latSum / l.count,
        lng: l.lngSum / l.count,
        count: l.count,
      }))
    }

    const mapa = new Map<string, { local: string; cidade: string; lat: number; lng: number; count: number; latSum: number; lngSum: number }>()
    for (const e of pontosGeo) {
      if (e.lat == null || e.lng == null) continue
      const chave = `${(e.local_votacao || 'Desconhecido').toLowerCase().trim()}|${(e.cidade || '').toLowerCase().trim()}`
      const existing = mapa.get(chave)
      if (existing) {
        existing.count++
        existing.latSum += e.lat
        existing.lngSum += e.lng
      } else {
        mapa.set(chave, {
          local: e.local_votacao || 'Desconhecido',
          cidade: e.cidade || '',
          lat: e.lat,
          lng: e.lng,
          count: 1,
          latSum: e.lat,
          lngSum: e.lng,
        })
      }
    }
    // Usa o ponto médio dos eleitores de cada local como posição do marcador
    return [...mapa.values()].map(l => ({
      ...l,
      lat: l.latSum / l.count,
      lng: l.lngSum / l.count,
    }))
  }, [pontosGeo])

  const pontosCalor = useMemo(() => {
    // Cada local de votação gera 1 ponto com peso proporcional ao número de eleitores
    return locaisVotacao.map(l => [l.lat, l.lng, Math.min(1, l.count / Math.max(1, ...locaisVotacao.map(x => x.count)))] as [number, number, number])
  }, [locaisVotacao])

  const pontos = useMemo(() => {
    const pts: { cidade: string; count: number; lat: number; lng: number }[] = []
    for (const [cidadeNorm, count] of countPorCidadeNorm) {
      const coord = COORD_POR_CIDADE.get(cidadeNorm)
      if (coord) pts.push({ cidade: coord.nome, count, lat: coord.lat, lng: coord.lng })
    }
    return pts
  }, [countPorCidadeNorm])

  const maxCount = Math.max(1, ...pontos.map((p) => p.count))

  // Para os locais de votação: top locais com rótulo
  const maxLocalCount = Math.max(1, ...locaisVotacao.map(l => l.count))
  const localLider = locaisVotacao.reduce<string | null>((lider, l) => l.count === maxLocalCount && maxLocalCount > 0 ? l.local : lider, null)

  const pronto = geoData && bounds

  if (!pronto) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${className || ''}`} style={{ height: className ? undefined : height }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className={telaCheia ? 'fixed inset-0 z-[2000] bg-white dark:bg-slate-950' : `relative w-full sm:rounded-2xl overflow-hidden border-y sm:border-x sm:border-y border-slate-200 dark:border-slate-800 shadow-sm ${className || ''}`}>
      
      {/* Overlay de Interação Mobile (Resolve Scroll Trap) */}
      {isMobile && !mapaAtivo && (
        <div 
          className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-900/30 backdrop-blur-[2px] transition-opacity cursor-pointer"
          onClick={() => setMapaAtivo(true)}
          onTouchStart={() => setMapaAtivo(true)}
        >
          <div className="rounded-3xl bg-white/95 dark:bg-slate-800/95 px-6 py-5 shadow-2xl flex flex-col items-center gap-3 animate-slide-up mx-6 text-center">
            <div className="bg-brand-100 dark:bg-brand-900/50 p-3 rounded-full">
              <span className="text-2xl block animate-bounce">👆</span>
            </div>
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
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-white shadow-xl backdrop-blur transition active:scale-95 border border-white/10"
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

      <MapContainer
        ref={mapRef}
        preferCanvas={true}
        bounds={bounds!}
        maxBounds={bounds!}
        maxBoundsViscosity={0.9}
        minZoom={6}
        scrollWheelZoom={!isMobile}
        dragging={!isMobile} // Começa desativado no mobile até o usuário tocar
        touchZoom={true}
        zoomControl={false}
        attributionControl={false}
        style={{
          height: telaCheia ? '100vh' : (className ? '100%' : height),
          minHeight: className ? undefined : height,
          width: '100%',
          background: theme === 'dark' ? '#0f172a' : '#eef2f6',
        }}
      >
        <InvalidarTamanho dep={telaCheia} />
        <ZoomNaCidade
          cidade={cidadeSelecionada}
          centro={
            cidadeSelecionada
              ? (() => {
                  const c = COORD_POR_CIDADE.get(normalizar(cidadeSelecionada))
                  return c ? [c.lat, c.lng] : null
                })()
              : null
          }
          boundsPE={bounds!}
        />
        <TileLayer key={theme} url={tema.url} subdomains="abcd" detectRetina crossOrigin="anonymous" />
        <ZoomControl position="bottomright" />
        
        <GeoJSON
          key={`${modoVisualizacao}-${theme}-${maxChoropleth}-${[...countPorCidadeNorm].join()}`}
          data={geoData}
          style={(feature: any) => {
            const isSelected = cidadeSelecionada && normalizar(cidadeSelecionada) === normalizar(feature.properties.nome)
            const c = countPorCidadeNorm.get(normalizar(feature.properties.nome)) || 0
            
            if (modoVisualizacao === 'mapa') {
              return {
                color: isSelected ? (theme === 'dark' ? '#ffffff' : '#000000') : '#ffffff',
                weight: isSelected ? 3 : 0.6,
                fillColor: isSelected 
                  ? (theme === 'dark' ? '#ffffff' : '#000000') 
                  : (c > 0 ? corCalor(c / maxChoropleth) : theme === 'dark' ? '#1e293b' : '#e2e8f0'),
                fillOpacity: isSelected ? 0.1 : (c > 0 ? 0.85 : 0.35),
              }
            }
            return {
              color: isSelected ? (theme === 'dark' ? '#ffffff' : '#000000') : tema.boundary,
              weight: isSelected ? 3 : 0.8,
              fillColor: isSelected ? (theme === 'dark' ? '#ffffff' : '#000000') : tema.fill,
              fillOpacity: isSelected ? 0.1 : 0.04,
            }
          }}
          onEachFeature={(feature: any, layer: any) => {
            const c = countPorCidadeNorm.get(normalizar(feature.properties.nome)) || 0
            if (c > 0) {
              // Rótulo fixo (sempre visível, sem precisar de hover) só nas cidades
              // com eleitores — evita poluir o mapa com ~180 municípios vazios.
              layer.bindTooltip(feature.properties.nome, {
                permanent: true,
                direction: 'center',
                className: 'rotulo-cidade',
                opacity: 0.95,
              })
            } else {
              layer.bindTooltip(`<strong>${feature.properties.nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`, { sticky: true })
            }
            layer.on({
              click: () => onCidadeSelect(cidadeSelecionada === feature.properties.nome ? null : feature.properties.nome)
            })
          }}
        />

        {modoVisualizacao === 'calor' && (
          <>
            <CamadaCalor pontos={pontosCalor} />
            <MarkerClusterGroup 
              chunkedLoading 
              maxClusterRadius={isMobile ? 35 : 50}
              showCoverageOnHover={false}
              spiderfyOnMaxZoom={true}
            >
              {locaisVotacao.map((l) => {
                const ehLider = l.local === localLider
                const diametro = Math.max(20, Math.min(42, 20 + (l.count / maxLocalCount) * 40))
                
                const customIcon = L.divIcon({
                  html: `<div class="flex items-center justify-center rounded-full shadow-md text-white font-bold border-2 border-white/20 ${ehLider ? 'bg-red-600' : 'bg-indigo-600'}" style="width: ${diametro}px; height: ${diametro}px; font-size: ${Math.max(10, diametro/2.5)}px;">
                           ${l.count}
                         </div>`,
                  className: '!bg-transparent !border-0',
                  iconSize: [diametro, diametro],
                  iconAnchor: [diametro / 2, diametro / 2],
                })

                return (
                  <Marker
                    key={`${l.local}-${l.cidade}`}
                    position={[l.lat, l.lng]}
                    icon={customIcon}
                  >
                    {!isMobile && (
                      <Tooltip direction="top" offset={[0, -diametro/2]} opacity={0.9} className="!bg-slate-900 !text-white !border-0 !rounded-lg !text-xs font-semibold">
                        {ehLider ? '👑 ' : ''}{l.local}
                      </Tooltip>
                    )}
                    <Popup autoPan={false} className="rounded-2xl">
                      <div className="p-1 min-w[180px]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{l.cidade}</p>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight mb-2">{l.local}</h3>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="bg-brand-100 text-brand-700 px-2 py-1 rounded text-xs font-black">
                            {l.count}
                          </div>
                          <span className="text-xs text-slate-600 font-medium">
                            eleitores ativos
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MarkerClusterGroup>
          </>
        )}
      </MapContainer>

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
