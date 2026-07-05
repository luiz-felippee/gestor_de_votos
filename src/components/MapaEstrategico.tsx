import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { feature as topoFeature } from 'topojson-client'
import { useTheme } from './ThemeProvider'
import cidadesPE from '../data/pe-cidades.json'

const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
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
    const layer = (L as any).heatLayer(pontos, {
      radius: isMobile ? 20 : 32,
      blur: isMobile ? 16 : 24,
      minOpacity: 0.35,
      maxZoom: 11,
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

function jitter(seed: string, escala = 0.05) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * escala
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
  pontosGeo: { id: string; cidade: string | null; lat: number | null; lng: number | null }[]
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
  
  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)

  useEffect(() => {
    fetch('/pe-municipios.topojson')
      .then((r) => r.json())
      .then((topo) => {
        // Decodifica TopoJSON → GeoJSON (arquivo ~60% menor que o GeoJSON puro)
        const geo = topoFeature(topo, topo.objects.municipios) as any
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

  const pontos = useMemo(() => {
    const pts: { cidade: string; count: number; lat: number; lng: number }[] = []
    for (const [cidadeNorm, count] of countPorCidadeNorm) {
      const coord = COORD_POR_CIDADE.get(cidadeNorm)
      if (coord) pts.push({ cidade: coord.nome, count, lat: coord.lat, lng: coord.lng })
    }
    return pts
  }, [countPorCidadeNorm])

  const maxCount = Math.max(1, ...pontos.map((p) => p.count))
  const cidadeLider = pontos.reduce<string | null>((lider, p) => p.count === maxCount && maxCount > 0 ? p.cidade : lider, null)
  const cidadesComRotulo = new Set([...pontos].sort((a, b) => b.count - a.count).slice(0, 5).map((p) => p.cidade))

  // Estilo de cada município — memoizado e reaplicado sem remontar a camada
  const estiloFeature = useCallback((feature: any) => {
    const nomeNorm = normalizar(feature.properties.nome)
    const isSelected = !!cidadeSelecionada && normalizar(cidadeSelecionada) === nomeNorm
    const c = countPorCidadeNorm.get(nomeNorm) || 0

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
  }, [cidadeSelecionada, countPorCidadeNorm, maxChoropleth, modoVisualizacao, theme, tema])

  // Ref com o estado mais recente para os handlers do Leaflet (que só montam 1x)
  const geoJsonRef = useRef<any>(null)
  const estadoRef = useRef({ cidadeSelecionada, onCidadeSelect, estiloFeature })
  estadoRef.current = { cidadeSelecionada, onCidadeSelect, estiloFeature }

  // Reaplica estilos e tooltips de forma imperativa quando os dados mudam,
  // em vez de remontar os 184 municípios (evita travar ao filtrar/atualizar).
  useEffect(() => {
    const layer = geoJsonRef.current
    if (!layer) return
    layer.setStyle(estiloFeature)
    layer.eachLayer((l: any) => {
      const nome = l.feature?.properties?.nome
      if (!nome) return
      const c = countPorCidadeNorm.get(normalizar(nome)) || 0
      l.setTooltipContent(`<strong>${nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`)
    })
  }, [estiloFeature, countPorCidadeNorm])

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
        bounds={bounds!}
        maxBounds={bounds!}
        maxBoundsViscosity={0.9}
        minZoom={6}
        scrollWheelZoom={!isMobile}
        dragging={true}
        touchZoom={true}
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
        
        <GeoJSON
          key={`${modoVisualizacao}-${theme}`}
          ref={geoJsonRef}
          data={geoData}
          style={estiloFeature}
          onEachFeature={(feature: any, layer: any) => {
            const nome = feature.properties.nome
            const c = countPorCidadeNorm.get(normalizar(nome)) || 0
            layer.bindTooltip(
              `<strong>${nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`,
              { sticky: true, className: 'mapa-tooltip', direction: 'top', opacity: 1 }
            )
            layer.on({
              mouseover: (e: any) => {
                if (estadoRef.current.cidadeSelecionada === nome) return
                e.target.setStyle({ weight: 2.5, color: theme === 'dark' ? '#ffffff' : '#0f172a' })
                e.target.bringToFront()
              },
              mouseout: (e: any) => {
                e.target.setStyle(estadoRef.current.estiloFeature(feature))
              },
              click: () =>
                estadoRef.current.onCidadeSelect(
                  estadoRef.current.cidadeSelecionada === nome ? null : nome
                ),
            })
          }}
        />

        {modoVisualizacao === 'calor' && (
          <>
            <CamadaCalor pontos={pontosCalor} />
            {pontos.filter((p) => cidadesComRotulo.has(p.cidade)).map((p) => {
              const ehLider = p.cidade === cidadeLider
              return (
                <CircleMarker
                  key={p.cidade}
                  center={[p.lat, p.lng]}
                  radius={ehLider ? 5 : 3}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: ehLider ? '#dc2626' : '#0f172a',
                    fillOpacity: 1,
                  }}
                  eventHandlers={{
                    click: () => onCidadeSelect(cidadeSelecionada === p.cidade ? null : p.cidade),
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]} className="!bg-transparent !border-0 !shadow-none !text-slate-800 dark:!text-white !font-bold !text-xs">
                    {ehLider ? '👑 ' : ''}{p.cidade} · {p.count}
                  </Tooltip>
                </CircleMarker>
              )
            })}
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
