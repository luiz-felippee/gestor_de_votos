import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEleitores } from '../hooks/useEleitores'
import cidadesPE from '../data/pe-cidades.json'

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
    // eslint-disable-next-line no-control-regex
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Mapa: nome normalizado da cidade -> coordenada
const COORD_POR_CIDADE = new Map<string, CidadeCoord>(
  (cidadesPE as CidadeCoord[]).map((c) => [normalizar(c.nome), c]),
)

export function MapaCalorPage() {
  const { eleitores, loading } = useEleitores()
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null)

  /* ---------- Agregações ---------- */
  const { contagemPorCidade, bairrosList, pontos } = useMemo(() => {
    const cidadeMap = new Map<string, number>()
    const bairrosMap = new Map<string, Map<string, number>>()

    for (const e of eleitores) {
      if (!e.cidade) continue
      const cidade = e.cidade.trim()
      cidadeMap.set(cidade, (cidadeMap.get(cidade) || 0) + 1)
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

    // Pontos do mapa (cidades que temos coordenada)
    const pontos = [...cidadeMap.entries()]
      .map(([cidade, count]) => {
        const coord = COORD_POR_CIDADE.get(normalizar(cidade))
        return coord ? { cidade, count, lat: coord.lat, lng: coord.lng } : null
      })
      .filter(Boolean) as { cidade: string; count: number; lat: number; lng: number }[]

    return { contagemPorCidade: cidadeMap, bairrosList, pontos }
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

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Carregando mapa...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Mapa de Força — Pernambuco 🗺️
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Concentração de eleitores cadastrados por município. Quanto maior e mais
          vermelho o círculo, mais eleitores.
        </p>
      </div>

      {/* Stats */}
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
        {/* Mapa Leaflet */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800">
          <MapContainer
            center={[-8.3, -37.9]}
            zoom={7}
            scrollWheelZoom
            style={{ height: '60vh', minHeight: 420, width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pontos.map((p) => {
              const intensidade = p.count / maxCount
              const raio = 8 + intensidade * 22
              const cor = `hsl(${Math.round(45 - intensidade * 45)}, 90%, 50%)`
              return (
                <CircleMarker
                  key={p.cidade}
                  center={[p.lat, p.lng]}
                  radius={raio}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 1.5,
                    fillColor: cor,
                    fillOpacity: 0.75,
                  }}
                  eventHandlers={{
                    click: () =>
                      setCidadeSelecionada(
                        cidadeSelecionada === p.cidade ? null : p.cidade,
                      ),
                  }}
                >
                  <Tooltip direction="top">
                    <strong>{p.cidade}</strong>
                    <br />
                    {p.count} eleitor{p.count !== 1 ? 'es' : ''}
                  </Tooltip>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {/* Sidebar */}
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
