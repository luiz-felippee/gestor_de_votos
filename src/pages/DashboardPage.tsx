import { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react'
import { OnboardingModal } from '../components/OnboardingModal'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { api } from '../lib/api'
import { CIDADES } from '../lib/constants'
import { RankingLiderancas } from '../components/RankingLiderancas'
import { MapaEstrategico } from '../components/MapaEstrategico'
import { useEleitores } from '../hooks/useEleitores'
import { useCabos } from '../hooks/useCabos'
import { useConfirm } from '../components/ConfirmDialog'
import { Map as MapIcon } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useTheme } from '../components/ThemeProvider'

// Gráficos (recharts) em chunk separado — o painel pinta KPIs/perfil na hora.
const DashboardCharts = lazy(() => import('../components/DashboardCharts'))

/* ---- Helpers ---- */
function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface BairroItem {
  cidade: string
  bairro: string
  count: number
}

export function DashboardPage() {
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('') // '' = todos
  const [caboFiltro, setCaboFiltro] = useState('')
  const { stats, loading } = useDashboardStats(filtroCidade, filtroPeriodo)
  const { eleitores: todosEleitores } = useEleitores()
  const { cabos } = useCabos()
  const { alert } = useConfirm()
  const { theme } = useTheme()
  const mapaRef = useRef<HTMLDivElement>(null)

  // Estado para o mapa
  const [modoMapa, setModoMapa] = useState<'calor' | 'mapa'>('calor')
  const [exportando, setExportando] = useState(false)

  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true'
    if (!loading && stats && stats.kpis.totalEleitores === 0 && !hasSeenOnboarding) {
      setShowOnboarding(true)
    }
  }, [loading, stats])

  // Filtra eleitores por cabo e período (para o mapa e painéis laterais)
  const eleitores = useMemo(() => {
    let lista = todosEleitores
    if (caboFiltro) lista = lista.filter((e) => e.cabo_id === caboFiltro)
    if (filtroPeriodo) {
      const limite = Date.now() - Number(filtroPeriodo) * 24 * 60 * 60 * 1000
      lista = lista.filter((e) => new Date(e.created_at).getTime() >= limite)
    }
    if (filtroCidade) {
      const cidadeNorm = normalizar(filtroCidade)
      lista = lista.filter((e) => e.cidade && normalizar(e.cidade) === cidadeNorm)
    }
    return lista
  }, [todosEleitores, caboFiltro, filtroPeriodo, filtroCidade])

  // Agregações para painéis laterais
  const { contagemPorCidade, bairrosList } = useMemo(() => {
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

    return { contagemPorCidade: cidadeMap, bairrosList }
  }, [eleitores])

  const cidadesComVotos = [...contagemPorCidade.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const bairrosFiltrados = filtroCidade
    ? bairrosList.filter((b) => normalizar(b.cidade) === normalizar(filtroCidade))
    : bairrosList
  const maxBairro = bairrosFiltrados.length > 0 ? bairrosFiltrados[0].count : 1

  // Exportar imagem do mapa
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
      alert('Não foi possível exportar a imagem. Tente novamente.', 'Erro ao exportar')
    } finally {
      setExportando(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
        {/* Skeleton do header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="h-9 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="h-10 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-10 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        {/* Skeleton dos KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
        {/* Skeleton do mapa */}
        <div className="mb-6 h-[500px] rounded-2xl border border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40" />
        {/* Skeleton dos gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[320px] rounded-2xl border border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40" />
          ))}
        </div>
      </div>
    )
  }

  const {
    kpis,
    porCidade,
    porBairro,
    porLocalVotacao,
    porDia,
    ranking,
    aniversariantes,
    campanha,
  } = stats

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 animate-fade-in">
      {/* Header + Filtros */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <select
            value={filtroCidade}
            onChange={(e) => setFiltroCidade(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">Todas as cidades</option>
            {CIDADES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={caboFiltro}
            onChange={(e) => setCaboFiltro(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">Todos os cabos</option>
            {cabos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Perfil da Campanha */}
      {campanha && (campanha.foto_url || campanha.cargo_ultima_eleicao || campanha.ano_ultima_eleicao || campanha.votos_ultima_eleicao) && (
        <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg className="w-48 h-48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          
          {campanha.foto_url ? (
            <img 
              src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} 
              alt="Candidato" 
              className="h-20 w-20 sm:h-32 sm:w-32 rounded-full object-cover border-4 border-brand-100 dark:border-brand-900/50 shadow-md flex-shrink-0" 
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(campanha.nome)}&background=random`;
              }}
            />
          ) : (
            <div className="h-20 w-20 sm:h-32 sm:w-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
          )}
          
          <div className="flex-1 z-10 text-center sm:text-left">
            <h2 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white leading-tight">
              {campanha.nome}
            </h2>
            <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
              {campanha.cargo_ultima_eleicao && (
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  {campanha.cargo_ultima_eleicao}
                </span>
              )}
              {campanha.ano_ultima_eleicao && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Última Eleição: {campanha.ano_ultima_eleicao}
                </span>
              )}
              {campanha.votos_ultima_eleicao && (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  Votos: {campanha.votos_ultima_eleicao.toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total de eleitores" valor={kpis.totalEleitores} />
        <Kpi titulo="Cidades alcançadas" valor={kpis.totalCidades} />
        <Kpi titulo="Bairros alcançados" valor={kpis.totalBairros} />
        <Kpi titulo="Cabos ativos" valor={kpis.totalCabos} />
      </div>

      {/* ========== Mapa de Força + Painéis Laterais ========== */}
      <div className="mb-6">
        {/* Barra de controles do mapa */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            🗺️ Mapa de Força
          </h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setModoMapa('calor')}
              className={`rounded-md px-3 py-1.5 transition ${modoMapa === 'calor' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              🔥 Calor
            </button>
            <button
              onClick={() => setModoMapa('mapa')}
              className={`rounded-md px-3 py-1.5 transition ${modoMapa === 'mapa' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              ▦ Áreas
            </button>
          </div>
          <button
            onClick={exportarImagem}
            disabled={exportando}
            className="sm:ml-auto rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {exportando ? 'Gerando...' : '⬇ Exportar imagem'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Mapa (2/3) */}
          <div ref={mapaRef} className="lg:col-span-2 -mx-4 sm:mx-0">
            <MapaEstrategico 
              eleitores={eleitores}
              cidadeSelecionada={filtroCidade || null}
              onCidadeSelect={(c) => setFiltroCidade(c || '')}
              modoVisualizacao={modoMapa}
              className="h-[360px] sm:h-[460px] lg:h-[520px] sm:rounded-2xl border-y sm:border border-slate-200 dark:border-slate-800"
            />
          </div>

          {/* Painéis laterais (1/3) */}
          <div className="flex flex-col gap-6">
            {/* Top Municípios */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-base font-bold text-slate-800 dark:text-slate-100">
                🏆 Top Municípios
              </h3>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                {cidadesComVotos.map(([cidade, count], idx) => {
                  const pct = (count / (cidadesComVotos[0]?.[1] || 1)) * 100
                  const isSelected = filtroCidade === cidade
                  return (
                    <button
                      key={cidade}
                      onClick={() => setFiltroCidade(isSelected ? '' : cidade)}
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

            {/* Bairros Quentes */}
            <div className="flex max-h-[340px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  🔥 Bairros Quentes
                  {filtroCidade && (
                    <span className="ml-2 text-xs font-medium text-slate-400">
                      em {filtroCidade}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    if (bairrosFiltrados.length === 0) return
                    const waypoints = bairrosFiltrados.slice(0, 8).map(b => `${b.bairro}, ${b.cidade}, PE`)
                    const dest = waypoints.pop()
                    const origin = waypoints.shift() || dest
                    const wpStr = waypoints.length > 0 ? `&waypoints=${waypoints.join('|')}` : ''
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin!)}&destination=${encodeURIComponent(dest!)}${wpStr}`, '_blank')
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  title="Gerar rota de visita no Google Maps"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Rota
                </button>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
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
                        {!filtroCidade && (
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

      {/* ========== Gráficos ========== */}
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40"
              />
            ))}
          </div>
        }
      >
        <DashboardCharts
          porCidade={porCidade}
          porLocalVotacao={porLocalVotacao}
          porBairro={porBairro}
          porDia={porDia}
          totalEleitores={kpis.totalEleitores}
        />
      </Suspense>

      {/* Ranking de cabos */}
      <RankingLiderancas ranking={ranking} />

      {/* Aniversariantes do Mês */}
      <Painel titulo="Próximos Aniversariantes (30 dias)" className="mt-6">
        {aniversariantes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum aniversariante próximo.</p>
        ) : (
          <div className="space-y-4">
            {aniversariantes.map(a => {
              const hoje = a.diffDias === 0
              const label = hoje 
                ? 'É HOJE!' 
                : a.diffDias === 1 
                  ? 'Amanhã' 
                  : `Em ${a.diffDias} dias`
                  
              const msg = encodeURIComponent(`Olá ${a.nome}, passando para te desejar um feliz aniversário! Muita paz, saúde e sucesso. 🎉`)
              const linkWhats = `https://wa.me/55${(a.telefone || '').replace(/\D/g, '')}?text=${msg}`

              return (
                <div key={a.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800/60">
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      {a.nome}
                      {hoje && <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">🎁 Hoje!</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dia {String(a.data_nascimento.split('-')[2]).padStart(2, '0')}/{String(a.data_nascimento.split('-')[1]).padStart(2, '0')} - {label}
                    </p>
                  </div>
                  {a.telefone && (
                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                      <a
                        href={linkWhats}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors ${
                          hoje 
                            ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Enviar Parabéns
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Painel>

      {showOnboarding && (
        <OnboardingModal onClose={() => {
          setShowOnboarding(false)
          localStorage.setItem('hasSeenOnboarding', 'true')
        }} />
      )}
    </div>
  )
}

function Kpi({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{titulo}</p>
      <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{valor}</p>
    </div>
  )
}

function Painel({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className || ''}`}>
      <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">{titulo}</h2>
      {children}
    </div>
  )
}
