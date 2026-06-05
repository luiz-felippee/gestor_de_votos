import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle } from 'lucide-react'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino =
    (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [acordando, setAcordando] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsgSucesso(null)
    setLoading(true)
    // Se demorar, avisa que o servidor (plano grátis) pode estar "acordando"
    const aviso = setTimeout(() => setAcordando(true), 4000)

    const { error } = await signIn(email, senha)
    clearTimeout(aviso)
    setAcordando(false)
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

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="relative w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl shadow-brand-500/30">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Acesso restrito à equipe de campanha
          </p>
        </div>

        <div className="space-y-6">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Senha
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
        </div>

        {erro && (
          <div className="mt-6 rounded-lg bg-red-500/10 p-4 border border-red-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-500 font-medium">{erro}</p>
          </div>
        )}

        {msgSucesso && (
          <div className="mt-6 rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/20 flex items-center gap-3">
            <p className="text-sm text-emerald-500 font-medium">{msgSucesso}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {acordando && (
            <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              O servidor estava em repouso e está acordando — pode levar até 1
              minuto na primeira vez. Aguarde...
            </p>
          )}
          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Criar Conta
          </button>
        </div>
      </form>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/40'
