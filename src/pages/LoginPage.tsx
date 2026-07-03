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
    <div className="fixed inset-0 flex bg-white dark:bg-slate-950 font-sans selection:bg-brand-500/30">
      
      {/* Esquerda - Branding (Mesh Gradient e Tipografia Polida) */}
      <div className="relative hidden w-full lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-slate-950 px-12 py-16 xl:px-20 xl:py-20">
        {/* Mesh Gradient Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-brand-600/30 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[0%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
          <div className="absolute top-[40%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[100px] mix-blend-screen" />
          {/* Subtle noise texture over gradient */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />
        </div>

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Logo className="h-10 w-auto text-white" iconClassName="h-10 w-10 text-brand-400" />
          <span className="text-xl font-bold tracking-tight text-white">Gestor de Votos</span>
        </div>

        {/* Center Content */}
        <div className="relative z-10 max-w-lg mt-20">
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Eleve sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">Campanha</span> ao próximo nível.
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            A plataforma definitiva para líderes políticos. Mapeie lideranças, engaje eleitores e acompanhe metas em tempo real com inteligência de dados.
          </p>
        </div>

        {/* Bottom Features */}
        <div className="relative z-10 grid grid-cols-2 gap-8 pt-20">
          <div className="flex flex-col gap-2">
             <CheckCircle2 className="h-6 w-6 text-brand-400" />
             <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gestão Descentralizada</h3>
             <p className="text-sm text-slate-400">Distribua metas e acompanhe o desempenho de cada liderança.</p>
          </div>
          <div className="flex flex-col gap-2">
             <CheckCircle2 className="h-6 w-6 text-indigo-400" />
             <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mapas Inteligentes</h3>
             <p className="text-sm text-slate-400">Visualize a distribuição dos seus votos de forma geográfica.</p>
          </div>
        </div>
      </div>

      {/* Direita - Formulário minimalista */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px]">
          
          {/* Logo Mobile */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-12">
            <Logo className="h-10 w-auto" iconClassName="h-10 w-10 text-brand-600 dark:text-brand-500" />
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Gestor de Votos</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {step === 'login' ? 'Acesse sua conta' : 'Verificação de Segurança'}
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
              {step === 'login' 
                ? 'Insira suas credenciais para entrar na plataforma.'
                : 'Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.'}
            </p>
          </div>

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 ml-1">
                    E-mail
                  </label>
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
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Senha
                    </label>
                    <Link to="/esqueci-senha" className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors">
                      Esqueci a senha
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className={`${inputClass} pr-12`}
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {erro && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/20 animate-in fade-in slide-in-from-bottom-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
                </div>
              )}

              {msgSucesso && (
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100 flex items-start gap-3 dark:bg-emerald-500/10 dark:border-emerald-500/20 animate-in fade-in slide-in-from-bottom-2">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">{msgSucesso}</p>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={btnPrimaryClass}
                >
                  {loading ? 'Entrando...' : 'Entrar na Plataforma'}
                </button>
                
                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={loading}
                  className={btnSecondaryClass}
                >
                  Criar Nova Conta
                </button>
              </div>

              {googleClientId && (
                <>
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                    <span className="flex-shrink-0 mx-4 text-xs font-bold uppercase tracking-wider text-slate-400">OU</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                  <div className="flex justify-center w-full">
                    <div ref={googleBtnRef} className="w-full flex justify-center [&>div]:w-full" />
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 ml-1">
                  Código de Autenticação (6 dígitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={token2fa}
                  onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} text-center text-3xl tracking-[0.3em] font-mono py-5 shadow-inner bg-slate-50 dark:bg-slate-900/50`}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {erro && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{erro}</p>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={loading || token2fa.length < 6}
                  className={btnPrimaryClass}
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

// Estilos premium extraídos para manter o código limpo
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3.5 text-base sm:text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-900/30 dark:text-white dark:focus:bg-slate-900'

const btnPrimaryClass =
  'flex w-full justify-center items-center rounded-xl bg-slate-900 dark:bg-brand-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-slate-900/20 dark:shadow-brand-500/20 transition-all hover:scale-[1.01] hover:shadow-slate-900/30 dark:hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-95 disabled:opacity-70 dark:focus:ring-offset-slate-950'

const btnSecondaryClass =
  'w-full justify-center rounded-xl border-2 border-slate-200 bg-transparent px-4 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-70 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50'
