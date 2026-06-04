import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useEleitores } from '../hooks/useEleitores'
import { CIDADES, STATUS_OPTIONS, STATUS_STYLES } from '../lib/constants'
import { formatDataHora, maskTelefone } from '../lib/format'
import { exportarCSV, exportarXLSX } from '../lib/export'
import type { EleitorComCabo, StatusEleitor } from '../lib/types'

type Coluna =
  | 'nome'
  | 'telefone'
  | 'local_votacao'
  | 'zona'
  | 'secao'
  | 'bairro'
  | 'cidade'
  | 'status'
  | 'created_at'

interface Ordenacao {
  campo: Coluna
  dir: 'asc' | 'desc'
}

export function PlanilhaPage() {
  const { eleitores, loading, erro, recarregar } = useEleitores()

  const [busca, setBusca] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [ordem, setOrdem] = useState<Ordenacao>({
    campo: 'created_at',
    dir: 'desc',
  })

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EleitorComCabo>>({})

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let lista = eleitores.filter((e) => {
      const correspondeBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        e.bairro.toLowerCase().includes(termo) ||
        e.cidade.toLowerCase().includes(termo) ||
        (e.cabo?.nome ?? '').toLowerCase().includes(termo)
      const correspondeCidade = !filtroCidade || e.cidade === filtroCidade
      const correspondeStatus = !filtroStatus || e.status === filtroStatus
      return correspondeBusca && correspondeCidade && correspondeStatus
    })

    lista = [...lista].sort((a, b) => {
      const va = a[ordem.campo] ?? ''
      const vb = b[ordem.campo] ?? ''
      let cmp: number
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), 'pt-BR')
      return ordem.dir === 'asc' ? cmp : -cmp
    })
    return lista
  }, [eleitores, busca, filtroCidade, filtroStatus, ordem])

  function ordenarPor(campo: Coluna) {
    setOrdem((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' },
    )
  }

  function iniciarEdicao(e: EleitorComCabo) {
    setEditId(e.id)
    setEditForm({ ...e })
  }

  async function salvarEdicao() {
    if (!editId) return
    try {
      await api.updateEleitor(editId, {
        nome: editForm.nome,
        telefone: editForm.telefone,
        local_votacao: editForm.local_votacao,
        zona: Number(editForm.zona),
        secao: Number(editForm.secao),
        bairro: editForm.bairro,
        cidade: editForm.cidade,
        status: editForm.status as StatusEleitor,
        observacoes: editForm.observacoes,
      })
      recarregar()
    } catch (err) {
      alert(`Erro ao salvar: ${(err as Error).message}`)
      return
    }
    setEditId(null)
    setEditForm({})
  }

  async function excluir(e: EleitorComCabo) {
    if (!confirm(`Excluir o cadastro de "${e.nome}"?`)) return
    try {
      await api.deleteEleitor(e.id)
      recarregar()
    } catch (err) {
      alert(`Erro ao excluir: ${(err as Error).message}`)
    }
  }

  function setCampo<K extends keyof EleitorComCabo>(
    campo: K,
    valor: EleitorComCabo[K],
  ) {
    setEditForm((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Planilha de Votação
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {listaFiltrada.length} de {eleitores.length} eleitores
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              tempo real
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => exportarXLSX(listaFiltrada)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-brand-500 hover:text-brand-600 hover:shadow-md active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-400"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => exportarCSV(listaFiltrada)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-brand-500 hover:text-brand-600 hover:shadow-md active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-400"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, bairro, cidade ou cabo..."
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        <select
          value={filtroCidade}
          onChange={(e) => setFiltroCidade(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todas as cidades</option>
          {CIDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <Th col="nome" ordem={ordem} onClick={ordenarPor}>
                Nome
              </Th>
              <Th col="telefone" ordem={ordem} onClick={ordenarPor}>
                Telefone
              </Th>
              <Th col="local_votacao" ordem={ordem} onClick={ordenarPor}>
                Local
              </Th>
              <Th col="zona" ordem={ordem} onClick={ordenarPor}>
                Zona
              </Th>
              <Th col="secao" ordem={ordem} onClick={ordenarPor}>
                Seção
              </Th>
              <Th col="bairro" ordem={ordem} onClick={ordenarPor}>
                Bairro
              </Th>
              <Th col="cidade" ordem={ordem} onClick={ordenarPor}>
                Cidade
              </Th>
              <th className="px-3 py-3">Cabo</th>
              <Th col="status" ordem={ordem} onClick={ordenarPor}>
                Status
              </Th>
              <Th col="created_at" ordem={ordem} onClick={ordenarPor}>
                Cadastro
              </Th>
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                  Nenhum eleitor encontrado.
                </td>
              </tr>
            ) : (
              listaFiltrada.map((e) =>
                editId === e.id ? (
                  <tr key={e.id} className="bg-brand-50/50">
                    <Td>
                      <input
                        className={editInput}
                        value={editForm.nome ?? ''}
                        onChange={(ev) => setCampo('nome', ev.target.value)}
                      />
                    </Td>
                    <Td>
                      <input
                        className={editInput}
                        value={editForm.telefone ?? ''}
                        onChange={(ev) =>
                          setCampo('telefone', maskTelefone(ev.target.value))
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        className={editInput}
                        value={editForm.local_votacao ?? ''}
                        onChange={(ev) =>
                          setCampo('local_votacao', ev.target.value)
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        className={`${editInput} w-16`}
                        value={editForm.zona ?? ''}
                        onChange={(ev) =>
                          setCampo('zona', Number(ev.target.value))
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        className={`${editInput} w-16`}
                        value={editForm.secao ?? ''}
                        onChange={(ev) =>
                          setCampo('secao', Number(ev.target.value))
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        className={editInput}
                        value={editForm.bairro ?? ''}
                        onChange={(ev) => setCampo('bairro', ev.target.value)}
                      />
                    </Td>
                    <Td>
                      <select
                        className={editInput}
                        value={editForm.cidade ?? ''}
                        onChange={(ev) => setCampo('cidade', ev.target.value)}
                      >
                        {CIDADES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>{e.cabo?.nome ?? '—'}</Td>
                    <Td>
                      <select
                        className={editInput}
                        value={editForm.status ?? 'ativo'}
                        onChange={(ev) =>
                          setCampo('status', ev.target.value as StatusEleitor)
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>{formatDataHora(e.created_at)}</Td>
                    <Td className="text-right">
                      <button
                        onClick={salvarEdicao}
                        className="mr-2 font-medium text-green-600 hover:underline"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="font-medium text-slate-500 hover:underline dark:text-slate-400"
                      >
                        Cancelar
                      </button>
                    </Td>
                  </tr>
                ) : (
                  <tr
                    key={e.id}
                    className="group border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <Td className="font-medium text-slate-800 dark:text-slate-200">{e.nome}</Td>
                    <Td className="dark:text-slate-300">{e.telefone}</Td>
                    <Td className="dark:text-slate-300">{e.local_votacao}</Td>
                    <Td className="dark:text-slate-300">{e.zona}</Td>
                    <Td className="dark:text-slate-300">{e.secao}</Td>
                    <Td className="dark:text-slate-300">{e.bairro}</Td>
                    <Td className="dark:text-slate-300">{e.cidade}</Td>
                    <Td className="dark:text-slate-300">{e.cabo?.nome ?? '—'}</Td>
                    <Td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}
                      >
                        {e.status}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">
                      {formatDataHora(e.created_at)}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <button
                        onClick={() => iniciarEdicao(e)}
                        className="mr-2 font-medium text-brand-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => excluir(e)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </Td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const editInput =
  'w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

function Th({
  col,
  ordem,
  onClick,
  children,
}: {
  col: Coluna
  ordem: Ordenacao
  onClick: (c: Coluna) => void
  children: React.ReactNode
}) {
  const ativo = ordem.campo === col
  return (
    <th
      onClick={() => onClick(col)}
      className="cursor-pointer select-none px-3 py-3 hover:text-slate-700"
    >
      {children}
      <span className="ml-1 text-[10px]">
        {ativo ? (ordem.dir === 'asc' ? '▲' : '▼') : ''}
      </span>
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>
}
