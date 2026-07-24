import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { EmptyState } from './EmptyState'
import { Users } from 'lucide-react'
import type { RankingLiderancaItem } from '../lib/types'

interface Props {
  ranking: RankingLiderancaItem[]
}

const MEDALHA = ['🥇', '🥈', '🥉']

/**
 * Ranking geral de lideranças com indicador de TENDÊNCIA: compara a posição de
 * agora com a de 7 dias atrás (calculado no backend a partir do created_at dos
 * eleitores — sem precisar de uma tabela de histórico). A linha do próprio
 * usuário logado (voce=true) fica destacada e sempre visível.
 */
export function RankingComTendencia({ ranking }: Props) {
  if (ranking.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma liderança nesse recorte"
        description="Troque o filtro de município/região ou aguarde os primeiros cadastros aparecerem aqui."
      />
    )
  }

  return (
    <div className="space-y-2">
      {ranking.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
            item.voce
              ? 'border-brand-300 bg-brand-50 shadow-sm dark:border-brand-500/40 dark:bg-brand-500/10'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          {/* Posição */}
          <div className="flex w-8 shrink-0 items-center justify-center text-lg font-black">
            {item.posicao <= 3 ? MEDALHA[item.posicao - 1] : (
              <span className="text-sm text-slate-400 dark:text-slate-500">{item.posicao}º</span>
            )}
          </div>

          {/* Foto */}
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm dark:border-slate-700">
            <img
              src={resolverFotoUrl(item.foto_url, `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome)}&background=random`)!}
              alt={item.nome}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome)}&background=random`
              }}
            />
          </div>

          {/* Nome + cidade */}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-bold ${item.voce ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-100'}`}>
              {item.nome} {item.voce && <span className="text-xs font-semibold text-brand-500">(você)</span>}
            </p>
            {item.cidade && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{item.cidade}</p>}
          </div>

          {/* Total */}
          <div className="shrink-0 text-right">
            <p className="text-base font-black text-slate-800 dark:text-white">{item.total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">cadastros</p>
          </div>

          {/* Tendência (7 dias) */}
          <div className="flex w-14 shrink-0 flex-col items-center justify-center">
            {item.tendencia === 'subiu' && (
              <>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{item.delta}</span>
              </>
            )}
            {item.tendencia === 'desceu' && (
              <>
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">-{item.delta}</span>
              </>
            )}
            {item.tendencia === 'manteve' && (
              <Minus className="h-5 w-5 text-slate-300 dark:text-slate-600" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Reexporta pra quem só precisa do ícone de topo (ex.: cabeçalho da seção).
export { Trophy as IconeRanking }
