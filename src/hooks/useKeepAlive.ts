import { useEffect } from 'react'
import { prewarmBackend } from '../lib/api'

// Mantém o backend acordado enquanto o app está aberto e visível.
// O Render (free) dorme após ~15 min sem requisições; pingar a cada 10 min
// evita o cold start durante o uso. Só roda quando online e com a aba visível,
// para não gastar rede à toa em segundo plano.
const INTERVALO_MS = 10 * 60 * 1000 // 10 min (< 15 min do Render)

export function useKeepAlive(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return

    let timer: ReturnType<typeof setInterval> | null = null

    const ping = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        prewarmBackend()
      }
    }

    const start = () => {
      if (timer) return
      ping() // aquece já ao ganhar visibilidade
      timer = setInterval(ping, INTERVALO_MS)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ativo])
}
