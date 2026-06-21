import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { CaboEleitoral } from '../lib/types'

let CACHE_CABOS: CaboEleitoral[] = []
let CACHE_TIMESTAMP = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutos

export function useCabos() {
  const [cabos, setCabos] = useState<CaboEleitoral[]>(CACHE_CABOS)
  const [loading, setLoading] = useState(CACHE_CABOS.length === 0)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const data = await api.getCabos()
      CACHE_CABOS = data
      CACHE_TIMESTAMP = Date.now()
      setCabos(data)
      setErro(null)
    } catch (err: any) {
      setErro(err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    
    if (CACHE_CABOS.length === 0 || Date.now() - CACHE_TIMESTAMP > CACHE_TTL) {
      if (CACHE_CABOS.length === 0) setLoading(true)
      recarregar().finally(() => ativo && setLoading(false))
    } else {
      setLoading(false)
      recarregar() // Stale-while-revalidate
    }

    // Recarrega via Socket.io apenas quando o backend notifica mudanças
    const socket = getSocket()
    const handler = () => recarregar()
    socket.on('eleitores:changed', handler)

    return () => {
      ativo = false
      socket.off('eleitores:changed', handler)
    }
  }, [recarregar])

  return { cabos, loading, erro, recarregar }
}

