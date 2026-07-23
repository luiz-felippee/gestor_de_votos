import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { AuthLayout } from '../components/layout/AuthLayout'

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      await api.esqueciSenha(email)
      setSucesso(true)
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  if (sucesso) {
    return (
      <AuthLayout>
        <div className="text-center lg:text-left">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500 lg:mx-0" />
          <h2 className="mt-5 text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
            Verifique seu e-mail
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Se o e-mail <strong className="text-slate-700 dark:text-slate-300">{email}</strong> estiver
            cadastrado, enviamos um link para você redefinir sua senha.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center lg:text-left">
        <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
          Recuperar senha
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Digite seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {erro && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-medium text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {erro}
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>Endereço de e-mail</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} pl-11 pr-4`}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={btnPrimaryClass}>
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>

        <Link
          to="/login"
          className="block pt-1 text-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          Voltar para o login
        </Link>
      </form>
    </AuthLayout>
  )
}

const labelClass =
  'mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-300'

const inputBase =
  'w-full h-12 rounded-xl border border-slate-200 bg-slate-50/70 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900'

const btnPrimaryClass =
  'group flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 bg-none px-4 text-[15px] font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950 lg:bg-gradient-to-r lg:from-brand-600 lg:to-indigo-600 lg:shadow-lg lg:shadow-brand-600/25 lg:hover:bg-brand-600 lg:hover:shadow-xl lg:hover:shadow-brand-600/30 lg:hover:brightness-[1.07]'
