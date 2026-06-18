import { Suspense, lazy, useState } from 'react'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { api } from '../lib/api'
import { CIDADES } from '../lib/constants'

// Gráficos (recharts) em chunk separado — o painel pinta KPIs/perfil na hora.
const DashboardCharts = lazy(() => import('../components/DashboardCharts'))

export function DashboardPage() {
  const [filtroCidade, setFiltroCidade] = useState('')
  const { stats, loading } = useDashboardStats(filtroCidade)

  if (loading || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
        {/* Skeleton do header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="h-9 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
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
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <select
          value={filtroCidade}
          onChange={(e) => setFiltroCidade(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todas as cidades</option>
          {CIDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Perfil da Campanha */}
      {campanha && (campanha.foto_url || campanha.cargo_ultima_eleicao || campanha.ano_ultima_eleicao || campanha.votos_ultima_eleicao) && (
        <div className="mb-8 flex items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg className="w-48 h-48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          
          {campanha.foto_url ? (
            <img src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} alt="Candidato" className="h-24 w-24 sm:h-32 sm:w-32 rounded-full object-cover border-4 border-brand-100 dark:border-brand-900/50 shadow-md" />
          ) : (
            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
          )}
          
          <div className="flex-1 z-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-tight">
              {campanha.nome}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
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
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total de eleitores" valor={kpis.totalEleitores} />
        <Kpi titulo="Cidades alcançadas" valor={kpis.totalCidades} />
        <Kpi titulo="Bairros alcançados" valor={kpis.totalBairros} />
        <Kpi titulo="Cabos ativos" valor={kpis.totalCabos} />
      </div>

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
      <Painel titulo="Ranking de cabos (meta vs. realizado)" className="mt-6">
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum cabo cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((r, i) => {
              const pct =
                r.meta > 0 ? Math.min(100, Math.round((r.total / r.meta) * 100)) : 0
              return (
                <div key={r.nome} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-semibold text-slate-400">
                    {i + 1}º
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{r.nome}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {r.total} / {r.meta || '—'}
                        {r.meta > 0 && (
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{pct}%</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${r.meta > 0 ? pct : r.total > 0 ? 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Painel>

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

    </div>
  )
}

function Kpi({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{valor}</p>
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
