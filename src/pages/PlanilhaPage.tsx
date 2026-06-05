import { useMemo, useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useEleitores } from '../hooks/useEleitores'
import { CIDADES, STATUS_OPTIONS, STATUS_STYLES } from '../lib/constants'
import { formatDataHora, maskTelefone } from '../lib/format'
import { exportarCSV, exportarXLSX } from '../lib/export'
import { WhatsAppMenu } from '../components/WhatsAppMenu'
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

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 50

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EleitorComCabo>>({})

  // Reseta a página para 1 quando os filtros mudam
  useEffect(() => {
    setPaginaAtual(1)
  }, [busca, filtroCidade, filtroStatus])

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

  const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina)
  
  const listaPaginada = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    return listaFiltrada.slice(inicio, inicio + itensPorPagina)
  }, [listaFiltrada, paginaAtual])

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

  async function anonimizar(e: EleitorComCabo) {
    if (
      !confirm(
        `Anonimizar "${e.nome}"?\nOs dados pessoais (nome, telefone) serão apagados permanentemente, mantendo apenas a estatística (LGPD).`
      )
    )
      return
    try {
      await api.anonimizarEleitor(e.id)
      recarregar()
    } catch (err) {
      alert(`Erro ao anonimizar: ${(err as Error).message}`)
    }
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
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in flex flex-col h-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Planilha de Votação
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Exibindo {listaFiltrada.length} de {eleitores.length} eleitores cadastrados
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Sincronizado
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
      <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_200px_200px] items-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, bairro, cidade, cabo..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm font-medium outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
        <select
          value={filtroCidade}
          onChange={(e) => setFiltroCidade(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 border border-red-200">
          {erro}
        </div>
      )}

      {/* Tabela com Scroll */}
      <div className="flex-1 min-h-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="flex-1 overflow-auto relative">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-800/95 dark:text-slate-400">
              <tr>
                <Th col="nome" ordem={ordem} onClick={ordenarPor}>Nome</Th>
                <Th col="telefone" ordem={ordem} onClick={ordenarPor}>Telefone</Th>
                <Th col="local_votacao" ordem={ordem} onClick={ordenarPor}>Local / Zona / Seç.</Th>
                <Th col="bairro" ordem={ordem} onClick={ordenarPor}>Endereço</Th>
                <th className="px-3 py-3 font-semibold select-none">Indicação</th>
                <Th col="status" ordem={ordem} onClick={ordenarPor}>Status</Th>
                <Th col="created_at" ordem={ordem} onClick={ordenarPor}>Data Cad.</Th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-400 font-medium">Carregando planilha...</span>
                    </div>
                  </td>
                </tr>
              ) : listaPaginada.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-slate-400 font-medium">
                    <svg className="w-12 h-12 mx-auto text-slate-300 mb-3 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Nenhum eleitor encontrado na busca atual.
                  </td>
                </tr>
              ) : (
                listaPaginada.map((e) =>
                  editId === e.id ? (
                    <tr key={e.id} className="bg-brand-50/50 dark:bg-brand-900/10">
                      <Td>
                        <input className={editInput} value={editForm.nome ?? ''} onChange={(ev) => setCampo('nome', ev.target.value)} />
                      </Td>
                      <Td>
                        <input className={editInput} value={editForm.telefone ?? ''} onChange={(ev) => setCampo('telefone', maskTelefone(ev.target.value))} />
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <input className={`${editInput} flex-1`} placeholder="Local" value={editForm.local_votacao ?? ''} onChange={(ev) => setCampo('local_votacao', ev.target.value)} />
                          <input type="number" className={`${editInput} w-14`} placeholder="Z" value={editForm.zona ?? ''} onChange={(ev) => setCampo('zona', Number(ev.target.value))} />
                          <input type="number" className={`${editInput} w-14`} placeholder="S" value={editForm.secao ?? ''} onChange={(ev) => setCampo('secao', Number(ev.target.value))} />
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <input className={editInput} value={editForm.bairro ?? ''} onChange={(ev) => setCampo('bairro', ev.target.value)} />
                          <select className={editInput} value={editForm.cidade ?? ''} onChange={(ev) => setCampo('cidade', ev.target.value)}>
                            {CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </Td>
                      <Td className="text-slate-500 font-medium">{e.cabo?.nome ?? '—'}</Td>
                      <Td>
                        <select className={editInput} value={editForm.status ?? 'ativo'} onChange={(ev) => setCampo('status', ev.target.value as StatusEleitor)}>
                          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </Td>
                      <Td className="text-slate-500 text-xs">{formatDataHora(e.created_at)}</Td>
                      <Td className="text-right">
                        <div className="flex flex-col gap-2 items-end">
                          <button onClick={salvarEdicao} className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition">Salvar</button>
                          <button onClick={() => setEditId(null)} className="text-xs font-bold text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                        </div>
                      </Td>
                    </tr>
                  ) : (
                    <tr key={e.id} className="group transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <Td className="font-semibold text-slate-800 dark:text-slate-200">{e.nome}</Td>
                      <Td>
                        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                          {e.telefone}
                          {e.telefone && (
                            <WhatsAppMenu eleitor={e} />
                          )}
                        </div>
                      </Td>
                      <Td className="dark:text-slate-300">
                        <p className="font-medium">{e.local_votacao}</p>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Z: {e.zona} • S: {e.secao}</p>
                      </Td>
                      <Td className="dark:text-slate-300">
                        <p className="font-medium">{e.bairro}</p>
                        <p className="text-xs text-slate-500">{e.cidade}</p>
                      </Td>
                      <Td>
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-semibold dark:bg-slate-800 dark:text-slate-300">
                          {e.cabo?.nome ?? 'Sem Indicação'}
                        </span>
                      </Td>
                      <Td>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[e.status]}`}>
                          {e.status}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-slate-500 text-xs font-medium">
                        {formatDataHora(e.created_at)}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => iniciarEdicao(e)} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition dark:hover:bg-brand-900/40" title="Editar Eleitor">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => anonimizar(e)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition dark:hover:bg-amber-900/40" title="Anonimizar (Apagar dados pessoais para LGPD)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          </button>
                          <button onClick={() => excluir(e)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition dark:hover:bg-red-900/40" title="Excluir Definitivamente">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
        
        {/* Rodapé: Paginação */}
        {totalPaginas > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Página <strong className="text-slate-900 dark:text-white">{paginaAtual}</strong> de {totalPaginas}
            </span>
            <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const editInput =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400'

function Th({ col, ordem, onClick, children }: { col: Coluna, ordem: Ordenacao, onClick: (c: Coluna) => void, children: React.ReactNode }) {
  const ativo = ordem.campo === col
  return (
    <th
      onClick={() => onClick(col)}
      className="cursor-pointer select-none px-3 py-3 hover:text-slate-700 hover:bg-slate-100/50 transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
    >
      <div className="flex items-center gap-1.5">
        {children}
        <span className="text-[10px] text-brand-500">
          {ativo ? (ordem.dir === 'asc' ? '▲' : '▼') : <span className="opacity-0 group-hover:opacity-30">▲</span>}
        </span>
      </div>
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>
}
