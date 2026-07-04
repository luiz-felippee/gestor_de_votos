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

  // Intro Animation States
  const [introPhase, setIntroPhase] = useState<0 | 1 | 2 | 3 | 4>(0)

  // Pre-aquece o backend e controla a intro
  useEffect(() => {
    prewarmBackend()
    
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntro')
    if (hasSeenIntro) {
      setIntroPhase(4)
      return
    }

    // Phase 1: Logo fades in (0ms)
    setTimeout(() => setIntroPhase(1), 100)
    
    // Phase 2: Text fades in (1500ms)
    const t1 = setTimeout(() => setIntroPhase(2), 1500)
    
    // Phase 3: Entire intro fades out (4500ms)
    const t2 = setTimeout(() => setIntroPhase(3), 4500)
    
    // Phase 4: Unmount (5200ms)
    const t3 = setTimeout(() => {
      setIntroPhase(4)
      sessionStorage.setItem('hasSeenIntro', 'true')
    }, 5200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
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
    <>
      {/* Animação de Entrada */}
      {introPhase < 4 && (
        <div 
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 px-6 transition-opacity duration-700 ease-in-out ${introPhase === 3 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          {/* Acentos de gradiente no fundo */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-600/10 blur-3xl" />
            <div className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-600/10 blur-3xl" />
          </div>

          <div className={`relative z-10 transition-all duration-1000 transform ${introPhase >= 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8'}`}>
            <div className="flex flex-col items-center gap-4">
              <Logo iconClassName="h-20 w-20 lg:h-24 lg:w-24 drop-shadow-2xl" />
            </div>
          </div>
          
          <div className={`relative z-10 mt-10 max-w-lg text-center transition-all duration-1000 transform ${introPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
              A inteligência por trás de <br className="hidden sm:block"/>
              <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
                campanhas vitoriosas
              </span>
            </h1>
            <p className={`mt-5 text-base sm:text-lg text-slate-300 font-medium transition-all duration-1000 delay-500 ${introPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Organize e no tempo certo.
            </p>
          </div>
        </div>
      )}

      {/* Container Principal do Login */}
      <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-950 font-sans lg:grid lg:grid-cols-2 lg:bg-white lg:dark:bg-slate-950 transition-opacity duration-1000 ${introPhase >= 3 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Painel da Marca (Topo no Mobile, Esquerda no Desktop) */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-6 pt-10 sm:p-12 lg:p-12 xl:p-16">
        {/* Acentos de gradiente sutis */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-600/25 blur-3xl lg:bg-brand-600/25" />
          <div className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-3xl lg:bg-indigo-600/20" />
          <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Logo iconClassName="h-8 w-8 lg:h-10 lg:w-10" />
          <span className="text-lg font-bold tracking-tight text-white">Gestor de Votos</span>
        </div>

        {/* Mensagem curta (Mobile) */}
        <div className="relative z-10 mt-8 mb-4 lg:hidden">
          <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white">
            A inteligência de <br/>
            <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">
              campanhas vitoriosas
            </span>.
          </h1>
        </div>

        {/* Conteúdo central (Desktop) */}
        <div className="relative z-10 max-w-md hidden lg:block mt-16 mb-auto">
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

        {/* Rodapé (Desktop) */}
        <p className="relative z-10 text-xs text-slate-500 hidden lg:block">
          © {new Date().getFullYear()} Gestor de Votos · Conexão segura e dados criptografados
        </p>
      </div>

      {/* Direita — Formulário */}
      <div className="relative z-20 flex flex-1 items-center justify-center rounded-t-[2.5rem] bg-white px-6 py-10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] -mt-6 sm:px-10 lg:mt-0 lg:rounded-none lg:shadow-none dark:bg-slate-950 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
        <div className="w-full max-w-md lg:max-w-sm xl:max-w-md">


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
    </>
  )
}

// Estilos compartilhados — tema-consciente e consistente entre mobile/desktop.
const labelClass =
  'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300'

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-base font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900'

const btnPrimaryClass =
  'flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950'

const btnSecondaryClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
