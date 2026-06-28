import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

// O evento beforeinstallprompt é disparado pelos navegadores suportados
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Escuta o evento que permite instalar o PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault() // Impede o banner padrão do Chrome
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Só mostramos depois de alguns segundos para não ser muito intrusivo no primeiro load
      setTimeout(() => setIsVisible(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Se o usuário instalou, podemos esconder (opcional, o evento appinstalled também pode ser usado)
    const handleAppInstalled = () => {
      setIsVisible(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (!isVisible || !deferredPrompt) return null

  async function handleInstallClick() {
    if (!deferredPrompt) return
    // Esconde a nossa UI
    setIsVisible(false)
    // Mostra o prompt nativo do navegador
    deferredPrompt.prompt()
    // Espera o usuário responder
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    } else {
      // Se ele recusou, não vamos incomodar novamente nessa sessão
      setDeferredPrompt(null)
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] animate-slide-up rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 lg:bottom-6">
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Instalar Aplicativo</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Adicione o Gestor de Votos à sua tela inicial para acesso rápido e modo offline.
          </p>
          <button
            onClick={handleInstallClick}
            className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
          >
            Adicionar à Tela Inicial
          </button>
        </div>
      </div>
    </div>
  )
}
