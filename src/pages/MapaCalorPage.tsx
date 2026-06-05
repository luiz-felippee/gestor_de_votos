import { useMemo, useEffect, useRef, useState } from 'react'
import { useEleitores } from '../hooks/useEleitores'
import * as d3 from 'd3'

/* ------------------------------------------------------------------ */
/*  URL oficial do IBGE — malha dos municípios de PE (código 26)      */
/* ------------------------------------------------------------------ */
const IBGE_PE_URL =
  'https://servicodados.ibge.gov.br/api/v3/malhas/estados/26?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio'

/* ------------------------------------------------------------------ */
/*  URL para nomes dos municípios do IBGE                             */
/* ------------------------------------------------------------------ */
const IBGE_NOMES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios'

/* ------------------------------------------------------------------ */
/*  Tipos                                                             */
/* ------------------------------------------------------------------ */
interface MunicipioNome {
  id: number
  nome: string
}

interface BairroItem {
  cidade: string
  bairro: string
  count: number
}

/* ------------------------------------------------------------------ */
/*  Normalização de nomes para matching                               */
/* ------------------------------------------------------------------ */
function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                              */
/* ------------------------------------------------------------------ */
export function MapaCalorPage() {
  const { eleitores, loading: loadingEleitores } = useEleitores()
  const svgRef = useRef<SVGSVGElement>(null)

  const [geoData, setGeoData] = useState<any>(null)
  const [nomesMap, setNomesMap] = useState<Map<number, string>>(new Map())
  const [loadingMapa, setLoadingMapa] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null)

  /* ---------- Buscar GeoJSON + Nomes do IBGE ---------- */
  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const [geoRes, nomesRes] = await Promise.all([
          fetch(IBGE_PE_URL),
          fetch(IBGE_NOMES_URL),
        ])
        if (!geoRes.ok || !nomesRes.ok) throw new Error('Falha ao carregar dados do IBGE')
        const geo = await geoRes.json()
        const nomes: MunicipioNome[] = await nomesRes.json()

        if (cancelled) return

        const map = new Map<number, string>()
        for (const n of nomes) map.set(n.id, n.nome)

        setGeoData(geo)
        setNomesMap(map)
      } catch (err: any) {
        if (!cancelled) setErro(err.message || 'Erro ao carregar mapa')
      } finally {
        if (!cancelled) setLoadingMapa(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  /* ---------- Agrupar eleitores por cidade e bairro ---------- */
  const { contagemPorCidade, bairrosList, totalEleitores } = useMemo(() => {
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
    for (const [cidade, bm] of bairrosMap) {
      for (const [bairro, count] of bm) {
        bairrosList.push({ cidade, bairro, count })
      }
    }
    bairrosList.sort((a, b) => b.count - a.count)

    return {
      contagemPorCidade: cidadeMap,
      bairrosList,
      totalEleitores: eleitores.length,
    }
  }, [eleitores])

  /* ---------- Bairros filtrados pela cidade selecionada ---------- */
  const bairrosFiltrados = useMemo(() => {
    if (!cidadeSelecionada) return bairrosList
    return bairrosList.filter((b) => b.cidade === cidadeSelecionada)
  }, [bairrosList, cidadeSelecionada])

  /* ---------- Mapa de códigos IBGE → contagem ---------- */
  const contagemPorId = useMemo(() => {
    const result = new Map<number, number>()
    if (nomesMap.size === 0) return result

    for (const [id, nome] of nomesMap) {
      const nomeNorm = normalizar(nome)
      for (const [cidade, count] of contagemPorCidade) {
        if (normalizar(cidade) === nomeNorm) {
          result.set(id, count)
          break
        }
      }
    }
    return result
  }, [nomesMap, contagemPorCidade])

  /* ---------- Projeção e Cores (Memo) ---------- */
  const { pathGen, colorScale, features } = useMemo(() => {
    if (!geoData || !geoData.features) return { pathGen: null, colorScale: null, features: [] }

    const width = 800
    const height = 500

    // Mantém só o continente: Fernando de Noronha fica no Atlântico (~-32.4 lon)
    // e esticaria o mapa, deixando o continente espremido.
    const maxLonDe = (coords: any): number => {
      if (typeof coords[0] === 'number') return coords[0]
      return Math.max(...coords.map(maxLonDe))
    }
    const continente = geoData.features.filter(
      (f: any) => f.geometry && maxLonDe(f.geometry.coordinates) < -33.5,
    )
    const fc: any = { type: 'FeatureCollection', features: continente }

    const projection = d3.geoMercator().fitExtent([[20, 20], [width - 20, height - 20]], fc)
    const pathGenerator = d3.geoPath().projection(projection)

    const maxVal = Math.max(1, ...contagemPorId.values())
    const scale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal])

    return { pathGen: pathGenerator, colorScale: scale, features: continente }
  }, [geoData, contagemPorId])

  /* ---------- Hover State ---------- */
  const [hoveredMunicipio, setHoveredMunicipio] = useState<{ id: number; nome: string; count: number; x: number; y: number } | null>(null)

  /* ---------- Loading / Erro ---------- */
  if (loadingMapa || loadingEleitores) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Carregando mapa de Pernambuco...
          </p>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-red-500 font-medium">❌ {erro}</p>
      </div>
    )
  }

  const maxCount = bairrosFiltrados.length > 0 ? bairrosFiltrados[0].count : 1
  const cidadesComVotos = [...contagemPorCidade.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Mapa de Força — Pernambuco 🗺️
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Visualize a concentração de eleitores cadastrados por município.
          {cidadeSelecionada && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              Filtrando: {cidadeSelecionada}
              <button
                onClick={() => setCidadeSelecionada(null)}
                className="ml-1 hover:text-red-500 transition"
              >
                ✕
              </button>
            </span>
          )}
        </p>
      </div>

      {/* Stats rápidas */}
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
        {/* Mapa SVG */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="relative w-full overflow-hidden h-[60vh] sm:h-[500px]">
            <svg
              ref={svgRef}
              className="w-full h-full"
              viewBox="0 0 800 500"
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredMunicipio(null)}
            >
              {pathGen && colorScale && features.map((feature: any, i: number) => {
                const codIBGE = Number(feature.properties?.codarea || feature.properties?.CD_MUN || feature.id)
                const count = contagemPorId.get(codIBGE) || 0
                const nome = nomesMap.get(codIBGE) || 'Desconhecido'
                const isHovered = hoveredMunicipio?.id === codIBGE
                
                return (
                  <path
                    key={i}
                    d={pathGen(feature) || ''}
                    fill={count > 0 ? colorScale(count) : '#cbd5e1'}
                    stroke={isHovered ? '#0f172a' : '#ffffff'}
                    strokeWidth={isHovered ? 1.8 : 0.7}
                    className="cursor-pointer transition-colors duration-200"
                    onMouseEnter={(e) => {
                      const svgRect = svgRef.current?.getBoundingClientRect()
                      if (!svgRect) return
                      setHoveredMunicipio({
                        id: codIBGE,
                        nome,
                        count,
                        x: e.clientX - svgRect.left + 12,
                        y: e.clientY - svgRect.top - 30
                      })
                    }}
                    onMouseMove={(e) => {
                      const svgRect = svgRef.current?.getBoundingClientRect()
                      if (!svgRect) return
                      setHoveredMunicipio((prev) => prev ? { ...prev, x: e.clientX - svgRect.left + 12, y: e.clientY - svgRect.top - 30 } : null)
                    }}
                    onClick={() => {
                      if (cidadeSelecionada === nome) setCidadeSelecionada(null)
                      else setCidadeSelecionada(nome)
                    }}
                  />
                )
              })}
            </svg>
            
            {/* Tooltip renderizado com React */}
            {hoveredMunicipio && (
              <div
                className="pointer-events-none absolute rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-xl border border-slate-700 z-50"
                style={{ 
                  left: hoveredMunicipio.x, 
                  top: hoveredMunicipio.y,
                  whiteSpace: 'nowrap'
                }}
              >
                <strong>{hoveredMunicipio.nome}</strong><br/>
                {hoveredMunicipio.count} eleitor{hoveredMunicipio.count !== 1 ? 'es' : ''}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">0</span>
            <div
              className="h-3 flex-1 rounded-full"
              style={{
                background: 'linear-gradient(to right, #e2e8f0, #ffffcc, #feb24c, #f03b20, #bd0026)',
              }}
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {Math.max(1, ...contagemPorId.values())}
            </span>
            <span className="text-[10px] text-slate-400">eleitores</span>
          </div>
        </div>

        {/* Sidebar: Rankings */}
        <div className="flex flex-col gap-6">
          {/* Top Municípios */}
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
                    onClick={() =>
                      setCidadeSelecionada(isSelected ? null : cidade)
                    }
                    className={`w-full text-left rounded-lg p-2.5 transition ${
                      isSelected
                        ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950 dark:ring-brand-400'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                        {cidade}
                      </span>
                      <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
              {cidadesComVotos.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  Nenhum eleitor cadastrado ainda.
                </p>
              )}
            </div>
          </div>

          {/* Bairros quentes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[400px]">
            <h2 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">
              🔥 Bairros Quentes
              {cidadeSelecionada && (
                <span className="ml-2 text-xs font-medium text-slate-400">
                  em {cidadeSelecionada}
                </span>
              )}
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
              {bairrosFiltrados.slice(0, 20).map((item) => {
                const pct = Math.max(0, Math.min(100, (item.count / maxCount) * 100))
                const intensity = 0.15 + (pct * 0.85) / 100
                return (
                  <div
                    key={`${item.cidade}-${item.bairro}`}
                    className="relative flex items-center justify-between rounded-lg p-2.5 overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-red-500 dark:bg-red-600 pointer-events-none transition-opacity rounded-lg"
                      style={{ opacity: intensity }}
                    />
                    <div className="relative z-10">
                      <p
                        className={`text-sm font-bold ${
                          pct > 55
                            ? 'text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.bairro}
                      </p>
                      {!cidadeSelecionada && (
                        <p
                          className={`text-[11px] font-medium ${
                            pct > 55
                              ? 'text-red-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.cidade}
                        </p>
                      )}
                    </div>
                    <span
                      className={`relative z-10 text-base font-black ${
                        pct > 55
                          ? 'text-white'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                )
              })}
              {bairrosFiltrados.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  {cidadeSelecionada
                    ? 'Nenhum bairro cadastrado nessa cidade.'
                    : 'Nenhum bairro cadastrado ainda.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Card de estatística                                               */
/* ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
        {value.toLocaleString('pt-BR')}
      </p>
      {sub && (
        <p className="text-xs font-medium text-brand-500 dark:text-brand-400 truncate">
          {sub}
        </p>
      )}
    </div>
  )
}
