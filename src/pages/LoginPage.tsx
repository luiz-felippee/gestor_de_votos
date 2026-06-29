import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
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

  // Pré-aquece o backend assim que a tela abre: enquanto o usuário digita
  // e-mail/senha, o Render (free) já está acordando, evitando o cold start no "Entrar".
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

  // Inicializa o botão "Entrar com Google" (Google Identity Services).
  useEffect(() => {
    if (!googleClientId) return
    let cancelado = false
    function tryInit() {
      if (cancelado) return
      const g = (window as unknown as { google?: any }).google
      if (!g?.accounts?.id || !googleBtnRef.current) {
        setTimeout(tryInit, 200) // GSI ainda carregando
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
            navigate(destino, { replace: true })
          }
        },
      })
      googleBtnRef.current.innerHTML = ''
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      })
    }
    tryInit()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId])

  return (
    <div className="flex min-h-screen">
      {/* Lado Esquerdo - Branding (Visível apenas em telas grandes) */}
      <div className="relative hidden w-0 flex-1 lg:block bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-slate-900 to-indigo-950 opacity-90" />
        {/* Padrão decorativo */}
        <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V.5H32" fill="none" stroke="currentColor" strokeOpacity="0.2"></path>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)"></rect>
        </svg>

        {/* Logo fixo no topo */}
        <div className="absolute top-12 left-12 lg:top-20 lg:left-20 flex items-center gap-3 animate-fade-in">
          <Logo className="h-12 w-auto" iconClassName="h-12 w-12" />
          <span className="text-2xl font-bold tracking-tight text-white">Gestor de Votos</span>
        </div>

        {/* Texto principal — subido para o centro com animação de entrada escalonada */}
        <div className="absolute inset-0 flex flex-col justify-center p-12 lg:p-20">
          <div className="max-w-xl">
            <h1
              className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6 leading-tight animate-slide-up"
              style={{ animationDelay: '120ms', animationFillMode: 'both' }}
            >
              A inteligência por trás de campanhas vitoriosas.
            </h1>
            <p
              className="text-lg text-slate-300 font-medium animate-slide-up"
              style={{ animationDelay: '300ms', animationFillMode: 'both' }}
            >
              Gestor de Votos é a plataforma completa para gerenciamento de lideranças, eleitores e da sua base eleitoral.
            </p>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-8 lg:flex-none lg:w-[480px] xl:w-[560px] bg-white dark:bg-slate-950">
        <div className="mx-auto w-full max-w-sm lg:w-[380px]">
          <div className="text-center lg:text-left mb-10">
            <div className="lg:hidden mb-8 flex items-center justify-center gap-3">
              <Logo className="h-12 w-auto" iconClassName="h-12 w-12" />
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Gestor de Votos</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {step === 'login' ? 'Bem-vindo de volta' : 'Autenticação em Duas Etapas'}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {step === 'login' 
                ? 'Faça login para acessar o painel de controle da campanha.'
                : 'Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.'}
            </p>
          </div>

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Senha
                </label>
                <Link to="/esqueci-senha" className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className={`${inputClass} pr-10`}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-100 flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
              </div>
            )}

            {msgSucesso && (
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 flex items-start gap-3 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">{msgSucesso}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-slate-950"
              >
                {loading ? 'Entrando...' : 'Entrar na Plataforma'}
              </button>
              <button
                type="button"
                onClick={handleSignup}
                disabled={loading}
                className="w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80"
              >
                Criar Nova Conta
              </button>
            </div>

            {googleClientId && (
              <div>
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-slate-400 dark:bg-slate-950">ou</span>
                  </div>
                </div>
                <div ref={googleBtnRef} className="mt-3 flex justify-center" />
              </div>
            )}
          </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Código de Autenticação (6 dígitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={token2fa}
                  onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono py-4`}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {erro && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-100 flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || token2fa.length < 6}
                  className="flex w-full justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-slate-950"
                >
                  {loading ? 'Verificando...' : 'Verificar e Entrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('login')
                    setPendingUserId(null)
                    setToken2fa('')
                    setErro(null)
                  }}
                  className="w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80"
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

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm font-medium outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/40'
