import { useSyncExternalStore } from 'react'
import { getDeferredPrompt, subscribePWA, acionarInstalacao, ehIos, estaInstalado } from '../lib/pwaInstall'

/**
 * Estado de instalação do PWA, compartilhado entre o banner e o botão do Perfil.
 * - `iOS`: no iPhone/iPad a instalação é sempre manual (Safari → Compartilhar).
 * - `temPrompt`: o navegador (Android/Desktop) já ofereceu o diálogo nativo.
 * - `podeInstalar`: deve mostrar alguma opção de instalar.
 * - `instalar()`: dispara o diálogo nativo (quando disponível).
 */
export function useInstallPWA() {
  const temPrompt = useSyncExternalStore(
    subscribePWA,
    () => getDeferredPrompt() != null,
    () => false
  )
  const iOS = ehIos()
  const instalado = estaInstalado()
  const podeInstalar = !instalado && (temPrompt || iOS)
  return { iOS, instalado, temPrompt, podeInstalar, instalar: acionarInstalacao }
}
