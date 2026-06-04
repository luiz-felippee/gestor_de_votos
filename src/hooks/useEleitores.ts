import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { EleitorComCabo } from '../lib/types'

export function useEleitores() {
  const [eleitores, setEleitores] = useState<EleitorComCabo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'eleitores'), orderBy('nome', 'asc'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: EleitorComCabo[] = []
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as EleitorComCabo)
      })
      setEleitores(lista)
      setLoading(false)
      setErro(null)
    }, (error) => {
      console.error(error)
      setErro("Erro ao carregar eleitores.")
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Dummy recarregar function to keep compatibility with existing components
  const recarregar = async () => {}

  return { eleitores, loading, erro, recarregar }
}
