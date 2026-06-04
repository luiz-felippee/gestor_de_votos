import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { EleitorComCabo } from '../lib/types'

/**
 * Carrega os eleitores e mantém a lista atualizada em tempo real:
 * o backend emite 'eleitores:changed' via Socket.io a cada mudança.
 */
export function useEleitores() {
  const [eleitores, setEleitores] = useState<EleitorComCabo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const data = await api.get<EleitorComCabo[]>('/eleitores')
      setEleitores(data)
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    recarregar().finally(() => ativo && setLoading(false))

    const socket = getSocket()
    const handler = () => recarregar()
    socket.on('eleitores:changed', handler)

    return () => {
      ativo = false
      socket.off('eleitores:changed', handler)
    }
  }, [recarregar])

  return { eleitores, loading, erro, recarregar }
}
