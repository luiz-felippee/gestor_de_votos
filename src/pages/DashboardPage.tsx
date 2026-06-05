import { useMemo, useState } from 'react'
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
import { useEleitores } from '../hooks/useEleitores'
import { useCabos } from '../hooks/useCabos'
import { CIDADES } from '../lib/constants'

const CORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

export function DashboardPage() {
  const { eleitores } = useEleitores()
  const { cabos } = useCabos()
  const [filtroCidade, setFiltroCidade] = useState('')

  const lista = useMemo(
    () =>
      filtroCidade ? eleitores.filter((e) => e.cidade === filtroCidade) : eleitores,
    [eleitores, filtroCidade],
  )

  const porCidade = useMemo(() => agrupar(lista, (e) => e.cidade), [lista])
  const porBairro = useMemo(
    () => agrupar(lista, (e) => {
      if (!e.bairro) return '—'
      // Normaliza para Capitalizar as palavras e evitar que "centro" e "Centro" separem
      return e.bairro
        .trim()
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
    }).slice(0, 10),
    [lista],
  )
  const porZona = useMemo(
    () => agrupar(lista, (e) => `Zona ${e.zona}`),
    [lista],
  )
  const porDia = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of lista) {
      const dia = e.created_at.slice(0, 10)
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1)
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, total]) => ({
        label: dia.slice(8, 10) + '/' + dia.slice(5, 7),
        total,
      }))
  }, [lista])

  const ranking = useMemo(() => {
    const realizado = new Map<string, number>()
    for (const e of lista) {
      if (e.cabo_id) realizado.set(e.cabo_id, (realizado.get(e.cabo_id) ?? 0) + 1)
    }
    return cabos
      .map((c) => ({
        nome: c.nome,
        meta: c.meta_eleitores || 0,
        total: realizado.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [lista, cabos])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <select
          value={filtroCidade}
          onChange={(e) => setFiltroCidade(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
        <Kpi titulo="Total de eleitores" valor={lista.length} />
        <Kpi titulo="Cidades alcançadas" valor={porCidade.length} />
        <Kpi titulo="Bairros alcançados" valor={agrupar(lista, (e) => e.bairro).length} />
        <Kpi titulo="Cabos ativos" valor={cabos.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Eleitores por cidade">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porCidade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Distribuição por zona eleitoral">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={porZona}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(props) => (props as { label?: string }).label ?? ''}
              >
                {porZona.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Top 10 bairros">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porBairro} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="total" fill="#16a34a" radius={[0, 4, 4, 0]} />
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
    </div>
  )
}

/** Conta ocorrências por chave e devolve [{ label, total }] ordenado desc. */
function agrupar<T>(itens: T[], chave: (item: T) => string) {
  const mapa = new Map<string, number>()
  for (const item of itens) {
    const k = chave(item) || '—'
    mapa.set(k, (mapa.get(k) ?? 0) + 1)
  }
  return [...mapa.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
}

function Kpi({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">{valor}</p>
    </div>
  )
}

function Painel({
  titulo,
  children,
  className = '',
}: {
  titulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <h2 className="mb-4 text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
      {children}
    </div>
  )
}
