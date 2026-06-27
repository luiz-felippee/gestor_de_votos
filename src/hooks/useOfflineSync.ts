import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../components/Toast'

export interface PendenteOffline {
  id: string; // id temporário gerado no cliente
  url: string; // ex: '/api/eleitores-public'
  payload: any;
  timestamp: number;
}

export function useOfflineSync() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState<number>(0)
  const { toast } = useToast()

  useEffect(() => {
    const checkQueue = () => {
      const q = JSON.parse(localStorage.getItem('gv_offline_queue') || '[]')
      setPendentes(q.length)
    }
    
    checkQueue()
    
    const handleOnline = async () => {
      setOnline(true)
      const q: PendenteOffline[] = JSON.parse(localStorage.getItem('gv_offline_queue') || '[]')
      
      if (q.length > 0) {
        console.log(`[PWA] Conectado! Sincronizando ${q.length} registros...`)
        
        // Mantém apenas os que falharem na fila
        const novaFila: PendenteOffline[] = []
        let sucesso = 0
        
        for (const item of q) {
          try {
            // Emulação direta de fetch para a API
            const baseUrl = api.base;
            const res = await fetch(`${baseUrl}${item.url}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            })
            
            if (res.ok) {
              sucesso++
            } else {
              novaFila.push(item) // se falhou (ex: cpf duplicado, a gente perde ou guarda? Melhor guardar pra revisar, mas pra simplificar vamos guardar se der erro de rede, se for erro de validação (400), descarta pra não ficar travado.)
              if (res.status >= 400 && res.status < 500) {
                // Erro de cliente (ex: CPF já existe). Remove da fila para não travar infinitamente.
                novaFila.pop()
              }
            }
          } catch (err) {
            // Erro de rede (caiu a net no meio), volta pra fila
            novaFila.push(item)
          }
        }
        
        localStorage.setItem('gv_offline_queue', JSON.stringify(novaFila))
        setPendentes(novaFila.length)
        if (sucesso > 0) {
          toast(`Sincronização offline concluída! ${sucesso} cadastros enviados.`, 'success')
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

export function saveOffline(url: string, payload: any) {
  const item: PendenteOffline = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    url,
    payload,
    timestamp: Date.now()
  }
  const q = JSON.parse(localStorage.getItem('gv_offline_queue') || '[]')
  q.push(item)
  localStorage.setItem('gv_offline_queue', JSON.stringify(q))
  window.dispatchEvent(new Event('gv_queue_updated'))
}
