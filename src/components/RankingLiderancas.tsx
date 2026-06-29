import { Trophy, Medal } from 'lucide-react'
import { api } from '../lib/api'

interface Props {
  ranking: { id: string; nome: string; meta: number; total: number; foto_url?: string | null }[]
}

export function RankingLiderancas({ ranking }: Props) {
  const top5 = ranking.slice(0, 5)

  if (top5.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 mt-6">
        <Trophy className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nenhuma liderança cadastrada ainda.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden mt-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">Ranking de Lideranças</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Top 5 maiores recrutadores</p>
        </div>
      </div>

      <div className="space-y-4">
        {top5.map((cabo, index) => {
          const eleitores = cabo.total || 0
          const meta = cabo.meta || 1 // evita divisão por zero
          const porcentagem = Math.min(100, Math.round((eleitores / meta) * 100))
          
          let medalColor = 'text-slate-400'
          if (index === 0) medalColor = 'text-yellow-500' // Ouro
          if (index === 1) medalColor = 'text-slate-300' // Prata
          if (index === 2) medalColor = 'text-amber-700' // Bronze

          return (
            <div key={cabo.id} className="group relative flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:bg-slate-50 dark:border-slate-800/50 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
              
              {/* Posição / Medalha */}
              <div className="flex w-8 flex-col items-center justify-center font-black">
                {index < 3 ? (
                  <Medal className={`h-7 w-7 ${medalColor}`} />
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">{index + 1}º</span>
                )}
              </div>

              {/* Foto do Cabo */}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm dark:border-slate-700">
                {cabo.foto_url ? (
                  <img 
                    src={cabo.foto_url.startsWith('http') ? cabo.foto_url : `${api.base}${cabo.foto_url}`} 
                    alt={cabo.nome} 
                    className="h-full w-full object-cover" 
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(cabo.nome)}&background=random`;
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
                    <span className="font-bold">{cabo.nome.charAt(0)}</span>
                  </div>
                )}
              </div>

              {/* Nome e Barra de Progresso */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={cabo.nome}>
                    {cabo.nome}
                  </h4>
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                    <span>{eleitores}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-[10px]">/ {cabo.meta}</span>
                  </div>
                </div>
                
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div 
                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${
                      porcentagem >= 100 ? 'bg-green-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.max(2, porcentagem)}%` }} // min 2% pra aparecer a barra
                  />
                </div>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
