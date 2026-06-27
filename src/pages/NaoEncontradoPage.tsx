import { Link } from 'react-router-dom'
import { Map, ArrowLeft } from 'lucide-react'

export function NaoEncontradoPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <Map className="h-10 w-10 animate-bounce" />
      </div>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
        404 — Página não encontrada
      </h1>
      <p className="mt-3 text-base text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
        O endereço digitado não existe ou a página foi removida. Use o menu de navegação ou volte para o painel inicial.
      </p>
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-98 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Início
        </Link>
      </div>
    </div>
  )
}
