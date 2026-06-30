import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from 'sonner'
import { getOfflineQueue, clearOfflineQueue } from '../lib/offline'

export function useOfflineSync() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState<number>(0)

  useEffect(() => {
    const checkQueue = async () => {
      const q = await getOfflineQueue()
      setPendentes(q.length)
    }
    
    checkQueue()
    
    const handleOnline = async () => {
      setOnline(true)
      const q = await getOfflineQueue()
      
      if (q.length > 0) {
        console.log(`[PWA] Conectado! Sincronizando ${q.length} registros usando Batch Import...`)
        
        try {
          // Usa a rota rápida de importação
          const payloads = q.map(item => item.data)
          const res = await api.importarEleitores(payloads)
          
          await clearOfflineQueue()
          setPendentes(0)
          toast.success(`Sincronização offline concluída! ${res.inserted} cadastros enviados.`)
          window.dispatchEvent(new Event('gv_eleitores_updated')) // força recarregar
        } catch (err) {
          console.error('Falha na sincronização offline:', err)
          // Se falhar o envio (ex: servidor fora do ar), não limpa a fila.
        }
      }
    }
    
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Tenta sincronizar se abriu online e tinha fila
    if (navigator.onLine) {
      handleOnline()
    }

    // Exportar uma função pra poder avisar o hook que a fila cresceu
    window.addEventListener('gv_queue_updated', checkQueue)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('gv_queue_updated', checkQueue)
    }
  }, [])

  return { online, pendentes }
}


