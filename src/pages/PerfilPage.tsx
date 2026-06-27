import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import { AlertCircle, CheckCircle, ShieldCheck, ShieldAlert } from 'lucide-react'

export function PerfilPage() {
  const { usuario } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null)
  
  // 2FA states
  const [loading2FA, setLoading2FA] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [token2fa, setToken2fa] = useState('')
  const [senhaDisable, setSenhaDisable] = useState('')

  // O próprio objeto usuário não nos diz se 2FA está ativo, a menos que adicionemos lá.
  // Vamos presumir que precisa de uma flag global no usuário ou fazer um check no me().
  // Para simplificar a demonstração, se der erro ao gerar, é porque já tá ativo (tratado pelo backend).
  const [is2FAEnabled, setIs2FAEnabled] = useState(false) 

  async function handleGenerate2FA() {
    setErro(null)
    setMsgSucesso(null)
    setLoading2FA(true)
    try {
      const res = await api.generate2FA()
      setQrCode(res.qrCodeUrl)
      setSecret(res.secret)
    } catch (err) {
      setErro((err as Error).message)
      if ((err as ApiError).message.includes('já está ativado')) {
        setIs2FAEnabled(true)
      }
    } finally {
      setLoading2FA(false)
    }
  }

  async function handleEnable2FA() {
    if (!token2fa || token2fa.length < 6) return
    setErro(null)
    setMsgSucesso(null)
    setLoading2FA(true)
    try {
      const res = await api.enable2FA(token2fa)
      setMsgSucesso(res.message)
      setQrCode(null)
      setSecret(null)
      setToken2fa('')
      setIs2FAEnabled(true)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading2FA(false)
    }
  }

  async function handleDisable2FA() {
    if (!senhaDisable) return
    setErro(null)
    setMsgSucesso(null)
    setLoading2FA(true)
    try {
      const res = await api.disable2FA(senhaDisable)
      setMsgSucesso(res.message)
      setSenhaDisable('')
      setIs2FAEnabled(false)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading2FA(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Minha Conta
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gerencie suas preferências de segurança e perfil.
        </p>
      </div>

      <div className="space-y-6">
        {/* Informações Básicas */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="px-6 py-5">
            <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-white">Perfil</h3>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              <p><strong>Nome:</strong> {usuario?.nome}</p>
              <p><strong>E-mail:</strong> {usuario?.email}</p>
              <p><strong>Nível de Acesso:</strong> <span className="uppercase">{usuario?.role}</span></p>
            </div>
          </div>
        </div>

        {/* Segurança (2FA) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${is2FAEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                {is2FAEnabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-base font-semibold leading-6 text-slate-900 dark:text-white">Autenticação em Duas Etapas (2FA)</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Adiciona uma camada extra de segurança à sua conta exigindo um código no login.
                </p>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-5">
            {erro && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> {erro}
              </div>
            )}
            {msgSucesso && (
              <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> {msgSucesso}
              </div>
            )}

            {!is2FAEnabled && !qrCode && (
              <button
                onClick={handleGenerate2FA}
                disabled={loading2FA}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {loading2FA ? 'Carregando...' : 'Configurar 2FA'}
              </button>
            )}

            {!is2FAEnabled && qrCode && (
              <div className="animate-fade-in space-y-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  1. Escaneie o QR Code abaixo usando o Google Authenticator ou Authy.
                </p>
                <div className="inline-block rounded-xl bg-white p-2 shadow-sm border border-slate-200">
                  <img src={qrCode} alt="QR Code 2FA" className="h-48 w-48" />
                </div>
                <p className="text-sm text-slate-500">Se não puder escanear, use a chave: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">{secret}</code></p>
                
                <div className="pt-2">
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    2. Digite o código de 6 dígitos gerado pelo aplicativo:
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={token2fa}
                      onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ''))}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono tracking-widest text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="000000"
                    />
                    <button
                      onClick={handleEnable2FA}
                      disabled={loading2FA || token2fa.length < 6}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Verificar e Ativar
                    </button>
                    <button
                      onClick={() => { setQrCode(null); setToken2fa(''); }}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {is2FAEnabled && (
              <div className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  A Autenticação em Duas Etapas está ativa. Para desativar, confirme sua senha atual:
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="password"
                    value={senhaDisable}
                    onChange={(e) => setSenhaDisable(e.target.value)}
                    className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    placeholder="Sua senha de login"
                  />
                  <button
                    onClick={handleDisable2FA}
                    disabled={loading2FA || !senhaDisable}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading2FA ? 'Desativando...' : 'Desativar 2FA'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
