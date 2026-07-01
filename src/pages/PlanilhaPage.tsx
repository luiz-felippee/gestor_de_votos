import { useState, useEffect, useMemo } from 'react'
import { api, type EleitorFiltros } from '../lib/api'
import { getSocket } from '../lib/socket'
import { toast } from 'sonner'
import { CIDADES, STATUS_OPTIONS, STATUS_STYLES } from '../lib/constants'
import { formatDataHora, maskTelefone } from '../lib/format'
import { exportarCSV, exportarXLSX } from '../lib/export'
import { useConfirm } from '../components/ConfirmDialog'
import { Printer, Upload, MessageCircle, Users } from 'lucide-react'
import { ImportModal } from '../components/ImportModal'
import { EmptyState } from '../components/EmptyState'
import type { EleitorComCabo, StatusEleitor } from '../lib/types'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'

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
  const { confirm } = useConfirm()
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState('')
  const [buscaDeb, setBuscaDeb] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroBairro, setFiltroBairro] = useState('')
  const [filtroCabo, setFiltroCabo] = useState('')
  const [ordem, setOrdem] = useState<Ordenacao>({ campo: 'created_at', dir: 'desc' })

  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 50

  const [bairrosOptions, setBairrosOptions] = useState<string[]>([])
  const [cabosOptions, setCabosOptions] = useState<{id: string, nome: string}[]>([])
  const [exportando, setExportando] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EleitorComCabo>>({})

  // Debounce da busca (evita um request por tecla)
  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  // Lista de bairros e cabos para o filtro
  useEffect(() => {
    api.getBairros().then(setBairrosOptions).catch(() => {})
    api.getCabos().then(setCabosOptions).catch(() => {})
  }, [])

  const filtros: EleitorFiltros = useMemo(
    () => ({
      busca: buscaDeb || undefined,
      cidade: filtroCidade || undefined,
      status: filtroStatus || undefined,
      bairro: filtroBairro || undefined,
      cabo_id: filtroCabo || undefined,
      sort: ordem.campo,
      dir: ordem.dir,
    }),
    [buscaDeb, filtroCidade, filtroStatus, filtroBairro, filtroCabo, ordem],
  )

  // Filtros mudaram → volta para a página 1
  useEffect(() => {
    setPaginaAtual(1)
  }, [filtros])

  const queryKey = ['eleitores-paginados', { ...filtros, page: paginaAtual, limit: itensPorPagina }]

  const { data: pageData, isLoading: loading, error, isPlaceholderData } = useQuery({
    queryKey,
    queryFn: () => api.getEleitores({ ...filtros, page: paginaAtual, limit: itensPorPagina }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000, // 1 minuto de cache fresco
  })

  const eleitores = pageData?.data ?? []
  const total = pageData?.total ?? 0
  const totalPaginas = pageData?.totalPages || 1
  const erro = error ? (error as Error).message : null

  // Pré-carrega a próxima página quando os dados chegam (prefetching)
  useEffect(() => {
    if (!isPlaceholderData && paginaAtual < totalPaginas) {
      queryClient.prefetchQuery({
        queryKey: ['eleitores-paginados', { ...filtros, page: paginaAtual + 1, limit: itensPorPagina }],
        queryFn: () => api.getEleitores({ ...filtros, page: paginaAtual + 1, limit: itensPorPagina })
      })
    }
  }, [pageData, isPlaceholderData, paginaAtual, totalPaginas, queryClient, filtros, itensPorPagina])

  // Tempo real: invalida o cache quando algo muda no servidor
  useEffect(() => {
    const socket = getSocket()
    const h = () => queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    socket.on('eleitores:changed', h)
    return () => {
      socket.off('eleitores:changed', h)
    }
  }, [queryClient])

  function ordenarPor(campo: Coluna) {
    setOrdem((o) =>
      o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' },
    )
  }

  function iniciarEdicao(e: EleitorComCabo) {
    setEditId(e.id)
    setEditForm({ ...e })
  }

  async function salvarEdicao() {
    if (!editId) return
    const currentEditId = editId
    
    // Atualização Otimista no Cache
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map((e: EleitorComCabo) => 
          e.id === currentEditId ? { ...e, ...editForm } : e
        )
      }
    })

    setEditId(null)
    setEditForm({})

    try {
      await api.updateEleitor(currentEditId, {
        nome: editForm.nome,
        telefone: editForm.telefone,
        local_votacao: editForm.local_votacao,
        zona: Number(editForm.zona),
        secao: Number(editForm.secao),
        bairro: editForm.bairro,
        cidade: editForm.cidade,
        endereco: editForm.endereco,
        status: editForm.status as StatusEleitor,
        observacoes: editForm.observacoes,
        cpf: editForm.cpf,
        titulo_eleitor: editForm.titulo_eleitor,
        data_nascimento: editForm.data_nascimento,
      })
      toast.success('Alterações salvas com sucesso!')
      // Invalida em background para garantir sincronia real
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    } catch (error: any) {
      toast.error('Erro ao atualizar eleitor: ' + error.message)
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    }
  }

  async function anonimizar(e: EleitorComCabo) {
    const ok = await confirm({
      title: 'Anonimizar Eleitor?',
      message: `Tem certeza que deseja anonimizar "${e.nome}"? Os dados pessoais (nome, telefone, CPF, título, nascimento) serão apagados permanentemente, mantendo apenas a estatística (LGPD).`,
      confirmText: 'Anonimizar',
      cancelText: 'Voltar',
    })
    if (!ok) return

    // Atualização Otimista
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map((item: EleitorComCabo) => 
          item.id === e.id ? { ...item, nome: 'Anônimo', telefone: '***', cpf: null, titulo_eleitor: null, data_nascimento: null } : item
        )
      }
    })

    try {
      await api.anonimizarEleitor(e.id)
      toast.success('Dados anonimizados com sucesso (LGPD)')
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    } catch (err) {
      toast.error(`Erro ao anonimizar: ${(err as Error).message}`)
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    }
  }

  async function excluir(e: EleitorComCabo) {
    const ok = await confirm({
      title: 'Excluir Eleitor?',
      message: `Tem certeza que deseja excluir o cadastro de "${e.nome}"? Esta ação é irreversível.`,
      confirmText: 'Excluir',
      cancelText: 'Voltar',
    })
    if (!ok) return

    // Atualização Otimista
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old
      return {
        ...old,
        total: old.total - 1,
        data: old.data.filter((item: EleitorComCabo) => item.id !== e.id)
      }
    })

    try {
      await api.deleteEleitor(e.id)
      toast.success('Eleitor excluído com sucesso')
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    } catch (error: any) {
      toast.error('Erro ao excluir eleitor')
      queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
    }
  }

  function setCampo<K extends keyof EleitorComCabo>(campo: K, valor: EleitorComCabo[K]) {
    setEditForm((f) => ({ ...f, [campo]: valor }))
  }

  async function exportar(tipo: 'xlsx' | 'csv') {
    setExportando(true)
    try {
      const todos = await api.getEleitoresFiltrados(filtros)
      if (tipo === 'xlsx') await exportarXLSX(todos)
      else await exportarCSV(todos)
      toast.success('Eleitores exportados com sucesso!')
    } catch (error) {
      toast.error('Erro ao exportar dados')
    } finally {
      setExportando(false)
    }
  }

  const exportBtn =
    'flex-1 sm:flex-none flex justify-center items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-brand-500 hover:text-brand-600 hover:shadow-md active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-400'
  const filtroSelectClass =
  'w-full sm:w-auto rounded-xl border-none bg-slate-100 px-4 py-2.5 text-base sm:text-sm font-semibold text-slate-600 outline-none ring-1 ring-transparent transition-all hover:bg-slate-200 focus:bg-white focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:bg-slate-950'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in flex flex-col h-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Planilha de Votação
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {total.toLocaleString('pt-BR')} eleitores no filtro atual
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Sincronizado
            </span>
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          <button onClick={() => setShowImport(true)} className={exportBtn}>
            <Upload className="h-4 w-4" />
            <span>Importar</span>
          </button>
          <button onClick={() => window.print()} className={exportBtn}>
            <Printer className="h-4 w-4" />
            <span>Imprimir / PDF</span>
          </button>
          <button onClick={() => exportar('xlsx')} disabled={exportando} className={exportBtn}>
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button onClick={() => exportar('csv')} disabled={exportando} className={exportBtn}>
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {showImport && (
        <ImportModal 
          onClose={() => setShowImport(false)} 
          onSuccess={() => {
            setShowImport(false)
            queryClient.invalidateQueries({ queryKey: ['eleitores-paginados'] })
          }} 
        />
      )}

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap lg:flex-nowrap items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/50 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
        <div className="relative flex-1 min-w-[250px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou título..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border-none bg-slate-100 pl-10 pr-4 py-2.5 text-base sm:text-sm font-medium outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
          />
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block mx-1"></div>
        <select value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} className={filtroSelectClass}>
          <option value="">Cidades (Todas)</option>
          {CIDADES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={filtroSelectClass}>
          <option value="">Status (Todos)</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={filtroBairro} onChange={(e) => setFiltroBairro(e.target.value)} className={`${filtroSelectClass} max-w-[160px]`}>
          <option value="">Bairros</option>
          {bairrosOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={filtroCabo} onChange={(e) => setFiltroCabo(e.target.value)} className={`${filtroSelectClass} max-w-[200px]`}>
          <option value="">Lideranças (Todas)</option>
          {cabosOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 border border-red-200">
          {erro}
        </div>
      )}

      {/* Tabela e Cards */}
      <div className="flex-1 min-h-[400px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md flex flex-col dark:border-slate-800/80 dark:bg-slate-900/90">
        
        {/* Mobile View (Cards) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 overflow-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center gap-2 py-12">
               <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-slate-400 font-medium">Carregando planilha...</span>
             </div>
          ) : eleitores.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum eleitor encontrado"
              description="Nenhum eleitor corresponde aos filtros e buscas atuais."
              className="border-none bg-transparent"
            />
          ) : (
            eleitores.map((e) => (
              editId === e.id ? (
                <div key={e.id} className="bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex flex-col gap-3">
                  <input className={editInputClass} placeholder="Nome" value={editForm.nome ?? ''} onChange={(ev) => setCampo('nome', ev.target.value)} />
                  <input className={editInputClass} placeholder="Telefone" value={editForm.telefone ?? ''} onChange={(ev) => setCampo('telefone', maskTelefone(ev.target.value))} />
                  <input className={editInputClass} placeholder="Local de Votação" value={editForm.local_votacao ?? ''} onChange={(ev) => setCampo('local_votacao', ev.target.value)} />
                  <div className="flex gap-2">
                    <input type="number" className={`${editInputClass} w-1/2`} placeholder="Zona" value={editForm.zona ?? ''} onChange={(ev) => setCampo('zona', Number(ev.target.value))} />
                    <input type="number" className={`${editInputClass} w-1/2`} placeholder="Seção" value={editForm.secao ?? ''} onChange={(ev) => setCampo('secao', Number(ev.target.value))} />
                  </div>
                  <input className={editInputClass} placeholder="Endereço (Opcional)" value={editForm.endereco ?? ''} onChange={(ev) => setCampo('endereco', ev.target.value)} />
                  <input className={editInputClass} placeholder="Bairro" value={editForm.bairro ?? ''} onChange={(ev) => setCampo('bairro', ev.target.value)} />
                  <select className={editInputClass} value={editForm.cidade ?? ''} onChange={(ev) => setCampo('cidade', ev.target.value)}>
                    {CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className={editInputClass} value={editForm.status ?? 'ativo'} onChange={(ev) => setCampo('status', ev.target.value as StatusEleitor)}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg dark:bg-slate-800 dark:text-slate-300">Cancelar</button>
                    <button onClick={salvarEdicao} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg">Salvar</button>
                  </div>
                </div>
              ) : (
                <div key={e.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-2 relative">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">{e.nome}</h3>
                      <p className="font-semibold text-slate-700 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        {e.telefone}
                        <a href={`https://wa.me/55${e.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 p-1 rounded-full"><MessageCircle className="h-3.5 w-3.5"/></a>
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${STATUS_STYLES[e.status]}`}>{e.status}</span>
                  </div>
                  <div className="text-sm dark:text-slate-300 grid grid-cols-1 gap-1">
                    <p><span className="font-semibold text-slate-500">Local:</span> {e.local_votacao} <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold ml-1">(Z:{e.zona} S:{e.secao})</span></p>
                    <p><span className="font-semibold text-slate-500">Endereço:</span> {e.endereco ? `${e.endereco}, ` : ''}{e.bairro} - {e.cidade}</p>
                    <p><span className="font-semibold text-slate-500">Indicação:</span> {e.cabo?.nome || '—'}</p>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                     <span className="text-[10px] text-slate-400 font-semibold">{formatDataHora(e.created_at).split(' ')[0]}</span>
                     <div className="flex gap-1.5">
                       <button onClick={() => iniciarEdicao(e)} className="p-1.5 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg dark:text-brand-400 dark:bg-brand-900/30">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                       </button>
                       <button onClick={() => excluir(e)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg dark:text-red-400 dark:bg-red-900/30">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                     </div>
                  </div>
                </div>
              )
            ))
          )}
        </div>

        {/* Desktop View (Tabela) */}
        <div className="hidden md:block flex-1 overflow-auto relative custom-scrollbar">
          <table className="w-full min-w-[1000px] text-left text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <Th col="nome" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Nome</Th>
                <Th col="telefone" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Telefone</Th>
                <Th col="local_votacao" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Local / Zona / Seç.</Th>
                <Th col="bairro" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Endereço</Th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 select-none">Indicação</th>
                <Th col="status" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Status</Th>
                <Th col="created_at" ordem={ordem} onClick={ordenarPor} className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">Data Cad.</Th>
                <th className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-400 font-medium">Carregando planilha...</span>
                    </div>
                  </td>
                </tr>
              ) : eleitores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    <EmptyState
                      icon={Users}
                      title="Nenhum eleitor encontrado"
                      description="A busca atual não retornou nenhum eleitor."
                      className="border-none bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                eleitores.map((e) =>
                  editId === e.id ? (
                    <tr key={e.id} className="bg-brand-50/50 dark:bg-brand-900/10">
                      <Td>
                        <input className={editInputClass} value={editForm.nome ?? ''} onChange={(ev) => setCampo('nome', ev.target.value)} />
                      </Td>
                      <Td>
                        <input className={editInputClass} value={editForm.telefone ?? ''} onChange={(ev) => setCampo('telefone', maskTelefone(ev.target.value))} />
                        <input className={`${editInputClass} mt-1 text-xs`} placeholder="CPF" value={editForm.cpf ?? ''} onChange={(ev) => setCampo('cpf', ev.target.value)} />
                        <input className={`${editInputClass} mt-1 text-xs`} placeholder="Título" value={editForm.titulo_eleitor ?? ''} onChange={(ev) => setCampo('titulo_eleitor', ev.target.value)} />
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <input className={`${editInputClass} flex-1`} placeholder="Local" value={editForm.local_votacao ?? ''} onChange={(ev) => setCampo('local_votacao', ev.target.value)} />
                          <input type="number" className={`${editInputClass} w-14`} placeholder="Z" value={editForm.zona ?? ''} onChange={(ev) => setCampo('zona', Number(ev.target.value))} />
                          <input type="number" className={`${editInputClass} w-14`} placeholder="S" value={editForm.secao ?? ''} onChange={(ev) => setCampo('secao', Number(ev.target.value))} />
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <input className={editInputClass} placeholder="Endereço (Opcional)" value={editForm.endereco ?? ''} onChange={(ev) => setCampo('endereco', ev.target.value)} />
                          <input className={editInputClass} placeholder="Bairro" value={editForm.bairro ?? ''} onChange={(ev) => setCampo('bairro', ev.target.value)} />
                          <div className="flex gap-1">
                            <select className={`${editInputClass} flex-1`} value={editForm.cidade ?? ''} onChange={(ev) => setCampo('cidade', ev.target.value)}>
                              {CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="date" title="Data de Nascimento" className={`${editInputClass} w-32`} value={editForm.data_nascimento ?? ''} onChange={(ev) => setCampo('data_nascimento', ev.target.value)} />
                          </div>
                        </div>
                      </Td>
                      <Td className="text-slate-500 font-medium">{e.cabo?.nome ?? '—'}</Td>
                      <Td>
                        <select className={editInputClass} value={editForm.status ?? 'ativo'} onChange={(ev) => setCampo('status', ev.target.value as StatusEleitor)}>
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
                    <tr key={e.id} className="group transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <Td className="font-bold text-slate-900 dark:text-slate-100">{e.nome}</Td>
                      <Td>
                        <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 group/phone">
                          {e.telefone}
                          <a 
                            href={`https://wa.me/55${e.telefone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            title="Conversar no WhatsApp"
                            className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 opacity-0 group-hover/phone:opacity-100 transition-opacity"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </div>
                        {e.cpf && <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-medium">CPF: {e.cpf}</p>}
                        {e.titulo_eleitor && <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-medium">TÍT: {e.titulo_eleitor}</p>}
                      </Td>
                      <Td className="dark:text-slate-300">
                        <p className="font-semibold">{e.local_votacao}</p>
                        <p className="text-[11px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-widest mt-0.5">Z: {e.zona} • S: {e.secao}</p>
                      </Td>
                      <Td className="dark:text-slate-300">
                        {e.endereco ? (
                          <p className="font-semibold">{e.endereco}</p>
                        ) : null}
                        <p className={e.endereco ? 'text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium' : 'font-semibold'}>
                          {e.bairro}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mt-0.5">
                          {e.cidade}
                          {e.data_nascimento && ` • NASC: ${e.data_nascimento.split('-').reverse().join('/')}`}
                        </p>
                      </Td>
                      <Td>
                        {e.cabo?.nome ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50/80 border border-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold uppercase tracking-wider dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {e.cabo.nome}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider italic">Sem Indicação</span>
                        )}
                      </Td>
                      <Td>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-sm ${STATUS_STYLES[e.status]}`}>
                          {e.status}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-slate-400 text-xs font-semibold">
                        {formatDataHora(e.created_at)}
                      </Td>
                      <Td className="whitespace-nowrap px-5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button onClick={() => iniciarEdicao(e)} className="p-2 text-brand-600 hover:bg-brand-100 hover:text-brand-700 rounded-xl transition-colors dark:text-brand-400 dark:hover:bg-brand-900/50" title="Editar Eleitor">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => anonimizar(e)} className="p-2 text-amber-500 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-colors dark:text-amber-400 dark:hover:bg-amber-900/50" title="Anonimizar (LGPD)">
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
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
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

const editInputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-base sm:text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400'

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-4 ${className}`}>{children}</td>
}

function Th({
  col,
  ordem,
  onClick,
  children,
  className = '',
}: {
  col: Coluna
  ordem: Ordenacao
  onClick: (c: Coluna) => void
  children: React.ReactNode
  className?: string
}) {
  const ativo = ordem.campo === col

  return (
    <th
      className={`px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none dark:hover:bg-slate-900 ${className}`}
      onClick={() => onClick(col)}
    >
      <div className="flex items-center gap-1.5 font-bold">
        {children}
        <span className="text-[10px] text-brand-500">
          {ativo ? (ordem.dir === 'asc' ? '▲' : '▼') : <span className="opacity-0 group-hover:opacity-30">▲</span>}
        </span>
      </div>
    </th>
  )
}
