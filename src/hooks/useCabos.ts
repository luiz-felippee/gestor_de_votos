import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { CaboEleitoral } from '../lib/types'

export function useCabos() {
  const [cabos, setCabos] = useState<CaboEleitoral[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const data = await api.getCabos()
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
    recarregar()
    // Como tiramos os websockets do supabase,
    // podemos usar polling se for necessário tempo real,
    // ou apenas recarregar quando voltar à janela
    const interval = setInterval(recarregar, 10000)
    return () => clearInterval(interval)
  }, [recarregar])

  return { cabos, loading, erro, recarregar }
}
