import { useState } from 'react'
import { api } from '../lib/api'
import { CheckCircle2, Crown, Zap, AlertTriangle } from 'lucide-react'

export function BillingPage() {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function assinar(planoId: string) {
    try {
      setLoading(true)
      setErro(null)
      const res = await api.billingCheckout(planoId)
      window.location.href = res.url // Redireciona pro Checkout do Stripe
    } catch (err: any) {
      setErro(err.message || 'Erro ao abrir o checkout.')
      setLoading(false)
    }
  }

  async function gerenciarAssinatura() {
    try {
      setLoading(true)
      setErro(null)
      const res = await api.billingPortal()
      window.location.href = res.url
    } catch (err: any) {
      setErro(err.message || 'Erro ao abrir portal.')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planos e Assinatura</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie seu plano e aumente seus limites no Gestor de Votos.</p>
      </div>

      {erro && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 dark:bg-red-900/20 dark:border-red-900/50">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Atenção</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{erro}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Preços Simples */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Grátis */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Grátis</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Para testar o sistema.</p>
          <div className="my-6">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">R$ 0</span>
            <span className="text-base font-medium text-slate-500">/mês</span>
          </div>
          <ul className="mb-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Até 500 eleitores</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Até 3 Lideranças</li>
            <li className="flex items-center gap-2 opacity-40"><CheckCircle2 className="h-4 w-4" /> Suporte por e-mail</li>
          </ul>
          <button disabled className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500">
            Plano Atual
          </button>
        </div>

        {/* Básico */}
        <div className="relative rounded-2xl border-2 border-brand-500 bg-white p-6 shadow-lg dark:border-brand-500 dark:bg-slate-900">
          <div className="absolute -top-3 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide">
              Mais Popular
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Básico <Zap className="h-4 w-4 text-amber-500" />
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Para campanhas locais.</p>
          <div className="my-6">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">R$ 97</span>
            <span className="text-base font-medium text-slate-500">/mês</span>
          </div>
          <ul className="mb-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-500" /> Até 5.000 eleitores</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-500" /> Até 10 Lideranças</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-500" /> Mapa de calor e relatórios</li>
          </ul>
          <button 
            onClick={() => assinar('basico')}
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Assinar Básico
          </button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Pro <Crown className="h-4 w-4 text-amber-500" />
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Para grandes equipes.</p>
          <div className="my-6">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">R$ 297</span>
            <span className="text-base font-medium text-slate-500">/mês</span>
          </div>
          <ul className="mb-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Eleitores Ilimitados</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Lideranças Ilimitadas</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Suporte prioritário</li>
          </ul>
          <button 
            onClick={() => assinar('pro')}
            disabled={loading}
            className="w-full rounded-lg border border-brand-200 bg-brand-50 text-brand-700 py-2.5 text-sm font-semibold hover:bg-brand-100 disabled:opacity-50 dark:border-brand-900/50 dark:bg-brand-500/10 dark:hover:bg-brand-500/20"
          >
            Assinar Pro
          </button>
        </div>

      </div>

      <div className="mt-12 text-center">
        <button 
          onClick={gerenciarAssinatura}
          disabled={loading}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
        >
          Já é assinante? Gerencie seu cartão de crédito e faturas no Portal do Cliente &rarr;
        </button>
      </div>

    </div>
  )
}
