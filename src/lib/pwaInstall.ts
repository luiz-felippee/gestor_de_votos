// Captura global do evento de instalação do PWA. O `beforeinstallprompt` só é
// disparado uma vez e cedo; por isso guardamos o evento num singleton (registrado
// assim que este módulo carrega) para que qualquer parte do app — o banner e o
// botão "Instalar" no Perfil — compartilhe a mesma fonte da verdade.

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // impede o mini-banner padrão do Chrome
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred
}

export function subscribePWA(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Aciona o diálogo nativo de instalação (Android/Desktop). */
export async function acionarInstalacao(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  notify()
  return outcome
}

export function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}

export function ehIos(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
}
