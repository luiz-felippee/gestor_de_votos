import { api } from '../lib/api'
import { useQuery } from '@tanstack/react-query'

export interface PontoMapa {
  id?: string
  cidade: string | null
  local_votacao: string | null
  lat: number | null
  lng: number | null
  // Presente quando o backend já envia agregado por local de votação.
  count?: number
}

export function useMapaPontos(cidade?: string, dias?: string, cabo?: string) {
  const { data, isLoading, error } = useQuery<PontoMapa[]>({
    queryKey: ['mapa-pontos', cidade, dias, cabo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cidade) params.set('cidade', cidade)
      if (dias) params.set('dias', dias)
      if (cabo) params.set('cabo', cabo)
      const query = params.toString() ? `?${params.toString()}` : ''
      return api.getMapaPontos(query)
    },
    // The points don't need to be updated aggressively while looking at the map
    staleTime: 1000 * 60 * 15,
  })

  return { pontos: data || [], loading: isLoading, error }
}
