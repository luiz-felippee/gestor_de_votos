import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Registra o Service Worker (offline + cache dos recursos).
// registerType 'autoUpdate' (ver vite.config.ts): a versão nova assume sozinha,
// sem depender de o usuário aceitar um aviso — antes ficava "presa" a versão antiga
// (mapa/tela travados) porque quase ninguém clicava no toast "Atualizar". O plugin
// recarrega a página quando o novo SW assume; isso é raro (só logo após um deploy).
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
