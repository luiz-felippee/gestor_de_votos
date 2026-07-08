import { useState, useMemo, useEffect } from 'react'
import { api } from '../lib/api'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { MessageCircle, Check, Send, Search, Users, Shield, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { maskTelefone } from '../lib/format'
import type { EleitorComCabo, CaboEleitoral } from '../lib/types'
import { ConexaoEvolution } from '../components/whatsapp/ConexaoEvolution'
import { WhatsAppSubNav } from '../components/whatsapp/WhatsAppSubNav'

type Contato = EleitorComCabo | CaboEleitoral;

const TEMPLATES_PRONTOS = [
  { label: 'Saudação Simples', texto: 'Olá {nome}, tudo bem? Como posso te ajudar hoje?' },
  { label: 'Agradecimento Apoio', texto: 'Fala {nome}! Passando para agradecer pelo seu apoio e confiança no nosso trabalho. Um forte abraço!' },
  { label: 'Convite Evento', texto: 'Oi {nome}, tudo bem? Teremos uma reunião muito importante da nossa campanha amanhã. Conto com a sua presença!' },
  { label: 'Atualização Cabos', texto: 'Olá {nome}! Gostaria de pedir que você atualize as planilhas da sua região. Qualquer dúvida, estou à disposição.' }
]

export function WhatsAppPage() {
  const [aba, setAba] = useState<'eleitores' | 'cabos'>('eleitores')
  const [busca, setBusca] = useState('')
  const [buscaDeb, setBuscaDeb] = useState('')
  const [mensagem, setMensagem] = useState('Olá {nome}, tudo bem?')
  const [selecionados, setSelecionados] = useState<Map<string, { id: string, nome: string, telefone: string }>>(new Map())
  const [enviados, setEnviados] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('whatsapp_enviados')
      if (saved) return new Set(JSON.parse(saved))
    } catch {}
    return new Set()
  })
  const [pagina, setPagina] = useState(1)
  const [plataforma, setPlataforma] = useState<'padrao' | 'web'>('padrao')

  useEffect(() => {
    localStorage.setItem('whatsapp_enviados', JSON.stringify(Array.from(enviados)))
  }, [enviados])
  const itensPorPagina = 50

  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: api.getWhatsAppStatus,
    refetchInterval: (query) => query.state.data?.status === 'unpaired' ? 5000 : false
  })

  const mutationSend = useMutation({
    mutationFn: ({ numero, texto }: { numero: string, texto: string }) => api.sendWhatsAppMessage(numero, texto),
    onError: (err: any) => {
      toast.error(err.message || 'Falha ao enviar mensagem.')
    }
  })

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  // Eleitores Query
  const { data: eleitoresData, isLoading: loadingEleitores, isError: erroEleitores } = useQuery({
    queryKey: ['eleitores-whatsapp', { busca: buscaDeb, page: pagina, limit: itensPorPagina }],
    queryFn: () => api.getEleitores({ busca: buscaDeb, page: pagina, limit: itensPorPagina }),
    placeholderData: keepPreviousData,
    enabled: aba === 'eleitores'
  })

  // Cabos Query
  const { data: cabosData, isLoading: loadingCabos, isError: erroCabos } = useQuery({
    queryKey: ['cabos-whatsapp', { busca: buscaDeb }],
    queryFn: () => api.getCabos(),
    enabled: aba === 'cabos'
  })

  // Normalize data depending on tab
  const listaVigente = useMemo(() => {
    if (aba === 'cabos') {
      let l = cabosData || []
      if (buscaDeb) {
        l = l.filter(c => c.nome.toLowerCase().includes(buscaDeb.toLowerCase()) || c.telefone.includes(buscaDeb))
      }
      return l
    }
    return eleitoresData?.data || []
  }, [aba, eleitoresData, cabosData, buscaDeb])

  const total = aba === 'eleitores' ? (eleitoresData?.total || 0) : listaVigente.length
  const totalPaginas = aba === 'eleitores' ? (eleitoresData?.totalPages || 1) : Math.ceil(listaVigente.length / itensPorPagina) || 1
  
  // se for cabo, a gente fatia no front
  const listaExibida: Contato[] = aba === 'cabos' ? listaVigente.slice((pagina - 1) * itensPorPagina, pagina * itensPorPagina) : listaVigente

  function handleSelect(contato: Contato) {
    setSelecionados(prev => {
      const n = new Map(prev)
      if (n.has(contato.id)) n.delete(contato.id)
      else n.set(contato.id, { id: contato.id, nome: contato.nome, telefone: contato.telefone })
      return n
    })
  }

  function handleSelectAll() {
    // Apenas os itens válidos (com telefone)
    const validos = listaExibida.filter((i) => i.telefone && i.telefone.length >= 10)
    const allSelected = validos.every(v => selecionados.has(v.id))
    
    setSelecionados(prev => {
      const n = new Map(prev)
      if (allSelected && validos.length > 0) {
        validos.forEach(v => n.delete(v.id))
      } else {
        validos.forEach(v => n.set(v.id, { id: v.id, nome: v.nome, telefone: v.telefone }))
      }
      return n
    })
  }

  const pessoasSelecionadas = useMemo(() => {
    return Array.from(selecionados.values())
  }, [selecionados])

  const [pessoaAtualEnvio, setPessoaAtualEnvio] = useState<number>(0)

  // Reseta a fila se mudar a seleção
  useEffect(() => {
    setPessoaAtualEnvio(0)
  }, [selecionados])

  async function dispararWhatsApp(pessoa: { id: string, nome: string, telefone: string }, index: number) {
    if (whatsappStatus?.status !== 'open') {
      toast.error('Seu WhatsApp não está conectado! Conecte-o antes de disparar.')
      return
    }

    const nomeCompleto = pessoa.nome
    const nomeCurto = nomeCompleto.split(' ')[0]
    const msgFinal = mensagem
      .replace(/\{nome\}/gi, nomeCurto)
      .replace(/\{nomeCompleto\}/gi, nomeCompleto)
      .replace(/\{telefone\}/gi, pessoa.telefone || '')
      
    const apenasDigitos = pessoa.telefone.replace(/\D/g, '')
    const numeroFinal = (apenasDigitos.startsWith('55') && apenasDigitos.length >= 12) 
      ? apenasDigitos 
      : `55${apenasDigitos}`
      
    const loadingToast = toast.loading(`Enviando para ${nomeCurto}...`)
    try {
      await mutationSend.mutateAsync({ numero: numeroFinal, texto: msgFinal })
      toast.success(`Mensagem enviada para ${nomeCurto}!`, { id: loadingToast })
      
      setEnviados(prev => {
        const n = new Set(prev)
        n.add(pessoa.id)
        return n
      })

      if (index + 1 < pessoasSelecionadas.length) {
        setPessoaAtualEnvio(index + 1)
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      // Para o envio se falhar
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-8 animate-fade-in flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-64px)] gap-6">
      
      {/* Coluna Esquerda: Listagem */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-brand-600 dark:text-brand-400" />
            Central WhatsApp
          </h1>
          <p className="mt-1 mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Selecione as pessoas para iniciar o disparo na página atual
          </p>
          <WhatsAppSubNav />
        </div>

        {/* Abas */}
        <div className="flex rounded-lg bg-slate-100 p-1 mb-6 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full sm:w-fit shrink-0">
          <button
            onClick={() => { setAba('eleitores'); setPagina(1); setSelecionados(new Map()) }}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              aba === 'eleitores'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Users className="h-4 w-4" /> Eleitores
          </button>
          <button
            onClick={() => { setAba('cabos'); setPagina(1); setSelecionados(new Map()) }}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              aba === 'cabos'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Shield className="h-4 w-4" /> Lideranças (Cabos)
          </button>
        </div>

        <div className="mb-4 relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border-none bg-slate-100 pl-10 pr-4 py-2.5 text-base sm:text-sm font-medium outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-950"
          />
        </div>

        <div className="flex-1 min-h-[400px] lg:min-h-0 max-h-[600px] lg:max-h-none flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex-1 overflow-x-auto overflow-y-auto relative">
            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm dark:bg-slate-950">
                <tr>
                  <th className="w-12 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={
                        listaExibida.filter((i) => i.telefone && i.telefone.length >= 10).length > 0 && 
                        listaExibida.filter((i) => i.telefone && i.telefone.length >= 10).every((i) => selecionados.has(i.id))
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">Nome</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">Telefone</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingEleitores || loadingCabos ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-500">Carregando...</td></tr>
                ) : erroEleitores || erroCabos ? (
                  <tr><td colSpan={4} className="text-center py-10 text-red-500">Erro ao carregar dados. Tente novamente.</td></tr>
                ) : listaExibida.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-500">Nenhum registro encontrado.</td></tr>
                ) : (
                  listaExibida.map((item) => {
                    const enviou = enviados.has(item.id)
                    const invalidPhone = !item.telefone || item.telefone.length < 10
                    return (
                      <tr 
                        key={item.id} 
                        className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer ${selecionados.has(item.id) ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}
                        onClick={() => !invalidPhone && handleSelect(item)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                            checked={selecionados.has(item.id)}
                            onChange={() => handleSelect(item)}
                            disabled={invalidPhone}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{item.nome}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {maskTelefone(item.telefone) || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {enviou ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              <Check className="h-3 w-3" /> Enviado
                            </span>
                          ) : invalidPhone ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              S/Número
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 shrink-0">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Página {pagina} de {totalPaginas} ({total} registros)
            </span>
            <div className="flex gap-1">
              <button
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Anterior
              </button>
              <button
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Painel de Envio */}
      <div className="w-full lg:w-[400px] flex flex-col gap-6 shrink-0 lg:h-full">
        
        {/* Conexão + Configuração da Evolution API (compartilhado com o Funil) */}
        <div className="shrink-0">
          <ConexaoEvolution />
        </div>

        {/* Editor de Mensagem */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Mensagem
            </h2>
            <div className="dropdown relative group">
              <button className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md hover:bg-brand-100 transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">
                <Zap className="h-3.5 w-3.5" />
                Mensagens Prontas
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 dark:border-slate-700 dark:bg-slate-800">
                {TEMPLATES_PRONTOS.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMensagem(t.texto)}
                    className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-brand-400"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Inserir:</span>
              <button onClick={() => setMensagem(m => m + '{nome}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Nome Curto</button>
              <button onClick={() => setMensagem(m => m + '{nomeCompleto}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Nome Completo</button>
              <button onClick={() => setMensagem(m => m + '{telefone}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Telefone</button>
            </div>
            
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base sm:text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 resize-none"
              placeholder="Digite a mensagem..."
            />
            
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plataforma:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="radio" 
                  name="plataforma" 
                  value="padrao" 
                  checked={plataforma === 'padrao'} 
                  onChange={() => setPlataforma('padrao')}
                  className="text-brand-600 focus:ring-brand-500" 
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Padrão (App/Celular)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="radio" 
                  name="plataforma" 
                  value="web" 
                  checked={plataforma === 'web'} 
                  onChange={() => setPlataforma('web')}
                  className="text-brand-600 focus:ring-brand-500" 
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">WhatsApp Web</span>
              </label>
            </div>
          </div>
        </div>

        {/* Fila de Envios */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-1 min-h-[400px] lg:min-h-0 flex flex-col">
          <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Fila de Envios
            <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {pessoasSelecionadas.length} na fila
            </span>
          </h2>
          
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-2 mb-4">
            {pessoasSelecionadas.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-4">
                <p className="text-sm font-medium text-slate-400">
                  Nenhum contato selecionado.<br/>Selecione na tabela ao lado.
                </p>
              </div>
            ) : (
              pessoasSelecionadas.map((p, idx: number) => {
                const enviado = enviados.has(p.id)
                const atual = pessoaAtualEnvio === idx && !enviado
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    enviado 
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' 
                      : atual
                        ? 'bg-white border-brand-300 shadow-sm dark:bg-slate-900 dark:border-brand-700'
                        : 'bg-white border-slate-200 opacity-60 dark:bg-slate-900 dark:border-slate-800'
                  }`}>
                    <div>
                      <p className={`text-sm font-bold ${enviado ? 'text-green-800 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {p.nome.split(' ')[0]}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {maskTelefone(p.telefone)}
                      </p>
                    </div>
                    {enviado ? (
                      <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                    ) : (
                      <button
                        disabled={!atual}
                        onClick={() => dispararWhatsApp(p, idx)}
                        className="rounded-lg bg-emerald-500 p-2 text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-30 disabled:bg-slate-400"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
            O disparo é feito de forma assistida pela Evolution API para máxima segurança.
          </p>
          
          {whatsappStatus?.status === 'open' ? (
            <button
              onClick={() => {
                if (pessoasSelecionadas.length > 0) {
                  setPessoaAtualEnvio(0)
                  dispararWhatsApp(pessoasSelecionadas[0], 0)
                }
              }}
              disabled={pessoasSelecionadas.length === 0 || !mensagem.trim() || mutationSend.isPending}
              className="w-full mt-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-base font-bold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              <Send className="h-5 w-5" />
              {mutationSend.isPending ? 'Enviando...' : `Disparar para ${pessoasSelecionadas.length} pessoas`}
            </button>
          ) : (
            <div className="mt-auto p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-medium text-center dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-400">
              Conecte o seu WhatsApp acima para poder enviar mensagens!
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
