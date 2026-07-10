import { useState, useEffect } from 'react'
import { X, Download, Share } from 'lucide-react'
import { useInstallPWA } from '../../hooks/useInstallPWA'

export function InstallPrompt() {
  const { iOS: isIos, instalado, temPrompt, instalar } = useInstallPWA()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (instalado) return

    // iOS: instrução manual (só se ainda não foi dispensado).
    if (isIos) {
      if (localStorage.getItem('pwa_ios_dismissed')) return
      const t = setTimeout(() => setIsVisible(true), 3000)
      return () => clearTimeout(t)
    }

    // Android/Desktop: quando o navegador oferecer o diálogo nativo.
    if (temPrompt) {
      const t = setTimeout(() => setIsVisible(true), 3000)
      return () => clearTimeout(t)
    }
  }, [isIos, instalado, temPrompt])

  if (!isVisible || instalado) return null
  // Se não for iOS e não tiver o evento de prompt pronto, não mostra nada
  if (!isIos && !temPrompt) return null

  async function handleInstallClick() {
    if (isIos) {
      // No iOS, a instalação é manual: só fechamos o banner e marcamos como visto.
      dismissPrompt()
      return
    }
    setIsVisible(false)
    await instalar()
  }

  function dismissPrompt() {
    setIsVisible(false)
    if (isIos) {
      localStorage.setItem('pwa_ios_dismissed', 'true')
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] animate-slide-up rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[350px] lg:bottom-6">
      <button 
        onClick={dismissPrompt}
        className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4 shrink-0" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
          <Download className="h-6 w-6 shrink-0" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Instalar Aplicativo</h3>
          
          {isIos ? (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Para instalar no seu iPhone, toque no botão <Share className="inline-block h-3.5 w-3.5 shrink-0 mb-0.5 mx-0.5" /> <strong>Compartilhar</strong> do Safari e depois em <strong>"Adicionar à Tela de Início"</strong>.
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adicione o Gestor de Votos à sua tela inicial para acesso super rápido e uso offline.
            </p>
          )}

          {!isIos && (
            <button
              onClick={handleInstallClick}
              className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
            >
              Adicionar à Tela Inicial
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
