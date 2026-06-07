import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle } from 'lucide-react'
import { Logo } from '../components/Logo'

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

        <div className="absolute inset-0 flex flex-col justify-between p-12 lg:p-20">
          <div>
            <Logo className="h-12 w-auto" iconClassName="h-12 w-12" />
          </div>
          <div className="max-w-xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6 leading-tight">
              A inteligência por trás de campanhas vitoriosas.
            </h1>
            <p className="text-lg text-slate-300 font-medium">
              Gestor de Votos é a plataforma completa para gerenciamento de lideranças, eleitores e comunicação via WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:w-[480px] xl:w-[560px] bg-white dark:bg-slate-950">
        <div className="mx-auto w-full max-w-sm lg:w-[380px]">
          <div className="text-center lg:text-left mb-10">
            <div className="lg:hidden mb-8 flex justify-center">
              <Logo className="h-12 w-auto" iconClassName="h-12 w-12" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Faça login para acessar o painel de controle da campanha.
            </p>
          </div>

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
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
                placeholder="••••••••"
              />
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
                className="flex w-full justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-slate-950"
              >
                {loading ? 'Entrando...' : 'Entrar na Plataforma'}
              </button>
              {acordando && (
                <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  O servidor estava em repouso e está acordando — pode levar até 1 minuto. Aguarde...
                </p>
              )}
              <button
                type="button"
                onClick={handleSignup}
                disabled={loading}
                className="w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80"
              >
                Criar Nova Conta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/40'
