import { useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { CIDADES } from '../lib/constants'
const CORES_ZONA = ['#6366f1', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#10b981', '#3b82f6', '#eab308', '#64748b', '#a855f7']

export function DashboardPage() {
  const [filtroCidade, setFiltroCidade] = useState('')
  const { stats, loading } = useDashboardStats(filtroCidade)

  if (loading || !stats) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
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

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total de eleitores" valor={kpis.totalEleitores} />
        <Kpi titulo="Cidades alcançadas" valor={kpis.totalCidades} />
        <Kpi titulo="Bairros alcançados" valor={kpis.totalBairros} />
        <Kpi titulo="Cabos ativos" valor={kpis.totalCabos} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Eleitores por cidade">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porCidade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cidadeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'currentColor' }} tickLine={false} axisLine={false} opacity={0.6} dy={10} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'currentColor' }} tickLine={false} axisLine={false} opacity={0.6} />
              <Tooltip
                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.92)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  padding: '8px 14px',
                }}
                formatter={(value: any) => [`${value} eleitores`, '']}
              />
              <Bar 
                dataKey="total" 
                fill="url(#cidadeGrad)" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Distribuição por local de votação">
          <div className="flex flex-col xl:flex-row items-center gap-6">
            <div className="relative flex-shrink-0" style={{ width: 220, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {CORES_ZONA.map((cor, i) => (
                      <linearGradient key={i} id={`zonaGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={cor} stopOpacity={1} />
                        <stop offset="100%" stopColor={cor} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={porLocalVotacao}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {porLocalVotacao.map((entry, i) => (
                      <Cell key={i} fill={entry.label === 'Outros locais' ? '#475569' : `url(#zonaGrad${i % CORES_ZONA.length})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      padding: '8px 14px',
                    }}
                    formatter={(value: any) => [`${value} eleitores`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Número total no centro (perfeitamente centralizado) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{kpis.totalEleitores}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">total</span>
              </div>
            </div>

            {/* Legenda lateral */}
            <div className="flex-1 w-full min-w-0 space-y-2.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {porLocalVotacao.map((z, i) => {
                const pct = kpis.totalEleitores > 0 ? Math.round((z.total / kpis.totalEleitores) * 100) : 0
                const color = z.label === 'Outros locais' ? '#475569' : CORES_ZONA[i % CORES_ZONA.length];
                
                return (
                  <div key={z.label} className="flex items-center gap-3 group">
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] leading-tight font-medium text-slate-700 dark:text-slate-300 truncate" title={z.label}>
                          {z.label}
                        </span>
                        <span className="text-xs tabular-nums font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                          {z.total}
                          <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500">({pct}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {porLocalVotacao.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">Nenhum dado disponível</p>
              )}
            </div>
          </div>
        </Painel>

        <Painel titulo="Top 10 bairros">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porBairro} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" strokeOpacity={0.06} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'currentColor' }} tickLine={false} axisLine={false} opacity={0.5} />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 12, fill: 'currentColor', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                opacity={0.8}
              />
              <Tooltip
                cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.92)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  padding: '8px 14px',
                }}
                formatter={(value: any) => [`${value} eleitores`, '']}
              />
              <Bar 
                dataKey="total" 
                fill="url(#barGrad)" 
                radius={[0, 6, 6, 0]} 
                barSize={20}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Cadastros por dia">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={porDia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12, fill: 'currentColor' }} 
                tickLine={false}
                axisLine={false}
                dy={10}
                opacity={0.6}
              />
              <YAxis 
                allowDecimals={false} 
                tick={{ fontSize: 12, fill: 'currentColor' }} 
                tickLine={false}
                axisLine={false}
                opacity={0.6}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: 'none', 
                  borderRadius: '8px', 
                  color: '#fff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
                activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Painel>
      </div>

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
