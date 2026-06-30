import { api } from "../lib/api"
import { useQuery } from "@tanstack/react-query"
import type { Campanha } from "../lib/types"

export interface DashboardStats {
  campanha?: Campanha | null
  kpis: {
    totalEleitores: number
    totalCidades: number
    totalBairros: number
    totalCabos: number
  }
  porCidade: { label: string; total: number }[]
  porBairro: { label: string; total: number }[]
  porLocalVotacao: { label: string; total: number }[]
  porDia: { label: string; total: number }[]
  ranking: { id: string; nome: string; meta: number; total: number; foto_url?: string | null }[]
  aniversariantes: { id: string; nome: string; telefone: string | null; data_nascimento: string; diffDias: number; bairro: string | null; cidade: string | null }[]
}

export function useDashboardStats(cidade?: string, dias?: string, cabo?: string) {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard', cidade, dias, cabo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cidade) params.set('cidade', cidade)
      if (dias) params.set('dias', dias)
      if (cabo) params.set('cabo', cabo)
      const query = params.toString() ? `?${params.toString()}` : ''
      return api.getDashboardStats(query)
    },
  })

  return { stats: data || null, loading: isLoading, error }
}
