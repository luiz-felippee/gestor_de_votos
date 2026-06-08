import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatDataHora } from '../lib/format'
import type { LogAuditoria } from '../lib/types'

const ACAO_STYLE: Record<string, string> = {
  criar: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  editar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  excluir: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  anonimizar:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api
      .getAuditoria()
      .then(setLogs)
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Log de Auditoria
      </h1>
      <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
        Registro das últimas 300 ações (criação, edição, exclusão e anonimização)
        — para rastreabilidade e conformidade com a LGPD.
      </p>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhuma ação registrada ainda.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDataHora(l.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {l.usuario_nome ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ACAO_STYLE[l.acao] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {l.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                    {l.entidade}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.detalhe ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
