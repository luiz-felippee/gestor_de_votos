import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface Fatia {
  label: string
  total: number
}

interface Props {
  porCidade: Fatia[]

  porBairro: Fatia[]
  porDia: Fatia[]
}

// Gráficos pesados (recharts) carregados em um chunk separado para o painel
// inicial pintar os KPIs/perfil na hora, sem esperar a biblioteca de gráficos.
export default function DashboardCharts({ porCidade, porBairro, porDia }: Props) {

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
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                padding: '10px 16px',
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
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                padding: '10px 16px',
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
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                padding: '10px 16px',
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
