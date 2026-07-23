import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle, Eye, EyeOff, CheckCircle2, Mail, Lock, LogIn, ArrowRight } from 'lucide-react'
import { AuthLayout } from '../components/layout/AuthLayout'
import { useKeepAlive } from '../hooks/useKeepAlive'

export function LoginPage() {
  const { signIn, signInWithGoogle, signIn2FA } = useAuth()
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

  // Pré-aquece o backend e mantém aquecido enquanto a pessoa está na tela de login.
  // Antes era um prewarm único no mount: se a pessoa demorasse >15min pra digitar a
  // senha (gerenciador de senha, distração), o Render voltava a dormir e o clique em
  // "Entrar" pagava o cold start inteiro. Reusa o mesmo hook do pós-login.
  useKeepAlive(true)

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

  return (
    <AuthLayout>
      {/* Cabeçalho */}
      <div className="mb-6 text-center lg:text-left">
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
                <LogIn className="hidden h-5 w-5 lg:block" />
                <span className="lg:hidden">Entrar</span>
                <span className="hidden lg:inline">Entrar na plataforma</span>
                <ArrowRight className="hidden h-4 w-4 transition-transform group-hover:translate-x-0.5 lg:block" />
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

          {/* Cadastro é feito pelo administrador da campanha (auto-cadastro desativado),
              então não convidamos a "criar conta" — isso levava a um erro. */}
          <p className="pt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            Não tem acesso? Fale com o administrador da sua campanha.
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
    </AuthLayout>
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

// Mobile: sólido e sem sombra colorida (bg-none desliga o degradê e deixa o bg-brand-600
// aparecer). Desktop (lg:) mantém o visual aprovado com degradê e brilho.
const btnPrimaryClass =
  'group flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 bg-none px-4 text-[15px] font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950 lg:bg-gradient-to-r lg:from-brand-600 lg:to-indigo-600 lg:shadow-lg lg:shadow-brand-600/25 lg:hover:bg-brand-600 lg:hover:shadow-xl lg:hover:shadow-brand-600/30 lg:hover:brightness-[1.07]'

const btnSecondaryClass =
  'flex w-full h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
