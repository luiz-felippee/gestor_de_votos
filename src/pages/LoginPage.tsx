import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle, Eye, EyeOff, CheckCircle2, ShieldCheck, Mail, Lock, LogIn, ArrowRight, Sparkles } from 'lucide-react'
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

  // Pre-aquece o backend
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

    // Carrega o script do Google só aqui (não em todas as páginas)
    const GSI = 'https://accounts.google.com/gsi/client'
    if (!document.querySelector(`script[src="${GSI}"]`)) {
      const s = document.createElement('script')
      s.src = GSI
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }

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

  const FEATURES: [string, string][] = [
    ['Gestão descentralizada', 'Distribua metas e acompanhe cada liderança.'],
    ['Mapas inteligentes', 'Visualize a distribuição dos votos no território.'],
    ['Dados em tempo real', 'Decisões rápidas com o painel sempre atualizado.'],
  ]

  return (
    <main className="min-h-[100dvh] bg-slate-950 font-sans dark:bg-slate-950">
      {/* Mobile: conjunto centralizado sobre o azul · Desktop: duas colunas em tela cheia */}
      <div className="relative flex min-h-[100dvh] flex-col max-lg:justify-center lg:grid lg:grid-cols-[1.05fr_1fr]">

        {/* Fundo cobrindo a tela toda — apenas mobile (halo azul no topo e na base) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a2352] via-[#28347a] to-[#161d47]" />
          <div className="absolute inset-0 [background:radial-gradient(120%_55%_at_50%_2%,rgba(129,140,248,0.38),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        </div>

        {/* ===================== Painel da marca ===================== */}
        <div className="relative isolate flex shrink-0 flex-col overflow-hidden px-6 pb-7 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-10 sm:pb-8 lg:px-14 lg:py-14 xl:px-20">
          {/* Fundo com gradiente + orbes — apenas desktop (no mobile usamos o full-screen acima) */}
          <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
            <div className="absolute -top-40 -left-24 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-[110px]" />
            <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-[110px]" />
            <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
          </div>

          {/* Logo */}
          <div className="relative flex shrink-0 items-center justify-center gap-2.5 lg:justify-start">
            <Logo iconClassName="h-9 w-9 lg:h-10 lg:w-10" />
            <span className="text-lg font-bold tracking-tight text-white">Gestor de Votos</span>
          </div>

          {/* Hero — mobile (compacto) */}
          <div className="mt-6 flex flex-col items-center text-center lg:hidden">
            <h1 className="text-[21px] font-extrabold leading-[1.2] tracking-tight text-white">
              A inteligência de{' '}
              <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
                campanhas vitoriosas
              </span>
            </h1>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-400">
              Lideranças, eleitores e metas — tudo em uma só plataforma.
            </p>
          </div>

          {/* Hero — desktop */}
          <div className="hidden max-w-lg flex-1 flex-col justify-center lg:flex">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> Plataforma de gestão de campanha
            </span>
            <h1 className="mt-6 text-[2.75rem] font-extrabold leading-[1.08] tracking-tight text-white xl:text-5xl">
              A inteligência por trás de{' '}
              <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
                campanhas vitoriosas
              </span>.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
              Mapeie lideranças, engaje eleitores e acompanhe metas em tempo real — tudo em uma única plataforma.
            </p>

            <ul className="mt-10 space-y-5">
              {FEATURES.map(([titulo, desc]) => (
                <li key={titulo} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{titulo}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Rodapé — desktop */}
          <p className="relative hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 lg:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            © {new Date().getFullYear()} Gestor de Votos · Conexão segura e dados criptografados
          </p>
        </div>

        {/* ===================== Painel do formulário ===================== */}
        <div className="relative z-20 flex flex-col px-4 pt-3 lg:flex-1 lg:justify-center lg:bg-white lg:px-12 lg:pt-0 dark:lg:bg-slate-900">
          {/* Mobile: card flutuante sobre o azul · Desktop: coluna direita em tela cheia */}
          <div className="mx-auto w-full max-w-[25rem] rounded-3xl bg-white p-6 shadow-2xl shadow-black/40 ring-1 ring-black/5 sm:p-7 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 dark:bg-slate-900 dark:ring-white/5 lg:dark:bg-transparent lg:dark:ring-0">

            {/* Cabeçalho */}
            <div className="mb-6">
              <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
                {step === 'login' ? 'Bem-vindo de volta' : 'Verificação de segurança'}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {step === 'login'
                  ? 'Entre com suas credenciais para continuar.'
                  : 'Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.'}
              </p>
            </div>

            {step === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">

                {/* E-mail */}
                <div>
                  <label className={labelClass}>E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputBase} pl-11 pr-4`}
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className={labelClass + ' mb-0'}>Senha</label>
                    <Link to="/esqueci-senha" className="text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400">
                      Esqueci a senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className={`${inputBase} pl-11 pr-12`}
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

                {erro && <MensagemErro texto={erro} />}
                {msgSucesso && <MensagemSucesso texto={msgSucesso} />}

                <button type="submit" disabled={loading} className={btnPrimaryClass}>
                  {loading ? (
                    'Entrando...'
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Entrar na plataforma
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>

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

                <p className="pt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                  Ainda não tem conta?{' '}
                  <button type="button" onClick={handleSignup} disabled={loading} className="font-bold text-brand-600 transition-colors hover:text-brand-500 disabled:opacity-60 dark:text-brand-400">
                    Criar agora
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Código de autenticação (6 dígitos)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={token2fa}
                    onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ''))}
                    className={`${inputBase} px-4 py-4 text-center font-mono text-3xl tracking-[0.4em]`}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                {erro && <MensagemErro texto={erro} />}

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

          {/* Rodapé de segurança (mobile) — sobre o azul, abaixo do card */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Conexão segura e dados criptografados
          </p>
        </div>
      </div>
    </main>
  )
}

function MensagemErro({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5 dark:border-red-500/20 dark:bg-red-500/10">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
      <p className="text-sm font-medium text-red-800 dark:text-red-400">{texto}</p>
    </div>
  )
}

function MensagemSucesso({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-500" />
      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">{texto}</p>
    </div>
  )
}

// Estilos compartilhados — tema-consciente e consistente entre mobile/desktop.
const labelClass =
  'mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-300'

// Base sem padding horizontal — cada campo adiciona o seu (pl-11 quando tem ícone).
const inputBase =
  'w-full h-12 rounded-xl border border-slate-200 bg-slate-50/70 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900'

const btnPrimaryClass =
  'group flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 text-[15px] font-bold text-white shadow-lg shadow-brand-600/25 transition hover:shadow-xl hover:shadow-brand-600/30 hover:brightness-[1.07] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950'

const btnSecondaryClass =
  'flex w-full h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
