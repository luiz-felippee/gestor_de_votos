import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from 'sonner'
import { getOfflineQueue, removeFromOfflineQueue } from '../lib/offline'

// Trava de módulo: o sync pode ser disparado pelo evento 'online' E pela checagem
// do mount quase ao mesmo tempo. Sem a trava, os dois leem a mesma fila e enviam
// os mesmos eleitores duas vezes — cadastro duplicado na base.
let sincronizando = false

async function sincronizarFila(aoTerminar: (pendentes: number) => void) {
  if (sincronizando) return
  sincronizando = true
  try {
    const q = await getOfflineQueue()
    if (q.length === 0) return

    console.log(`[PWA] Conectado! Sincronizando ${q.length} registros usando Batch Import...`)
    const payloads = q.map((item) => item.data)
    const res = await api.importarEleitores(payloads)

    // Remove SÓ o que foi enviado nesta leva. Cadastros que entraram na fila
    // durante o envio continuam pendentes para a próxima rodada.
    const restantes = await removeFromOfflineQueue(q.map((item) => item.tempId))
    aoTerminar(restantes)
    toast.success(`Sincronização offline concluída! ${res.inserted} cadastros enviados.`)
    window.dispatchEvent(new Event('gv_eleitores_updated')) // força recarregar
  } catch (err) {
    console.error('Falha na sincronização offline:', err)
    // Se falhar o envio (ex: servidor fora do ar), não mexe na fila.
  } finally {
    sincronizando = false
  }
}

export function useOfflineSync() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState<number>(0)

  useEffect(() => {
    const checkQueue = async () => {
      const q = await getOfflineQueue()
      setPendentes(q.length)
    }

    checkQueue()

    const handleOnline = () => {
      setOnline(true)
      sincronizarFila(setPendentes)
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('gv_queue_updated', checkQueue)

    // Tenta sincronizar se abriu online e tinha fila
    if (navigator.onLine) {
      sincronizarFila(setPendentes)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('gv_queue_updated', checkQueue)
    }
  }, [])

  return { online, pendentes }
}
