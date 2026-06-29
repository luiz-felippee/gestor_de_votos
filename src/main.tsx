import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Registra o Service Worker para funcionar offline e cachear recursos.
// autoUpdate: atualiza silenciosamente quando há nova versão.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Verifica atualizações a cada 60 minutos
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onOfflineReady() {
    console.log('[PWA] App pronto para uso offline.')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
