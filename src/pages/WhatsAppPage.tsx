import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { ConfiguracaoWhatsApp } from '../lib/types'
import { Server, Smartphone } from 'lucide-react'

export function WhatsAppPage() {
  const [config, setConfig] = useState<ConfiguracaoWhatsApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  // Campos do formulário Z-API/Evolution
  const [apiUrl, setApiUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiInstanciaId, setApiInstanciaId] = useState('')

  // Campos do Chatbot / CRM
  const [msgBoasVindas, setMsgBoasVindas] = useState('')
  const [ativarChatbot, setAtivarChatbot] = useState(false)

  const [botStatus, setBotStatus] = useState<string>('desconectado')
  const [botQrCode, setBotQrCode] = useState<string | null>(null)

  async function carregar() {
    try {
      const data = await api.getConfigWhatsApp()
      setConfig(data)
      setApiUrl(data.api_url || '')
      setApiToken(data.api_token || '')
      setApiInstanciaId(data.api_instancia_id || '')
      setMsgBoasVindas(data.msg_boas_vindas || '')
      setAtivarChatbot(data.ativar_chatbot || false)
      
      if (data.modo === 'interno') {
        fetchStatusInterno()
      }
    } catch (e) {
      setMensagem('Erro ao carregar configurações.')
    } finally {
      setLoading(false)
    }
  }

  async function salvar(modo: string) {
    setSaving(true)
    setMensagem(null)
    try {
      const payload: Partial<ConfiguracaoWhatsApp> = {
        modo,
        api_url: apiUrl,
        api_token: apiToken,
        api_instancia_id: apiInstanciaId,
        msg_boas_vindas: msgBoasVindas,
        ativar_chatbot: ativarChatbot
      }
      const data = await api.updateConfigWhatsApp(payload)
      setConfig(data)
      setMensagem('Configuração salva com sucesso!')
      
      if (modo === 'interno') {
        fetchStatusInterno()
      }
    } catch (e: any) {
      setMensagem(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function fetchStatusInterno() {
    try {
      const res = await fetch(`${api.base}/api/whatsapp/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gv_token')}` }
      })
      const data = await res.json()
      setBotStatus(data.status)
      if (data.qr) setBotQrCode(data.qr)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    carregar()

    const socket = getSocket()
    socket.on('whatsapp:status', (st: string) => setBotStatus(st))
    socket.on('whatsapp:qr', (qr: string) => setBotQrCode(qr))

    return () => {
      socket.off('whatsapp:status')
      socket.off('whatsapp:qr')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando...</div>
  }

  const isZapi = config?.modo === 'zapi'
  const isInterno = config?.modo === 'interno'

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Central WhatsApp Automático
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure um robô para enviar fotos, vídeos e áudios reais direto pelo sistema.
        </p>
      </div>

      {mensagem && (
        <div className="mb-6 rounded-lg bg-slate-100 p-4 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {mensagem}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* OPÇÃO 1: API Externa */}
        <div className={`rounded-2xl border p-6 transition-all ${isZapi ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/30 dark:bg-brand-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${isZapi ? 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">API Externa Paga</h2>
              <p className="text-xs text-slate-500">Z-API, Evolution, ChatPro</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6 dark:text-slate-400">
            Mais estável e não precisa ficar lendo QR Code toda hora. Ideal para alto volume.
          </p>

          <div className="space-y-4 mb-6">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL da API</span>
              <input type="text" className={inputClass} value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="Ex: https://api.z-api.io/instances/..." />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Token de Segurança (Client-Token)</span>
              <input type="text" className={inputClass} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Ex: F7A9...32" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ID da Instância (Opcional)</span>
              <input type="text" className={inputClass} value={apiInstanciaId} onChange={e => setApiInstanciaId(e.target.value)} />
            </label>
          </div>

          <button
            onClick={() => salvar('zapi')}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition"
          >
            {isZapi ? 'Salvar Alterações' : 'Ativar API Externa'}
          </button>
        </div>

        {/* OPÇÃO 2: Robô Interno */}
        <div className={`rounded-2xl border p-6 transition-all ${isInterno ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/30 dark:bg-brand-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${isInterno ? 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Robô Interno (QR Code)</h2>
              <p className="text-xs text-slate-500">Gratuito, roda no seu servidor</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6 dark:text-slate-400">
            O seu servidor vai fingir ser o WhatsApp Web. Você precisará ler um QR Code na tela. Ideal para campanhas menores.
          </p>

          {isInterno ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center dark:bg-slate-800 dark:border-slate-700">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className={`w-3 h-3 rounded-full ${botStatus === 'conectado' ? 'bg-green-500' : botStatus === 'aguardando_qr' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                <p className="text-sm font-bold uppercase text-slate-700 dark:text-slate-300">
                  Status: {botStatus.replace('_', ' ')}
                </p>
              </div>

              {botStatus === 'conectado' ? (
                <div className="w-48 h-48 mx-auto bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center text-green-600">
                  <Smartphone className="w-12 h-12 mb-2" />
                  <span className="font-bold">Aparelho Conectado!</span>
                </div>
              ) : botQrCode ? (
                <div className="w-48 h-48 mx-auto bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden">
                  <img src={botQrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-48 h-48 mx-auto bg-white border border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  Iniciando Robô...
                </div>
              )}
              
              <p className="text-xs text-slate-500 mt-4">
                Abra o WhatsApp do seu celular, vá em "Aparelhos Conectados" e leia este código.
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-end">
              <button
                onClick={() => salvar('interno')}
                disabled={saving}
                className="w-full mt-8 py-2.5 rounded-lg bg-slate-800 text-white font-semibold text-sm hover:bg-slate-900 transition dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Ativar Robô Interno (Grátis)
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* SEÇÃO CHATBOT E CRM */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-800 mb-2 dark:text-slate-200">🤖 Chatbot & Atendimento</h2>
        <p className="text-sm text-slate-600 mb-6 dark:text-slate-400">Configure automações e mensagens automáticas para os eleitores.</p>
        
        <div className="grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mensagem de Boas-vindas (Cadastro)</span>
            <p className="text-xs text-slate-500 mb-2">Enviada automaticamente quando um novo eleitor é cadastrado. Use {'{{nome}}'} para personalizar.</p>
            <textarea 
              rows={4}
              className={inputClass} 
              value={msgBoasVindas} 
              onChange={e => setMsgBoasVindas(e.target.value)} 
              placeholder="Olá {{nome}}! Seja bem-vindo à nossa base." 
            />
          </label>

          <div>
            <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 rounded-lg dark:border-slate-700">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600" 
                checked={ativarChatbot}
                onChange={e => setAtivarChatbot(e.target.checked)}
              />
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Ativar Autoatendimento (Chatbot)</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Responde automaticamente quando o eleitor puxar assunto com seu número.
                </p>
              </div>
            </label>
            
            <button
              onClick={() => salvar(config?.modo || 'nenhum')}
              disabled={saving}
              className="mt-4 w-full py-2.5 rounded-lg bg-slate-800 text-white font-semibold text-sm hover:bg-slate-900 transition dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Salvar Automações
            </button>
          </div>
        </div>
      </div>
      
      {config?.modo !== 'nenhum' && (
         <div className="mt-8 text-center">
            <button 
              onClick={() => salvar('nenhum')}
              className="text-sm font-medium text-red-500 hover:text-red-600 underline"
            >
              Desativar WhatsApp Automático
            </button>
         </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/40'
