import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { EleitorComCabo } from '../lib/types'

let CACHE_ELEITORES: EleitorComCabo[] = []
let CACHE_TIMESTAMP = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutos (mesmo com cache, Socket.io mantém atualizado)

/**
 * Carrega os eleitores e mantém a lista atualizada em tempo real.
 * O backend emite 'eleitores:changed' via Socket.io a cada mudança,
 * mas usamos debounce para não recarregar a cada micro-alteração.
 */
export function useEleitores() {
  const [eleitores, setEleitores] = useState<EleitorComCabo[]>(CACHE_ELEITORES)
  const [loading, setLoading] = useState(CACHE_ELEITORES.length === 0)
  const [erro, setErro] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const data = await api.getAllEleitores()
      CACHE_ELEITORES = data
      CACHE_TIMESTAMP = Date.now()
      setEleitores(data)
      setErro(null)
    } catch (err) {
      setErro((err as Error).message)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    if (CACHE_ELEITORES.length === 0 || Date.now() - CACHE_TIMESTAMP > CACHE_TTL) {
      if (CACHE_ELEITORES.length === 0) setLoading(true)
      recarregar().finally(() => ativo && setLoading(false))
    } else {
      setLoading(false)
      recarregar() // Stale-while-revalidate
    }

    const socket = getSocket()
    // Debounce: se muitos eventos chegam em sequência (ex: bulk import),
    // espera 2s de silêncio antes de recarregar.
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        recarregar()
      }, 2000)
    }
    socket.on('eleitores:changed', handler)

    return () => {
      ativo = false
      socket.off('eleitores:changed', handler)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [recarregar])

  return { eleitores, loading, erro, recarregar }
}

