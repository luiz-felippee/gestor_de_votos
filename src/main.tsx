import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Registra o Service Worker para funcionar offline e cachear recursos.
// registerType 'prompt': quando sai versão nova, AVISAMOS em vez de recarregar
// sozinho — o autoUpdate recarregava a página no meio de um cadastro e a pessoa
// perdia tudo que estava digitando.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Verifica atualizações a cada 60 minutos
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onNeedRefresh() {
    toast('Nova versão disponível', {
      description: 'Atualize para receber as melhorias.',
      duration: Infinity,
      action: {
        label: 'Atualizar',
        onClick: () => updateSW(true),
      },
    })
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
