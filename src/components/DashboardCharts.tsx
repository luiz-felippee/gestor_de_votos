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

const CORES_ZONA = ['#6366f1', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#10b981', '#3b82f6', '#eab308', '#64748b', '#a855f7']

interface Fatia {
  label: string
  total: number
}

interface Props {
  porCidade: Fatia[]
  porLocalVotacao: Fatia[]
  porBairro: Fatia[]
  porDia: Fatia[]
  totalEleitores: number
}

// Gráficos pesados (recharts) carregados em um chunk separado para o painel
// inicial pintar os KPIs/perfil na hora, sem esperar a biblioteca de gráficos.
export default function DashboardCharts({ porCidade, porLocalVotacao, porBairro, porDia, totalEleitores }: Props) {
  return (
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
              <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{totalEleitores}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">total</span>
            </div>
          </div>

          {/* Legenda lateral */}
          <div className="flex-1 w-full min-w-0 space-y-2.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {porLocalVotacao.map((z, i) => {
              const pct = totalEleitores > 0 ? Math.round((z.total / totalEleitores) * 100) : 0
              const color = z.label === 'Outros locais' ? '#475569' : CORES_ZONA[i % CORES_ZONA.length]

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
  )
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">{titulo}</h2>
      {children}
    </div>
  )
}
