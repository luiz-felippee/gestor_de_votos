import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  GeoJSON,
} from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEleitores } from '../hooks/useEleitores'
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
  const { eleitores, loading } = useEleitores()
  const { theme } = useTheme()
  const tema = theme === 'dark' ? TILES.dark : TILES.light
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null)
  const [geoData, setGeoData] = useState<any>(null)
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null)

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
  const { contagemPorCidade, bairrosList, pontos, marcadoresIndividuais } = useMemo(() => {
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="relative lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800">
          {pronto ? (
            <>
              <MapContainer
                bounds={bounds!}
                maxBounds={bounds!}
                maxBoundsViscosity={0.9}
                minZoom={6}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                style={{
                  height: '65vh',
                  minHeight: 460,
                  width: '100%',
                  background: theme === 'dark' ? '#0f172a' : '#eef2f6',
                }}
              >
                <TileLayer key={theme} url={tema.url} subdomains="abcd" detectRetina />
                {/* Contorno dos municípios de PE */}
                <GeoJSON
                  data={geoData}
                  style={{
                    color: tema.boundary,
                    weight: 0.8,
                    fillColor: tema.fill,
                    fillOpacity: 0.04,
                  }}
                />
                {/* Círculos de calor (raio proporcional à área) */}
                {pontos.map((p) => {
                  const intensidade = p.count / maxCount
                  const raio = 7 + Math.sqrt(intensidade) * 25
                  return (
                    <CircleMarker
                      key={p.cidade}
                      center={[p.lat, p.lng]}
                      radius={raio}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 1.5,
                        fillColor: corCalor(intensidade),
                        fillOpacity: 0.82,
                      }}
                      eventHandlers={{
                        click: () =>
                          setCidadeSelecionada(
                            cidadeSelecionada === p.cidade ? null : p.cidade,
                          ),
                      }}
                    >
                      <Tooltip direction="top" opacity={1}>
                        <strong>{p.cidade}</strong>
                        <br />
                        {p.count} eleitor{p.count !== 1 ? 'es' : ''}
                      </Tooltip>
                    </CircleMarker>
                  )
                })}

                {/* Marcadores individuais (geocodificados) */}
                {marcadoresIndividuais.map((m) => (
                  <CircleMarker
                    key={m.id}
                    center={[m.lat, m.lng]}
                    radius={5}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.5,
                      fillColor: '#2563eb',
                      fillOpacity: 0.9,
                    }}
                    eventHandlers={{
                      click: () =>
                        setCidadeSelecionada(cidadeSelecionada === m.cidade ? null : m.cidade),
                    }}
                  >
                    <Tooltip direction="top" opacity={1}>
                      <strong>{m.nome}</strong>
                      <br />
                      <span className="text-xs">
                        {m.bairro}
                        {m.bairro && ', '}
                        {m.cidade}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>

              {/* Legenda flutuante */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/85">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Concentração
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">0</span>
                  <div
                    className="h-2.5 w-28 rounded-full"
                    style={{
                      background:
                        'linear-gradient(to right, hsl(45,95%,58%), hsl(22,95%,51%), hsl(0,95%,44%))',
                    }}
                  />
                  <span className="text-[10px] font-semibold text-slate-400">
                    {maxCount}
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
