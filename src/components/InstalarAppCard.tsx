import { useState } from 'react'
import { Smartphone, Share, Download, ChevronDown } from 'lucide-react'
import { useInstallPWA } from '../hooks/useInstallPWA'

/**
 * Card de instalação do PWA para quem fechou o banner ou quer instalar depois.
 * Só aparece quando é possível instalar (não some no desktop sem suporte nem
 * quando o app já está instalado).
 */
export function InstalarAppCard() {
  const { iOS, podeInstalar, instalar } = useInstallPWA()
  const [mostrarPassos, setMostrarPassos] = useState(false)

  if (!podeInstalar) return null

  return (
    <div className="overflow-hidden rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-sm dark:border-brand-800/50 dark:bg-brand-900/20">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Instalar aplicativo</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Tenha o Gestor de Votos na tela inicial, em tela cheia e com uso offline.
          </p>

          {iOS ? (
            <>
              <button
                onClick={() => setMostrarPassos((v) => !v)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
              >
                Como instalar no iPhone
                <ChevronDown className={`h-4 w-4 transition-transform ${mostrarPassos ? 'rotate-180' : ''}`} />
              </button>
              {mostrarPassos && (
                <ol className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <li>1. Abra este site no <strong>Safari</strong>.</li>
                  <li>
                    2. Toque no botão <Share className="inline-block h-4 w-4 mb-0.5" /> <strong>Compartilhar</strong>.
                  </li>
                  <li>3. Escolha <strong>"Adicionar à Tela de Início"</strong> → <strong>Adicionar</strong>.</li>
                </ol>
              )}
            </>
          ) : (
            <button
              onClick={() => instalar()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
            >
              <Download className="h-4 w-4" /> Instalar agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
