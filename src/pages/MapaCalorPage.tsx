import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  GeoJSON,
  useMap,
} from 'react-leaflet'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import html2canvas from 'html2canvas'
import { useEleitores } from '../hooks/useEleitores'
import { useCabos } from '../hooks/useCabos'
import { useTheme } from '../components/ThemeProvider'
import cidadesPE from '../data/pe-cidades.json'

/* Tiles limpos (CARTO) — visual profissional, claro e escuro */
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

/* Cor de calor: amarelo -> laranja -> vermelho profundo */
function corCalor(intensidade: number) {
  const h = Math.round(45 - intensidade * 45)
  const l = Math.round(58 - intensidade * 14)
  return `hsl(${h}, 95%, ${l}%)`
}

/* Recalcula o tamanho do mapa quando entra/sai da tela cheia */
function InvalidarTamanho({ dep }: { dep: boolean }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

/* Camada de calor (heatmap real) — densidade distribuída e suave */
function CamadaCalor({ pontos }: { pontos: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    const layer = (L as any).heatLayer(pontos, {
      radius: 32,
      blur: 24,
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

/* Jitter determinístico (espalha eleitores ao redor do centro da cidade) */
function jitter(seed: string, escala = 0.05) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * escala
}

interface CidadeCoord {
  nome: string
  lat: number
  lng: number
}
interface BairroItem {
  cidade: string
  bairro: string
  count: number
}

function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const COORD_POR_CIDADE = new Map<string, CidadeCoord>(
  (cidadesPE as CidadeCoord[]).map((c) => [normalizar(c.nome), c]),
)

/* Limites de PE (continente) calculados a partir do GeoJSON */
function calcularBounds(geo: any): LatLngBoundsExpression {
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180
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
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

export function MapaCalorPage() {
  const { eleitores: todosEleitores, loading } = useEleitores()
  const { cabos } = useCabos()
  const { theme } = useTheme()
  const tema = theme === 'dark' ? TILES.dark : TILES.light
  const mapaRef = useRef<HTMLDivElement>(null)
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null)
  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  const [modo, setModo] = useState<'calor' | 'mapa'>('calor')
  const [caboFiltro, setCaboFiltro] = useState('')
  const [exportando, setExportando] = useState(false)

  // Filtra por cabo (se selecionado)
  const eleitores = useMemo(
    () => (caboFiltro ? todosEleitores.filter((e) => e.cabo_id === caboFiltro) : todosEleitores),
    [todosEleitores, caboFiltro],
  )

  // Contagem por município (normalizado) para o mapa pintado
  const countPorCidadeNorm = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of eleitores) {
      if (!e.cidade) continue
      const k = normalizar(e.cidade)
      m.set(k, (m.get(k) || 0) + 1)
    }
    return m
  }, [eleitores])
  const maxChoropleth = Math.max(1, ...countPorCidadeNorm.values())

  // Pontos do heatmap: 1 ponto por eleitor, espalhado ao redor da cidade
  const pontosCalor = useMemo(() => {
    const arr: [number, number, number][] = []
    for (const e of eleitores) {
      if (e.lat != null && e.lng != null) {
        arr.push([e.lat, e.lng, 0.9])
      } else if (e.cidade) {
        const c = COORD_POR_CIDADE.get(normalizar(e.cidade))
        if (c) arr.push([c.lat + jitter(e.id + 'a'), c.lng + jitter(e.id + 'b'), 0.7])
      }
    }
    return arr
  }, [eleitores])

  async function exportarImagem() {
    if (!mapaRef.current) return
    setExportando(true)
    try {
      const canvas = await html2canvas(mapaRef.current, {
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        scale: 2,
      })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `mapa-pernambuco${caboFiltro ? '-filtrado' : ''}.png`
      a.click()
    } catch {
      alert('Não foi possível exportar a imagem. Tente novamente.')
    } finally {
      setExportando(false)
    }
  }

  /* ---------- Carrega o contorno de PE (local, sem Noronha) ---------- */
  useEffect(() => {
    fetch('/pe-municipios.geojson')
      .then((r) => r.json())
      .then((geo) => {
        setGeoData(geo)
        setBounds(calcularBounds(geo))
      })
      .catch(() => {})
  }, [])

  /* ---------- Agregações ---------- */
  const { contagemPorCidade, bairrosList, pontos } = useMemo(() => {
    const cidadeMap = new Map<string, number>()
    const bairrosMap = new Map<string, Map<string, number>>()
    const pontos: { cidade: string; count: number; lat: number; lng: number }[] = []
    const marcadoresIndividuais: { id: string; nome: string; cidade: string; bairro: string; lat: number; lng: number }[] = []

    for (const e of eleitores) {
      if (!e.cidade) continue
      const cidade = e.cidade.trim()
      
      if (e.lat != null && e.lng != null) {
        marcadoresIndividuais.push({
          id: e.id,
          nome: e.nome,
          cidade,
          bairro: e.bairro || '',
          lat: e.lat,
          lng: e.lng
        })
      } else {
        cidadeMap.set(cidade, (cidadeMap.get(cidade) || 0) + 1)
      }
      
      if (e.bairro) {
        if (!bairrosMap.has(cidade)) bairrosMap.set(cidade, new Map())
        const bm = bairrosMap.get(cidade)!
        const bairro = e.bairro.trim()
        bm.set(bairro, (bm.get(bairro) || 0) + 1)
      }
    }

    const bairrosList: BairroItem[] = []
    for (const [cidade, bm] of bairrosMap)
      for (const [bairro, count] of bm) bairrosList.push({ cidade, bairro, count })
    bairrosList.sort((a, b) => b.count - a.count)

    for (const [cidade, count] of cidadeMap) {
      const coord = COORD_POR_CIDADE.get(normalizar(cidade))
      if (coord) pontos.push({ cidade, count, lat: coord.lat, lng: coord.lng })
    }

    return { contagemPorCidade: cidadeMap, bairrosList, pontos, marcadoresIndividuais }
  }, [eleitores])

  const maxCount = Math.max(1, ...pontos.map((p) => p.count))
  // Cidade líder (mais eleitores) e top 5 para rótulos fixos
  const cidadeLider = pontos.reduce<string | null>(
    (lider, p) =>
      p.count === maxCount && maxCount > 0 ? p.cidade : lider,
    null,
  )
  const cidadesComRotulo = new Set(
    [...pontos].sort((a, b) => b.count - a.count).slice(0, 5).map((p) => p.cidade),
  )
  const totalEleitores = eleitores.length
  const cidadesComVotos = [...contagemPorCidade.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const bairrosFiltrados = cidadeSelecionada
    ? bairrosList.filter((b) => b.cidade === cidadeSelecionada)
    : bairrosList
  const maxBairro = bairrosFiltrados.length > 0 ? bairrosFiltrados[0].count : 1

  const pronto = !loading && geoData && bounds

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Mapa de Força — Pernambuco 🗺️
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Concentração de eleitores por município. Quanto maior e mais vermelho o
          círculo, mais eleitores.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total de Eleitores" value={totalEleitores} />
        <StatCard label="Municípios Alcançados" value={contagemPorCidade.size} />
        <StatCard label="Bairros Mapeados" value={bairrosList.length} />
        <StatCard
          label="Maior Concentração"
          value={cidadesComVotos[0]?.[1] || 0}
          sub={cidadesComVotos[0]?.[0] || '—'}
        />
      </div>

      {/* Barra de controles */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-bold shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={() => setModo('calor')}
            className={`rounded-md px-3 py-1.5 transition ${modo === 'calor' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            🔥 Calor
          </button>
          <button
            onClick={() => setModo('mapa')}
            className={`rounded-md px-3 py-1.5 transition ${modo === 'mapa' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            ▦ Mapa pintado
          </button>
        </div>

        <select
          value={caboFiltro}
          onChange={(e) => setCaboFiltro(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todos os cabos</option>
          {cabos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <button
          onClick={exportarImagem}
          disabled={exportando}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {exportando ? 'Gerando...' : '⬇ Exportar imagem'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div
          ref={mapaRef}
          className={
            telaCheia
              ? 'fixed inset-0 z-[2000] bg-white dark:bg-slate-950'
              : 'relative lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800'
          }
        >
          {pronto ? (
            <>
              <button
                onClick={() => setTelaCheia((v) => !v)}
                className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white active:scale-95 dark:border-slate-700/70 dark:bg-slate-900/85 dark:text-slate-200"
              >
                {telaCheia ? '✕ Sair' : '⛶ Tela cheia'}
              </button>
              <MapContainer
                bounds={bounds!}
                maxBounds={bounds!}
                maxBoundsViscosity={0.9}
                minZoom={6}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                style={{
                  height: telaCheia ? '100vh' : '65vh',
                  minHeight: 460,
                  width: '100%',
                  background: theme === 'dark' ? '#0f172a' : '#eef2f6',
                }}
              >
                <InvalidarTamanho dep={telaCheia} />
                <TileLayer
                  key={theme}
                  url={tema.url}
                  subdomains="abcd"
                  detectRetina
                  crossOrigin="anonymous"
                />
                {/* Municípios: contorno (modo bolhas) ou pintados (modo mapa) */}
                <GeoJSON
                  key={`${modo}-${theme}-${maxChoropleth}-${[...countPorCidadeNorm].join()}`}
                  data={geoData}
                  style={(feature: any) => {
                    const c = countPorCidadeNorm.get(normalizar(feature.properties.nome)) || 0
                    if (modo === 'mapa') {
                      return {
                        color: '#ffffff',
                        weight: 0.6,
                        fillColor:
                          c > 0
                            ? corCalor(c / maxChoropleth)
                            : theme === 'dark'
                              ? '#1e293b'
                              : '#e2e8f0',
                        fillOpacity: c > 0 ? 0.85 : 0.35,
                      }
                    }
                    return {
                      color: tema.boundary,
                      weight: 0.8,
                      fillColor: tema.fill,
                      fillOpacity: 0.04,
                    }
                  }}
                  onEachFeature={(feature: any, layer: any) => {
                    const c = countPorCidadeNorm.get(normalizar(feature.properties.nome)) || 0
                    layer.bindTooltip(
                      `<strong>${feature.properties.nome}</strong><br/>${c} eleitor${c !== 1 ? 'es' : ''}`,
                      { sticky: true },
                    )
                  }}
                />
                {/* Mapa de calor (heatmap) — modo "calor" */}
                {modo === 'calor' && (
                  <>
                    <CamadaCalor pontos={pontosCalor} />
                    {/* Rótulos discretos das principais cidades sobre o calor */}
                    {pontos
                      .filter((p) => cidadesComRotulo.has(p.cidade))
                      .map((p) => {
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
                              className: ehLider ? 'marcador-lider' : undefined,
                            }}
                            eventHandlers={{
                              click: () =>
                                setCidadeSelecionada(
                                  cidadeSelecionada === p.cidade ? null : p.cidade,
                                ),
                            }}
                          >
                            <Tooltip
                              permanent
                              direction="top"
                              offset={[0, -8]}
                              className="rotulo-cidade"
                            >
                              {ehLider ? '👑 ' : ''}
                              {p.cidade} · {p.count}
                            </Tooltip>
                          </CircleMarker>
                        )
                      })}
                  </>
                )}
              </MapContainer>

              {/* Legenda flutuante */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/85">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Concentração
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {modo === 'calor' ? 'menos' : '0'}
                  </span>
                  <div
                    className="h-2.5 w-28 rounded-full"
                    style={{
                      background:
                        modo === 'calor'
                          ? 'linear-gradient(to right, #1e3a8a, #06b6d4, #22c55e, #facc15, #f97316, #dc2626)'
                          : 'linear-gradient(to right, hsl(45,95%,58%), hsl(22,95%,51%), hsl(0,95%,44%))',
                    }}
                  />
                  <span className="text-[10px] font-semibold text-slate-400">
                    {modo === 'calor' ? 'mais' : maxCount}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[65vh] min-h-[460px] items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">
              🏆 Top Municípios
            </h2>
            <div className="space-y-2">
              {cidadesComVotos.map(([cidade, count], idx) => {
                const pct = (count / (cidadesComVotos[0]?.[1] || 1)) * 100
                const isSelected = cidadeSelecionada === cidade
                return (
                  <button
                    key={cidade}
                    onClick={() => setCidadeSelecionada(isSelected ? null : cidade)}
                    className={`w-full text-left rounded-lg p-2.5 transition ${
                      isSelected
                        ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950 dark:ring-brand-400'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span className="mr-1.5 text-slate-400">{idx + 1}.</span>
                        {cidade}
                      </span>
                      <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
              {cidadesComVotos.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  Nenhum eleitor cadastrado ainda.
                </p>
              )}
            </div>
          </div>

          <div className="flex max-h-[400px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">
              🔥 Bairros Quentes
              {cidadeSelecionada && (
                <span className="ml-2 text-xs font-medium text-slate-400">
                  em {cidadeSelecionada}
                </span>
              )}
            </h2>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {bairrosFiltrados.slice(0, 20).map((item) => {
                const pct = Math.max(0, Math.min(100, (item.count / maxBairro) * 100))
                return (
                  <div
                    key={`${item.cidade}-${item.bairro}`}
                    className="relative flex items-center justify-between overflow-hidden rounded-lg p-2.5"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 rounded-lg bg-red-500 dark:bg-red-600"
                      style={{ opacity: 0.15 + (pct * 0.85) / 100 }}
                    />
                    <div className="relative z-10">
                      <p
                        className={`text-sm font-bold ${pct > 55 ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}
                      >
                        {item.bairro}
                      </p>
                      {!cidadeSelecionada && (
                        <p
                          className={`text-[11px] font-medium ${pct > 55 ? 'text-red-100' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                          {item.cidade}
                        </p>
                      )}
                    </div>
                    <span
                      className={`relative z-10 text-base font-black ${pct > 55 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {item.count}
                    </span>
                  </div>
                )
              })}
              {bairrosFiltrados.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  Nenhum bairro cadastrado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
        {value.toLocaleString('pt-BR')}
      </p>
      {sub && (
        <p className="truncate text-xs font-medium text-brand-500 dark:text-brand-400">{sub}</p>
      )}
    </div>
  )
}
