import { api } from "../lib/api"
import { useState, useEffect, useCallback } from "react"
import { getSocket } from "../lib/socket"

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

export function useDashboardStats(cidade?: string, dias?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (cidade) params.set('cidade', cidade)
      if (dias) params.set('dias', dias)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await api.getDashboardStats(query)
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [cidade, dias])

  useEffect(() => {
    load()
    const socket = getSocket()
    socket.on("eleitores:changed", load)
    return () => {
      socket.off("eleitores:changed", load)
    }
  }, [load])

  return { stats, loading }
}
