import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CaboEleitoral } from '../lib/types'

export function useCabos() {
  const [cabos, setCabos] = useState<CaboEleitoral[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'cabos'), orderBy('nome', 'asc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: CaboEleitoral[] = []
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as CaboEleitoral)
      })
      setCabos(lista)
      setLoading(false)
      setErro(null)
    }, (error) => {
      console.error(error)
      setErro("Erro ao carregar cabos eleitorais.")
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Dummy recarregar function to keep compatibility
  const recarregar = async () => {}

  return { cabos, loading, erro, recarregar }
}
