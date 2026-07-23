import { useState, type FormEvent, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import { AuthLayout } from '../components/layout/AuthLayout'

export function ResetarSenhaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!token) {
      setErro('Token de recuperação não encontrado ou inválido.')
    }
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      return setErro('A nova senha deve ter no mínimo 6 caracteres.')
    }

    if (senha !== confirmarSenha) {
      return setErro('As senhas não coincidem.')
    }

    setLoading(true)

    try {
      await api.resetarSenha(token as string, senha)
      setSucesso(true)
      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        navigate('/login')
      }, 3000)
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
            Senha alterada!
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Sua senha foi redefinida com sucesso. Redirecionando para o login...
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400"
          >
            Ir para o login agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center lg:text-left">
        <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
          Criar nova senha
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Digite sua nova senha de acesso.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {erro && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-medium text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {erro}
          </div>
        )}

        <div>
          <label className={labelClass}>Nova senha</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              disabled={!token}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={`${inputBase} pl-11 pr-4`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Confirmar nova senha</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              disabled={!token}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className={`${inputBase} pl-11 pr-4`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" disabled={loading || !token} className={btnPrimaryClass}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
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
  'w-full h-12 rounded-xl border border-slate-200 bg-slate-50/70 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 disabled:opacity-60 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900'

const btnPrimaryClass =
  'group flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 bg-none px-4 text-[15px] font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60 dark:focus:ring-offset-slate-950 lg:bg-gradient-to-r lg:from-brand-600 lg:to-indigo-600 lg:shadow-lg lg:shadow-brand-600/25 lg:hover:bg-brand-600 lg:hover:shadow-xl lg:hover:shadow-brand-600/30 lg:hover:brightness-[1.07]'
