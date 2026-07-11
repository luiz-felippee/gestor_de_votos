import { useState, useMemo, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useQuery, useMutation, keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Check, Send, Search, Users, Shield, Zap, Pause, Play, Timer, Trash2, Plus, ArrowRight, Network } from 'lucide-react'
import { toast } from 'sonner'
import { maskTelefone } from '../lib/format'
import { ConexaoEvolution } from '../components/whatsapp/ConexaoEvolution'
import { WhatsAppSubNav } from '../components/whatsapp/WhatsAppSubNav'
import { AntiBloqueioPanel } from '../components/whatsapp/AntiBloqueioPanel'
import { resolverSpintax, contarVariacoes } from '../lib/spintax'
import {
  carregarConfig,
  salvarConfig,
  contadorHoje as lerContadorHoje,
  incrementarContador,
  segundosAleatorios,
  dentroDoHorario,
  sleep,
  type AntiBloqueioConfig,
} from '../lib/antiBloqueio'

const TEMPLATES_PRONTOS = [
  { label: 'Saudação Simples', texto: 'Olá {nome}, tudo bem? Como posso te ajudar hoje?' },
  { label: 'Agradecimento Apoio', texto: 'Fala {nome}! Passando para agradecer pelo seu apoio e confiança no nosso trabalho. Um forte abraço!' },
  { label: 'Convite Evento', texto: 'Oi {nome}, tudo bem? Teremos uma reunião muito importante da nossa campanha amanhã. Conto com a sua presença!' },
  { label: 'Atualização Cabos', texto: 'Olá {nome}! Gostaria de pedir que você atualize as planilhas da sua região. Qualquer dúvida, estou à disposição.' }
]

export function WhatsAppPage() {
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<'eleitores' | 'cabos' | 'tarefas_funil' | 'regras_funil'>('eleitores')
  const [busca, setBusca] = useState('')
  const [buscaDeb, setBuscaDeb] = useState('')
  const [mensagem, setMensagem] = useState('Olá {nome}, tudo bem?')
  const [selecionados, setSelecionados] = useState<Map<string, { id: string, nome: string, telefone: string, template?: any }>>(new Map())
  const [enviados, setEnviados] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('whatsapp_enviados')
      if (saved) return new Set(JSON.parse(saved))
    } catch {}
    return new Set()
  })
  const [pagina, setPagina] = useState(1)
  const [plataforma, setPlataforma] = useState<'padrao' | 'web'>('padrao')

  // --- Modo Anti-Bloqueio ---
  const [antiConfig, setAntiConfig] = useState<AntiBloqueioConfig>(() => carregarConfig())
  const [contadorDia, setContadorDia] = useState(() => lerContadorHoje())
  const atualizarConfig = (c: AntiBloqueioConfig) => { setAntiConfig(c); salvarConfig(c) }

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
    mutationFn: ({ numero, texto, delay }: { numero: string, texto: string, delay?: number }) =>
      api.sendWhatsAppMessage(numero, texto, delay),
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

  // Funil Queries & Mutations
  const { data: tarefasData, isLoading: loadingTarefas, isError: erroTarefas } = useQuery({
    queryKey: ['funil-tarefas'],
    queryFn: api.getFunilTarefasHoje,
    enabled: aba === 'tarefas_funil'
  })

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['funil-templates'],
    queryFn: api.getFunilTemplates,
    enabled: aba === 'regras_funil'
  })

  const mutationAvancar = useMutation({
    mutationFn: ({ id, destino }: { id: string, destino: string }) => api.avancarFunil(id, destino),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funil-tarefas'] })
      queryClient.invalidateQueries({ queryKey: ['eleitores'] })
    }
  })

  const mutationCreateTemplate = useMutation({
    mutationFn: api.createFunilTemplate,
    onSuccess: () => {
      toast.success('Regra criada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['funil-templates'] })
    }
  })

  const mutationDeleteTemplate = useMutation({
    mutationFn: api.deleteFunilTemplate,
    onSuccess: () => {
      toast.success('Regra removida com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['funil-templates'] })
    }
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
    if (aba === 'tarefas_funil') {
      let l = (tarefasData?.tarefas || []).map((t: any) => ({
        id: t.eleitor.id,
        nome: t.eleitor.nome,
        telefone: t.eleitor.telefone,
        etapa_funil: t.eleitor.etapa_funil,
        template: t.template
      }))
      if (buscaDeb) {
        l = l.filter((c: any) => c.nome.toLowerCase().includes(buscaDeb.toLowerCase()) || c.telefone.includes(buscaDeb))
      }
      return l
    }
    if (aba === 'regras_funil') return [] // Não é exibido na tabela padrão
    return eleitoresData?.data || []
  }, [aba, eleitoresData, cabosData, tarefasData, buscaDeb])

  const total = aba === 'eleitores' ? (eleitoresData?.total || 0) : listaVigente.length
  const totalPaginas = aba === 'eleitores' ? (eleitoresData?.totalPages || 1) : Math.ceil(listaVigente.length / itensPorPagina) || 1
  
  // se for cabo ou funil, a gente fatia no front
  const listaExibida: any[] = aba !== 'eleitores' ? listaVigente.slice((pagina - 1) * itensPorPagina, pagina * itensPorPagina) : listaVigente

  function handleSelect(contato: any) {
    setSelecionados(prev => {
      const n = new Map(prev)
      if (n.has(contato.id)) n.delete(contato.id)
      else n.set(contato.id, { id: contato.id, nome: contato.nome, telefone: contato.telefone, template: contato.template })
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
        validos.forEach(v => n.set(v.id, { id: v.id, nome: v.nome, telefone: v.telefone, template: v.template }))
      }
      return n
    })
  }

  const pessoasSelecionadas = useMemo(() => {
    return Array.from(selecionados.values())
  }, [selecionados])

  const [pessoaAtualEnvio, setPessoaAtualEnvio] = useState<number>(0)

  // --- Motor de disparo automático (anti-bloqueio) ---
  const [autoRodando, setAutoRodando] = useState(false)
  const [autoStatus, setAutoStatus] = useState('')      // texto do estado atual
  const [countdown, setCountdown] = useState(0)         // segundos até o próximo envio
  const [autoProgresso, setAutoProgresso] = useState(0) // enviados nesta sessão
  const [pausado, setPausado] = useState(false)         // reflete o pause na UI
  const controleRef = useRef<{ cancelar: boolean; pausar: boolean }>({ cancelar: false, pausar: false })

  const variacoes = useMemo(() => contarVariacoes(mensagem), [mensagem])

  // Reseta a fila se mudar a seleção
  useEffect(() => {
    setPessoaAtualEnvio(0)
  }, [selecionados])

  function normalizarNumero(telefone: string) {
    const d = telefone.replace(/\D/g, '')
    return d.startsWith('55') && d.length >= 12 ? d : `55${d}`
  }

  // Resolve spintax + placeholders de personalização para uma pessoa.
  function montarMensagem(pessoa: { nome: string; telefone: string }) {
    const nomeCurto = pessoa.nome.split(' ')[0]
    return resolverSpintax(mensagem)
      .replace(/\{nome\}/gi, nomeCurto)
      .replace(/\{nomeCompleto\}/gi, pessoa.nome)
      .replace(/\{telefone\}/gi, pessoa.telefone || '')
  }

  // Envia UMA mensagem (com "digitando..." variável). Marca como enviada e conta.
  async function enviarUm(pessoa: { id: string; nome: string; telefone: string; template?: any }) {
    const texto = pessoa.template ? pessoa.template.texto_pronto : montarMensagem(pessoa)
    const numero = normalizarNumero(pessoa.telefone)
    const delayDigitacao = segundosAleatorios(2, 5) * 1000 // 2–5s digitando
    await mutationSend.mutateAsync({ numero, texto, delay: delayDigitacao })
    setEnviados(prev => new Set(prev).add(pessoa.id))
    setContadorDia(incrementarContador())

    if (pessoa.template) {
      mutationAvancar.mutate({ id: pessoa.id, destino: pessoa.template.etapa_destino })
    }
  }

  // Disparo manual (um clique = uma pessoa).
  async function dispararWhatsApp(pessoa: { id: string, nome: string, telefone: string, template?: any }, index: number) {
    if (whatsappStatus?.status !== 'open') {
      toast.error('Seu WhatsApp não está conectado! Conecte-o antes de disparar.')
      return
    }
    const nomeCurto = pessoa.nome.split(' ')[0]
    const loadingToast = toast.loading(`Enviando para ${nomeCurto}...`)
    try {
      await enviarUm(pessoa)
      toast.success(`Mensagem enviada para ${nomeCurto}!`, { id: loadingToast })
      if (index + 1 < pessoasSelecionadas.length) setPessoaAtualEnvio(index + 1)
    } catch (e) {
      toast.dismiss(loadingToast)
    }
  }

  // Espera com contagem regressiva, respeitando pausar/cancelar.
  async function aguardar(segundos: number, rotulo: string) {
    for (let s = segundos; s > 0; s--) {
      if (controleRef.current.cancelar) return
      while (controleRef.current.pausar && !controleRef.current.cancelar) {
        setAutoStatus('⏸ Pausado')
        await sleep(500)
      }
      if (controleRef.current.cancelar) return
      setAutoStatus(rotulo)
      setCountdown(s)
      await sleep(1000)
    }
    setCountdown(0)
  }

  // Disparo automático protegido pelo Modo Anti-Bloqueio.
  async function dispararAuto() {
    if (whatsappStatus?.status !== 'open') {
      toast.error('Conecte o WhatsApp antes de disparar.')
      return
    }
    let fila = pessoasSelecionadas.filter(p => !enviados.has(p.id))
    if (fila.length === 0) {
      toast.info('Todos os selecionados já receberam a mensagem.')
      return
    }

    controleRef.current = { cancelar: false, pausar: false }
    setPausado(false)
    setAutoRodando(true)
    setAutoProgresso(0)

    // Validação opcional dos números no WhatsApp.
    if (antiConfig.ativo && antiConfig.validarNumero) {
      setAutoStatus('Validando números no WhatsApp...')
      try {
        const numeros = fila.map(p => normalizarNumero(p.telefone))
        const { validos } = await api.checkWhatsAppNumbers(numeros)
        const validSet = new Set(validos)
        const antes = fila.length
        fila = fila.filter(p => validSet.has(normalizarNumero(p.telefone)))
        if (fila.length < antes) toast.info(`${antes - fila.length} número(s) inválido(s) ignorado(s).`)
      } catch { /* segue sem validar */ }
      if (fila.length === 0) {
        toast.error('Nenhum número válido para enviar.')
        setAutoRodando(false); setAutoStatus('')
        return
      }
    }

    let enviadosSessao = 0
    for (let i = 0; i < fila.length; i++) {
      if (controleRef.current.cancelar) break

      if (antiConfig.ativo) {
        if (!dentroDoHorario(antiConfig)) {
          toast.error(`Fora da janela de envio (${antiConfig.horarioInicio}h–${antiConfig.horarioFim}h). Disparo interrompido.`)
          break
        }
        if (lerContadorHoje() >= antiConfig.limiteDiario) {
          toast.error(`Limite diário de ${antiConfig.limiteDiario} mensagens atingido.`)
          break
        }
      }

      const pessoa = fila[i]
      setAutoStatus(`Enviando para ${pessoa.nome.split(' ')[0]}...`)
      try {
        await enviarUm(pessoa)
      } catch {
        toast.error(`Falha ao enviar para ${pessoa.nome.split(' ')[0]}. Disparo interrompido.`)
        break
      }
      enviadosSessao++
      setAutoProgresso(enviadosSessao)

      if (i === fila.length - 1) break

      if (antiConfig.ativo) {
        if (antiConfig.lotePausaCada > 0 && enviadosSessao % antiConfig.lotePausaCada === 0) {
          await aguardar(antiConfig.lotePausaSeg, `☕ Pausa de segurança (lote de ${antiConfig.lotePausaCada})...`)
        } else {
          await aguardar(segundosAleatorios(antiConfig.delayMinSeg, antiConfig.delayMaxSeg), 'Aguardando próximo envio...')
        }
      }
    }

    const cancelado = controleRef.current.cancelar
    setAutoRodando(false)
    setAutoStatus('')
    setCountdown(0)
    if (!cancelado) toast.success(`Disparo concluído! ${enviadosSessao} mensagem(ns) enviada(s).`)
  }

  function pausarRetomar() {
    controleRef.current.pausar = !controleRef.current.pausar
    setPausado(controleRef.current.pausar)
  }
  function cancelarDisparo() {
    controleRef.current.cancelar = true
    controleRef.current.pausar = false
    setPausado(false)
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
            <Shield className="h-4 w-4" /> Lideranças
          </button>
          <button
            onClick={() => { setAba('tarefas_funil'); setPagina(1); setSelecionados(new Map()) }}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              aba === 'tarefas_funil'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Check className="h-4 w-4" /> Tarefas CRM
          </button>
          <button
            onClick={() => { setAba('regras_funil'); setPagina(1); setSelecionados(new Map()) }}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              aba === 'regras_funil'
                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Network className="h-4 w-4" /> Regras do Funil
          </button>
        </div>

        {aba === 'regras_funil' ? (
          <div className="flex-1 overflow-y-auto space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Nova Regra de Funil</h3>
              <form 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  mutationCreateTemplate.mutate({
                    etapa_origem: fd.get('etapa_origem'),
                    etapa_destino: fd.get('etapa_destino'),
                    dias_espera: Number(fd.get('dias_espera')),
                    texto: fd.get('texto')
                  })
                  e.currentTarget.reset()
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Se a Etapa Atual for:</label>
                  <input required name="etapa_origem" placeholder="ex: novo" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mover para a Etapa:</label>
                  <input required name="etapa_destino" placeholder="ex: boas_vindas" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Esperar Quantos Dias? (0 = Hoje mesmo)</label>
                  <input required type="number" name="dias_espera" min="0" defaultValue="0" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Texto da Mensagem (use {'{nome}'} para personalizar)</label>
                  <textarea required name="texto" rows={4} placeholder="Olá {nome}, tudo bem?" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white resize-none" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={mutationCreateTemplate.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Criar Regra
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Regras Cadastradas</h3>
              {loadingTemplates ? (
                <p>Carregando...</p>
              ) : templatesData?.templates.map((t: any) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold dark:bg-slate-700 dark:text-slate-300">{t.etapa_origem}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold dark:bg-emerald-900/50 dark:text-emerald-400">{t.etapa_destino}</span>
                      <span className="text-sm text-slate-500">• {t.dias_espera} dia(s)</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">"{t.texto}"</p>
                  </div>
                  <button onClick={() => mutationDeleteTemplate.mutate(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
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
              <div className="flex-1 overflow-y-auto relative p-2 sm:p-0">
                {/* Desktop View (Tabela) */}
                <div className="hidden sm:block w-full overflow-x-auto">
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
                      {loadingEleitores || loadingCabos || loadingTarefas ? (
                        <tr><td colSpan={4} className="text-center py-10 text-slate-500">Carregando...</td></tr>
                      ) : erroEleitores || erroCabos || erroTarefas ? (
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

                {/* Mobile View (Cards) */}
                <div className="sm:hidden flex flex-col gap-2">
                  <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={
                          listaExibida.filter((i) => i.telefone && i.telefone.length >= 10).length > 0 && 
                          listaExibida.filter((i) => i.telefone && i.telefone.length >= 10).every((i) => selecionados.has(i.id))
                        }
                        onChange={handleSelectAll}
                      />
                      Selecionar Todos
                    </label>
                  </div>
                  {loadingEleitores || loadingCabos || loadingTarefas ? (
                    <div className="text-center py-10 text-slate-500">Carregando...</div>
                  ) : erroEleitores || erroCabos || erroTarefas ? (
                    <div className="text-center py-10 text-red-500">Erro ao carregar dados.</div>
                  ) : listaExibida.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">Nenhum registro encontrado.</div>
                  ) : (
                    listaExibida.map((item) => {
                      const enviou = enviados.has(item.id)
                      const invalidPhone = !item.telefone || item.telefone.length < 10
                      const selecionado = selecionados.has(item.id)
                      return (
                        <div 
                          key={item.id}
                          onClick={() => !invalidPhone && handleSelect(item)}
                          className={`flex items-center p-3 rounded-xl border transition-all ${
                            selecionado 
                              ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' 
                              : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                          } ${!invalidPhone ? 'active:scale-[0.98] cursor-pointer' : 'opacity-70 grayscale'}`}
                        >
                          <div className="mr-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50 h-5 w-5"
                              checked={selecionado}
                              onChange={() => handleSelect(item)}
                              disabled={invalidPhone}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.nome}</h4>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                              {maskTelefone(item.telefone) || 'Sem telefone'}
                            </p>
                          </div>
                          <div className="shrink-0 ml-2">
                            {enviou ? (
                              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                <Check className="h-3 w-3" /> <span className="hidden xs:inline">Enviado</span>
                              </span>
                            ) : invalidPhone && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                S/N
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
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
          </>
        )}
      </div>

      {/* Coluna Direita: Painel de Envio */}
      <div className="w-full lg:w-[400px] flex flex-col gap-6 shrink-0 lg:h-full">
        
        {/* Conexão + Configuração da Evolution API (compartilhado com o Funil) */}
        <div className="shrink-0">
          <ConexaoEvolution />
        </div>

        {/* Modo Anti-Bloqueio */}
        <div className="shrink-0">
          <AntiBloqueioPanel config={antiConfig} onChange={atualizarConfig} contadorHoje={contadorDia} />
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Inserir:</span>
              <button onClick={() => setMensagem(m => m + '{nome}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Nome Curto</button>
              <button onClick={() => setMensagem(m => m + '{nomeCompleto}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Nome Completo</button>
              <button onClick={() => setMensagem(m => m + '{telefone}')} className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md text-xs font-bold transition dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50">Telefone</button>
              <button onClick={() => setMensagem(m => m + '{Olá|Oi|Fala}')} title="Variação: sorteia uma das opções por envio" className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold transition dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">+ Variação {'{a|b}'}</button>
            </div>

            {aba === 'tarefas_funil' ? (
              <div className="p-4 bg-brand-50 rounded-xl border border-brand-100 dark:bg-brand-900/20 dark:border-brand-800 flex flex-col gap-2">
                <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                  <Check className="h-4 w-4 inline mr-1" />
                  Mensagem Automática do CRM
                </p>
                <p className="text-xs text-brand-600/80 dark:text-brand-400/80 leading-relaxed">
                  Os eleitores selecionados receberão automaticamente o texto definido em suas respectivas regras do funil. 
                  Você não precisa digitar a mensagem aqui.
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base sm:text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 resize-none"
                  placeholder="Digite a mensagem... Use {Olá|Oi} para variar o texto a cada envio."
                />

                <p className="text-[11px] font-medium text-slate-400">
                  {variacoes > 1
                    ? `✨ ${variacoes} variações possíveis desta mensagem (reduz o risco de bloqueio).`
                    : 'Dica: adicione variações {a|b|c} para cada pessoa receber um texto diferente.'}
                </p>
              </>
            )}
            
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

          {whatsappStatus?.status === 'open' ? (
            <div className="mt-auto">
              {autoRodando ? (
                <div className="space-y-3">
                  {/* Status do disparo em andamento */}
                  <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-800/50 dark:bg-brand-900/20">
                    <div className="flex items-center justify-between text-sm font-bold text-brand-700 dark:text-brand-300">
                      <span className="flex items-center gap-1.5">
                        <Timer className="h-4 w-4" />
                        {autoStatus || 'Processando...'}
                      </span>
                      {countdown > 0 && <span className="tabular-nums">{countdown}s</span>}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-200 dark:bg-brand-800/50">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${Math.min(100, (autoProgresso / Math.max(1, pessoasSelecionadas.filter(p => !enviados.has(p.id)).length + autoProgresso)) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                      {autoProgresso} enviada(s) nesta sessão
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={pausarRetomar}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
                    >
                      {pausado ? <><Play className="h-4 w-4" /> Retomar</> : <><Pause className="h-4 w-4" /> Pausar</>}
                    </button>
                    <button
                      onClick={cancelarDisparo}
                      className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600"
                    >
                      Parar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    {antiConfig.ativo
                      ? `🛡️ Envio protegido: intervalo de ${antiConfig.delayMinSeg}–${antiConfig.delayMaxSeg}s, pausa a cada ${antiConfig.lotePausaCada}.`
                      : '⚠️ Modo Anti-Bloqueio desligado — risco de banimento no envio em massa.'}
                  </p>
                  <button
                    onClick={dispararAuto}
                    disabled={pessoasSelecionadas.length === 0 || !mensagem.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-base font-bold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                  >
                    <Send className="h-5 w-5" />
                    Disparar para {pessoasSelecionadas.filter(p => !enviados.has(p.id)).length} pessoas
                  </button>
                </>
              )}
            </div>
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
