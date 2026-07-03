import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Logo } from '../components/Logo'
import { prewarmBackend } from '../lib/api'

export function LoginPage() {
  const { signIn, signInWithGoogle, signIn2FA, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino =
    (location.state as { from?: string } | null)?.from ?? '/'
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // 2FA States
  const [step, setStep] = useState<'login' | '2fa'>('login')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [token2fa, setToken2fa] = useState('')

  // Pré-aquece o backend
  useEffect(() => {
    prewarmBackend()
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsgSucesso(null)
    setLoading(true)

    const res = await signIn(email, senha)
    setLoading(false)
    if (res.error) {
      setErro(res.error)
      return
    }
    
    if (res.require2FA) {
      setPendingUserId(res.userId!)
      setStep('2fa')
      return
    }
    
    sessionStorage.setItem('justLoggedIn', 'true')
    navigate(destino, { replace: true })
  }

  async function handle2FASubmit(e: FormEvent) {
    e.preventDefault()
    if (!pendingUserId || !token2fa) return
    
    setErro(null)
    setLoading(true)
    const { error } = await signIn2FA(pendingUserId, token2fa)
    setLoading(false)
    
    if (error) {
      setErro(error)
      return
    }
    
    sessionStorage.setItem('justLoggedIn', 'true')
    navigate(destino, { replace: true })
  }

  async function handleSignup() {
    if (!email || !senha) {
      setErro("Preencha e-mail e senha para criar a conta.")
      return
    }
    setErro(null)
    setMsgSucesso(null)
    setLoading(true)

    const { error, message } = await signUp(email, senha)
    if (error) {
      setErro(error)
    } else {
      setMsgSucesso(message || "Conta criada com sucesso!")
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!googleClientId) return
    let cancelado = false
    function tryInit() {
      if (cancelado) return
      const g = (window as unknown as { google?: any }).google
      if (!g?.accounts?.id || !googleBtnRef.current) {
        setTimeout(tryInit, 200)
        return
      }
      g.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp: { credential: string }) => {
          const res = await signInWithGoogle(resp.credential)
          if (res.error) {
            setErro(res.error)
          } else if (res.require2FA) {
            setPendingUserId(res.userId!)
            setStep('2fa')
          } else {
            sessionStorage.setItem('justLoggedIn', 'true')
            navigate(destino, { replace: true })
          }
        },
      })
      googleBtnRef.current.innerHTML = ''
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      })
    }
    tryInit()
    return () => {
      cancelado = true
    }
  }, [googleClientId])

  return (
    <div className="fixed inset-0 z-50 grid overflow-y-auto bg-white dark:bg-slate-950 font-sans lg:grid-cols-2">

      {/* Esquerda — Painel de marca (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 xl:p-16 lg:flex">
        {/* Acentos de gradiente sutis */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-600/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Logo iconClassName="h-10 w-10" />
          <span className="text-lg font-bold tracking-tight text-white">Gestor de Votos</span>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-5xl">
            A inteligência por trás de{' '}
            <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
              campanhas vitoriosas
            </span>.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            Mapeie lideranças, engaje eleitores e acompanhe metas em tempo real — tudo em uma única plataforma.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              ['Gestão descentralizada', 'Distribua metas e acompanhe o desempenho de cada liderança.'],
              ['Mapas inteligentes', 'Visualize a distribuição dos seus votos de forma geográfica.'],
              ['Dados em tempo real', 'Decisões rápidas com o painel sempre atualizado.'],
            ].map(([titulo, desc]) => (
              <li key={titulo} className="flex items-start gap-3.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{titulo}</p>
                  <p className="text-sm text-slate-400">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Rodapé */}
        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Gestor de Votos · Conexão segura e dados criptografados
        </p>
      </div>

      {/* Direita — Formulário */}
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">

          {/* Logo (mobile) */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Logo iconClassName="h-10 w-10" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Gestor de Votos</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {step === 'login' ? 'Acesse sua conta' : 'Verificação de segurança'}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {step === 'login'
                ? 'Insira suas credenciais para entrar na plataforma.'
                : 'Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.'}
            </p>
          </div>

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">

              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={labelClass + ' mb-0'}>Senha</label>
                  <Link to="/esqueci-senha" className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400">
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={`${inputClass} pr-12`}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                    tabIndex={-1}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {erro && (
                <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-3.5 dark:border-red-500/20 dark:bg-red-500/10">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
                </div>
              )}

              {msgSucesso && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">{msgSucesso}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-1">
                <button type="submit" disabled={loading} className={btnPrimaryClass}>
                  {loading ? 'Entrando...' : 'Entrar na plataforma'}
                </button>
                <button type="button" onClick={handleSignup} disabled={loading} className={btnSecondaryClass}>
                  Criar nova conta
                </button>
              </div>

              {googleClientId && (
                <>
                  <div className="flex items-center gap-4 py-1">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">ou</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <div ref={googleBtnRef} className="flex w-full justify-center [&>div]:w-full" />
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-5">
              <div>
                <label className={labelClass}>Código de autenticação (6 dígitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={token2fa}
                  onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} py-4 text-center font-mono text-3xl tracking-[0.4em]`}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {erro && (
                <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-3.5 dark:border-red-500/20 dark:bg-red-500/10">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-1">
                <button type="submit" disabled={loading || token2fa.length < 6} className={btnPrimaryClass}>
                  {loading ? 'Verificando...' : 'Verificar e entrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('login')
                    setPendingUserId(null)
                    setToken2fa('')
                    setErro(null)
                  }}
                  className={btnSecondaryClass}
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// Estilos compartilhados — tema-consciente e consistente entre mobile/desktop.
const labelClass =
  'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300'

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3 text-base font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900'

const btnPrimaryClass =
  'flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950'

const btnSecondaryClass =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
