import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { CaboEleitoral } from '../lib/types'

/** Carrega a lista de cabos eleitorais (endpoint público). */
export function useCabos() {
  const [cabos, setCabos] = useState<CaboEleitoral[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    try {
      const data = await api.get<CaboEleitoral[]>('/cabos')
      setCabos(data)
    } catch (e) {
      console.error('Erro ao carregar cabos:', (e as Error).message)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    recarregar().finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [recarregar])

  return { cabos, loading, recarregar }
}
