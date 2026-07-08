import { Suspense, lazy, useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OnboardingModal } from '../components/OnboardingModal'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { CIDADES } from '../lib/constants'
import { RankingLiderancas } from '../components/RankingLiderancas'
import { useMapaPontos } from '../hooks/useMapaPontos'
import { useCabos } from '../hooks/useCabos'
import { useConfirm } from '../components/ConfirmDialog'
import { Map as MapIcon, Cake, User, CalendarDays, Users, MapPin, BadgeCheck, Flame, ChevronDown } from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'
import { SplashScreen } from '../components/layout/SplashScreen'
import { EmptyState } from '../components/EmptyState'
import { LazyMount } from '../components/LazyMount'

// Gráficos (recharts) em chunk separado — o painel pinta KPIs/perfil na hora.
const DashboardCharts = lazy(() => import('../components/DashboardCharts'))
// O Mapa é muito pesado para o carregamento inicial. Separamos em outro chunk.
const MapaEstrategico = lazy(() => import('../components/MapaEstrategico').then(m => ({ default: m.MapaEstrategico })))

export function DashboardPage() {
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('') // '' = todos
  const [caboFiltro, setCaboFiltro] = useState('')
  const { stats, loading } = useDashboardStats(filtroCidade, filtroPeriodo, caboFiltro)
  const { pontos: pontosGeo } = useMapaPontos(filtroCidade, filtroPeriodo, caboFiltro)
  const { cabos } = useCabos()
  const { alert } = useConfirm()
  const { theme } = useTheme()
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const mapaRef = useRef<HTMLDivElement>(null)

  // Estado para o mapa
  const [modoMapa, setModoMapa] = useState<'calor' | 'mapa'>('calor')
  const [exportando, setExportando] = useState(false)
  const [geo, setGeo] = useState<{ rodando: boolean; restantes: number | null }>({ rodando: false, restantes: null })

  // Preenche lat/lng dos cadastros pelo LOCAL DE VOTAÇÃO, em lotes (~1 req/s no Nominatim),
  // até não sobrar nenhum. O calor cai no local de votação, não no endereço.
  async function geolocalizarCadastros() {
    if (geo.rodando) return
    setGeo({ rodando: true, restantes: null })
    try {
      let anterior = Infinity
      for (let i = 0; i < 300; i++) {
        const r = await api.geocodificarEleitores()
        setGeo({ rodando: true, restantes: r.restantes })
        queryClient.invalidateQueries({ queryKey: ['mapa-pontos'] })
        if (r.restantes === 0) break
        if (r.restantes >= anterior && r.geocodificados === 0) break
        anterior = r.restantes
      }
      await alert('Cadastros posicionados no mapa pelo local de votação.', 'Geolocalização concluída')
    } catch {
      await alert('Não foi possível concluir agora. Tente novamente em instantes.', 'Erro na geolocalização')
    } finally {
      setGeo((s) => ({ rodando: false, restantes: s.restantes }))
    }
  }

  // Zera todos os lat/lng para regeocodificar pelo local de votação
  async function regeocodificarTodos() {
    if (geo.rodando) return
    try {
      const r = await api.regeocodificarEleitores()
      await alert(`${r.resetados} eleitores foram resetados. Agora clique em "Geolocalizar" para posicioná-los pelo local de votação.`, 'Regeocodificação')
      queryClient.invalidateQueries({ queryKey: ['mapa-pontos'] })
    } catch {
      await alert('Erro ao resetar coordenadas.', 'Erro')
    }
  }

  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true'
    if (!loading && stats && stats.kpis.totalEleitores === 0 && !hasSeenOnboarding) {
      setShowOnboarding(true)
    }
  }, [loading, stats])

  const isInitialLogin = useRef(sessionStorage.getItem('justLoggedIn') === 'true')

  useEffect(() => {
    if (stats) {
      sessionStorage.removeItem('justLoggedIn')
    }
  }, [stats])

  const cidadesComVotos = stats 
    ? [...stats.porCidade].sort((a, b) => b.total - a.total).slice(0, 10).map(x => [x.label, x.total] as [string, number])
    : []

  const bairrosFiltrados = stats ? stats.porBairro.map(x => ({ cidade: filtroCidade || '', bairro: x.label, count: x.total })) : []
  const maxBairro = bairrosFiltrados.length > 0 ? bairrosFiltrados[0].count : 1

  // Exportar imagem do mapa
  async function exportarImagem() {
    if (!mapaRef.current) return
    setExportando(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
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
    if (isInitialLogin.current) {
      return <SplashScreen />
    }
    
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
    porDia,
    ranking,
    aniversariantes,
    campanha,
  } = stats

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 animate-fade-in">
      {/* Header + Filtros */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarDays className="h-4 w-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
            </div>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-semibold text-slate-700 shadow-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
            >
              <option value="">Todo o período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-4 w-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
            </div>
            <select
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-semibold text-slate-700 shadow-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
            >
              <option value="">Todas as cidades</option>
              {CIDADES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Users className="h-4 w-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
            </div>
            <select
              value={caboFiltro}
              onChange={(e) => setCaboFiltro(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-semibold text-slate-700 shadow-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
            >
              <option value="">Todos os cabos</option>
              {cabos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>

        </div>
      </div>

      {/* Perfil da Campanha */}
      {campanha && (campanha.foto_url || campanha.cargo_ultima_eleicao || campanha.ano_ultima_eleicao || campanha.votos_ultima_eleicao) && (
        <div className="group relative mb-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-2xl overflow-hidden p-6 sm:p-8 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5">
          {/* Fundo premium */}
          <div className="absolute inset-0 bg-slate-900 dark:bg-slate-950 pointer-events-none">
            <div className="absolute -top-32 -left-24 h-[24rem] w-[24rem] rounded-full bg-brand-600/30 blur-[80px]" />
            <div className="absolute -bottom-32 -right-24 h-[24rem] w-[24rem] rounded-full bg-indigo-600/20 blur-[80px]" />
            <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
          </div>
          
          {campanha.foto_url ? (
            <img 
              src={resolverFotoUrl(campanha.foto_url)!} 
              alt="Candidato" 
              className="relative z-10 h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-slate-800/50 shadow-xl flex-shrink-0" 
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(campanha.nome)}&background=random`;
              }}
            />
          ) : (
            <div className="relative z-10 h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 border-2 border-slate-700/50 flex-shrink-0 backdrop-blur-sm">
              <User className="h-10 w-10 text-slate-500" />
            </div>
          )}
          
          <div className="relative z-10 flex-1 text-center sm:text-left">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
              {campanha.nome}
            </h2>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              {campanha.cargo_ultima_eleicao && (
                <span className="inline-flex items-center rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-bold text-brand-200 backdrop-blur-md border border-brand-500/30">
                  {campanha.cargo_ultima_eleicao}
                </span>
              )}
              {campanha.ano_ultima_eleicao && (
                <span className="inline-flex items-center rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-300 backdrop-blur-md border border-slate-700/50">
                  Última Eleição: {campanha.ano_ultima_eleicao}
                </span>
              )}
              {campanha.votos_ultima_eleicao && (
                <span className="inline-flex items-center rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 backdrop-blur-md border border-emerald-500/30">
                  Votos: {campanha.votos_ultima_eleicao.toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total de eleitores" valor={kpis.totalEleitores} icon={Users} colorClass="text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-400" />
        <Kpi titulo="Cidades alcançadas" valor={kpis.totalCidades} icon={MapIcon} colorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <Kpi titulo="Bairros alcançados" valor={kpis.totalBairros} icon={MapPin} colorClass="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400" />
        <Kpi titulo="Lideranças ativas" valor={kpis.totalCabos} icon={BadgeCheck} colorClass="text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400" />
      </div>

      {/* ========== Mapa de Força + Painéis Laterais ========== */}
      <div className="mb-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            Mapa de Força
          </h2>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportarImagem}
              disabled={exportando}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {exportando ? 'Gerando...' : 'Exportar Imagem'}
            </button>
            {role === 'admin' && (
              <>
                <button
                  onClick={geolocalizarCadastros}
                  disabled={geo.rodando}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm transition hover:bg-brand-100 active:scale-95 disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {geo.rodando
                    ? `Geolocalizando…${geo.restantes != null ? ` ${geo.restantes}` : ''}`
                    : 'Geolocalizar'}
                </button>
                <button
                  onClick={regeocodificarTodos}
                  disabled={geo.rodando}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm transition hover:bg-amber-100 active:scale-95 disabled:opacity-60 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                >
                  Regeocodificar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Mapa (2/3) */}
          <div className="lg:col-span-2 -mx-4 sm:mx-0 relative group">
            {/* Controles Flutuantes do Mapa - APENAS Calor/Áreas centralizado no rodapé */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] pointer-events-auto">
              <div className="inline-flex rounded-xl border border-slate-200/50 bg-white/90 backdrop-blur-md p-1.5 text-xs font-bold shadow-lg dark:border-slate-700/50 dark:bg-slate-900/90">
                <button
                  onClick={() => setModoMapa('calor')}
                  className={`rounded-lg px-4 py-2 transition ${modoMapa === 'calor' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
                >
                  Calor
                </button>
                <button
                  onClick={() => setModoMapa('mapa')}
                  className={`rounded-lg px-4 py-2 transition ${modoMapa === 'mapa' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
                >
                  Áreas
                </button>
              </div>
            </div>

            <div ref={mapaRef} className="h-full w-full bg-slate-100 dark:bg-slate-800 sm:rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
              <LazyMount 
                fallback={
                  <div className="h-[480px] sm:h-[560px] lg:h-[600px] animate-pulse flex items-center justify-center">
                    <span className="text-slate-400 font-medium">Carregando mapa...</span>
                  </div>
                }
                rootMargin="200px"
              >
                <Suspense
                  fallback={
                    <div className="h-[480px] sm:h-[560px] lg:h-[600px] animate-pulse flex items-center justify-center">
                      <span className="text-slate-400 font-medium">Processando mapa...</span>
                    </div>
                  }
                >
                  <MapaEstrategico 
                    pontosGeo={pontosGeo}
                    statsPorCidade={stats ? stats.porCidade : []}
                    cidadeSelecionada={filtroCidade || null}
                    onCidadeSelect={(c) => setFiltroCidade(c || '')}
                    modoVisualizacao={modoMapa}
                    className="h-[480px] sm:h-[560px] lg:h-[600px] w-full"
                  />
                </Suspense>
              </LazyMount>
            </div>
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
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 dark:from-brand-500 dark:to-brand-400"
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
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Bairros Quentes
                  {filtroCidade && (
                    <span className="ml-1 text-xs font-medium text-slate-400">
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
              <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {bairrosFiltrados.slice(0, 20).map((item) => {
                  const pct = Math.max(0, Math.min(100, (item.count / maxBairro) * 100))
                  return (
                    <div
                      key={`${item.cidade}-${item.bairro}`}
                      className="group flex items-center justify-between rounded-xl p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/10 transition-opacity"
                          style={{ opacity: 0.3 + (pct * 0.7) / 100 }}
                        >
                          <Flame className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 transition-colors group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-400">
                            {item.bairro}
                          </p>
                          {!filtroCidade && (
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {item.cidade}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
      <LazyMount
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
            porBairro={porBairro}
            porDia={porDia}
          />
        </Suspense>
      </LazyMount>

      {/* Ranking de cabos */}
      <RankingLiderancas ranking={ranking} />

      {/* Aniversariantes do Mês */}
      <Painel titulo="Próximos Aniversariantes (30 dias)" className="mt-6">
        {aniversariantes.length === 0 ? (
          <EmptyState
            icon={Cake}
            title="Nenhum aniversário próximo"
            description="Você não tem eleitores cadastrados que fazem aniversário nos próximos 30 dias."
            className="border-none bg-transparent"
          />
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
                <div key={a.id} className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md dark:bg-slate-900/50 dark:ring-slate-800">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${hoje ? 'bg-gradient-to-br from-rose-400 to-orange-400 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {hoje ? <Cake className="h-6 w-6" /> : <User className="h-6 w-6" />}
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {a.nome}
                        {hoje && <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 animate-pulse">Hoje! 🎉</span>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                        <CalendarDays className="h-4 w-4" />
                        {String(a.data_nascimento.split('-')[2]).padStart(2, '0')}/{String(a.data_nascimento.split('-')[1]).padStart(2, '0')}
                        <span className="mx-1 text-slate-300 dark:text-slate-700">•</span>
                        {label}
                      </p>
                    </div>
                  </div>
                  {a.telefone && (
                    <a
                      href={linkWhats}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                        hoje 
                          ? 'bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-lg shadow-[#25D366]/30' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {hoje ? 'Mandar Parabéns!' : 'Mensagem'}
                    </a>
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

function Kpi({ 
  titulo, 
  valor, 
  icon: Icon,
  colorClass 
}: { 
  titulo: string; 
  valor: number | string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{valor}</p>
        </div>
        <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-opacity-10 dark:bg-opacity-20 transition-transform group-hover:scale-110 ${colorClass}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
      <div className={`absolute -bottom-2 -right-2 h-16 w-16 rounded-full blur-2xl opacity-0 transition-opacity group-hover:opacity-40 ${colorClass.replace('text-', 'bg-').split(' ')[0]}`} />
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
