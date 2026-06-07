import { useState, useEffect, useCallback } from "react"
import { api } from "../lib/api"
import type { Evento } from "../lib/types"

export function useEventos() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getEventos()
      setEventos(data)
      setErro(null)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { eventos, loading, erro, recarregar: carregar }
}
