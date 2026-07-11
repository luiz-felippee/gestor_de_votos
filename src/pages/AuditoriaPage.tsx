import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatDataHora } from '../lib/format'
import type { LogAuditoria } from '../lib/types'
import { Shield, Filter, Database, User, Calendar, Info } from 'lucide-react'

const ACAO_STYLE: Record<string, string> = {
  criar: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
  editar: 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  excluir: 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50',
  anonimizar: 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
}

export function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtroAcao, setFiltroAcao] = useState('')

  useEffect(() => {
    api
      .getAuditoria()
      .then(setLogs)
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const logsFiltrados = filtroAcao
    ? logs.filter((l) => l.acao === filtroAcao)
    : logs

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-6 w-6 text-brand-500" />
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Log de Auditoria
            </h1>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Registro das últimas 300 ações — para rastreabilidade e conformidade com a LGPD.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Todas as Ações</option>
            <option value="criar">Criar</option>
            <option value="editar">Editar</option>
            <option value="excluir">Excluir</option>
            <option value="anonimizar">Anonimizar</option>
          </select>
        </div>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400">
          {erro}
        </div>
      )}

      {/* Cards no mobile */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-slate-400">Carregando...</p>
        ) : logsFiltrados.length === 0 ? (
          <p className="py-8 text-center text-slate-400">Nenhuma ação registrada encontrada.</p>
        ) : (
          logsFiltrados.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <User className="h-4 w-4 text-slate-400" />
                  {l.usuario_nome ?? '—'}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    ACAO_STYLE[l.acao] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {l.acao}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-sm capitalize text-slate-700 dark:text-slate-300">
                <Database className="h-4 w-4 text-slate-400" />
                {l.entidade}
              </p>
              {l.detalhe && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{l.detalhe}</span>
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
                <Calendar className="h-3.5 w-3.5" />
                {formatDataHora(l.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Tabela no desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-5 py-4">Data / Hora</th>
              <th className="px-5 py-4">Usuário</th>
              <th className="px-5 py-4">Ação</th>
              <th className="px-5 py-4">Item</th>
              <th className="px-5 py-4">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              // Skeletons Animados
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-200 dark:text-slate-800" />
                      <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-200 dark:text-slate-800" />
                      <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-200 dark:text-slate-800" />
                      <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-200 dark:text-slate-800" />
                      <div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </td>
                </tr>
              ))
            ) : logsFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  Nenhuma ação registrada encontrada.
                </td>
              </tr>
            ) : (
              logsFiltrados.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition dark:hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {formatDataHora(l.created_at)}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      {l.usuario_nome ?? '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        ACAO_STYLE[l.acao] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {l.acao}
                    </span>
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-400" />
                      {l.entidade}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl">{l.detalhe ?? '—'}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
