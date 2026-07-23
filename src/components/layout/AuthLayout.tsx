import { Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Logo } from '../Logo'

/**
 * Shell compartilhado das telas de ACESSO (login, esqueci/redefinir senha).
 * Antes cada tela tinha um layout próprio (o login era um split-screen premium; as
 * de senha, um cartãozinho cinza) — pareciam apps diferentes. Aqui todas usam o
 * mesmo split-screen: painel de marca (esquerda/topo no mobile) + área do formulário.
 * O conteúdo do formulário vem em `children`.
 */

const FEATURES: [string, string][] = [
  ['Gestão descentralizada', 'Distribua metas e acompanhe cada liderança.'],
  ['Mapas inteligentes', 'Visualize a distribuição dos votos no território.'],
  ['Dados em tempo real', 'Decisões rápidas com o painel sempre atualizado.'],
]

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Mobile: tela cheia (svh ignora a barra do navegador), conjunto centralizado.
    <main className="bg-white font-sans max-lg:min-h-[100svh] lg:min-h-[100dvh] dark:bg-slate-950 lg:bg-slate-950">
      <div className="relative flex flex-col max-lg:min-h-[100svh] max-lg:justify-center lg:grid lg:min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">

        {/* ===================== Painel da marca ===================== */}
        <div className="relative isolate flex shrink-0 flex-col overflow-hidden px-6 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-10 lg:px-14 lg:py-14 xl:px-20">
          {/* Fundo com gradiente + orbes — apenas desktop */}
          <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
            <div className="absolute -top-40 -left-24 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-[110px]" />
            <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-[110px]" />
            <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
          </div>

          {/* Logo — no mobile fica sobre o fundo claro; no desktop, sobre o painel escuro */}
          <div className="relative flex shrink-0 items-center justify-center gap-2.5 lg:justify-start">
            <Logo iconClassName="h-8 w-8 lg:h-10 lg:w-10" />
            <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white lg:text-lg lg:text-white">
              Gestor de Votos
            </span>
          </div>

          {/* Hero — só desktop */}
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
        <div className="relative z-20 flex flex-col px-6 pt-2 lg:flex-1 lg:justify-center lg:bg-white lg:px-12 lg:pt-0 dark:lg:bg-slate-900">
          <div className="mx-auto w-full max-w-[25rem] lg:p-0">
            {children}
          </div>

          {/* Rodapé de segurança (mobile) */}
          <p className="mt-5 flex items-center justify-center gap-1.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] text-xs font-medium text-slate-500 lg:hidden dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Conexão segura e dados criptografados
          </p>
        </div>
      </div>
    </main>
  )
}
