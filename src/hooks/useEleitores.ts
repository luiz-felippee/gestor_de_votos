import { api } from '../lib/api'
import { useQuery } from '@tanstack/react-query'
import type { EleitorComCabo } from '../lib/types'

/**
 * Carrega os eleitores (lista completa) para ser usado no Mapa e em exportações globais.
 * O React Query cuida do cache e do stale-while-revalidate automaticamente.
 * A invalidação ocorre via websocket no App.tsx.
 */
export function useEleitores() {
  const { data, isLoading, error, refetch } = useQuery<EleitorComCabo[]>({
    queryKey: ['eleitores'],
    queryFn: async () => {
      return api.getAllEleitores()
    },
  })

  return { 
    eleitores: data || [], 
    loading: isLoading, 
    erro: error ? (error as Error).message : null, 
    recarregar: refetch 
  }
}

