import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Wifi, WifiOff, Settings, QrCode, Loader2, Power } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'

/**
 * Painel de conexão com a Evolution API compartilhado entre a Central WhatsApp
 * e o Funil CRM. Reúne: configuração do servidor (URL + API Key), status da
 * conexão em tempo real, geração do QR Code e logout.
 *
 * `compact` renderiza uma versão enxuta (usada como banner no Funil).
 */
export function ConexaoEvolution({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient()
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [url, setUrl] = useState('')
  const [chave, setChave] = useState('')

  const { data: config } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: api.getWhatsAppConfig,
  })

  const { data: status } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: api.getWhatsAppStatus,
    // Enquanto não estiver conectado, verifica a cada 4s (para pegar o pareamento do QR).
    refetchInterval: (query) => (query.state.data?.status === 'open' ? false : 4000),
  })

  const conectado = status?.status === 'open'

  // Preenche o formulário com a URL já salva.
  useEffect(() => {
    if (config?.evo_api_url) setUrl(config.evo_api_url)
  }, [config?.evo_api_url])

  // Abre o painel de configuração automaticamente se ainda não há servidor configurado.
  useEffect(() => {
    if (config && !config.evo_api_url && !compact) setMostrarConfig(true)
  }, [config, compact])

  const salvarConfig = useMutation({
    mutationFn: () => api.saveWhatsAppConfig({ evo_api_url: url.trim(), evo_global_key: chave.trim() || undefined }),
    onSuccess: () => {
      toast.success('Configuração da Evolution salva!')
      setChave('')
      setMostrarConfig(false)
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao salvar configuração.'),
  })

  const conectar = useMutation({
    mutationFn: api.connectWhatsApp,
    onError: (err: any) => toast.error(err.message || 'Falha ao gerar QR Code.'),
  })

  const desconectar = useMutation({
    mutationFn: api.disconnectWhatsApp,
    onSuccess: () => {
      toast.success('WhatsApp desconectado.')
      conectar.reset()
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] })
    },
  })

  // Assim que conectar, some o QR.
  useEffect(() => {
    if (conectado && conectar.data) conectar.reset()
  }, [conectado])

  const configurado = !!config?.evo_api_url && (config?.evo_global_key_set || false)

  // ---- Versão compacta (banner do Funil) ----
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          conectado
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {conectado ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300">WhatsApp conectado — disparos habilitados</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-300">WhatsApp desconectado</span>
            </>
          )}
        </div>
        {!conectado && (
          <Link
            to="/whatsapp"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Conectar
          </Link>
        )}
      </div>
    )
  }

  // ---- Versão completa ----
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
          <Wifi className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          Conexão WhatsApp
        </h2>
        <div className="flex items-center gap-2">
          {conectado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400">
              <WifiOff className="h-3.5 w-3.5" /> Desconectado
            </span>
          )}
          <button
            onClick={() => setMostrarConfig((v) => !v)}
            title="Configurar servidor Evolution"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Formulário de Configuração da Evolution */}
      {mostrarConfig && (
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Informe os dados do seu servidor Evolution API.
          </p>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              URL do Servidor
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://evolution.seudominio.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              API Key Global {config?.evo_global_key_set && <span className="font-normal text-emerald-600">(já configurada)</span>}
            </label>
            <input
              type="password"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder={config?.evo_global_key_set ? '•••••••• (deixe em branco p/ manter)' : 'Cole a API Key global'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => salvarConfig.mutate()}
            disabled={salvarConfig.isPending || !url.trim()}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {salvarConfig.isPending ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      )}

      {/* Estado da conexão / QR Code */}
      {conectado ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/50 dark:bg-emerald-900/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
            <Check className="h-7 w-7" />
          </div>
          <p className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Seu WhatsApp está conectado e pronto para disparar mensagens.
          </p>
          <button
            onClick={() => desconectar.mutate()}
            disabled={desconectar.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Power className="h-3.5 w-3.5" /> Desconectar
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          {conectar.data?.qrcode ? (
            <>
              <p className="mb-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                Escaneie o QR Code no seu WhatsApp
                <span className="mt-0.5 block text-xs text-slate-400">Configurações → Aparelhos conectados → Conectar aparelho</span>
              </p>
              <img
                src={conectar.data.qrcode.startsWith('data:') ? conectar.data.qrcode : `data:image/png;base64,${conectar.data.qrcode}`}
                alt="QR Code de conexão"
                className="h-52 w-52 rounded-lg bg-white p-1"
              />
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando leitura...
              </p>
              <button
                onClick={() => conectar.mutate()}
                disabled={conectar.isPending}
                className="mt-2 text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
              >
                Gerar novo QR Code
              </button>
            </>
          ) : (
            <>
              <QrCode className="mb-3 h-10 w-10 text-slate-400" />
              <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {configurado
                  ? 'Gere o QR Code e conecte o número da sua campanha.'
                  : 'Configure o servidor Evolution (⚙️) para poder conectar.'}
              </p>
              <button
                onClick={() => conectar.mutate()}
                disabled={conectar.isPending || !configurado}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {conectar.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" /> Gerar QR Code de Conexão
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
