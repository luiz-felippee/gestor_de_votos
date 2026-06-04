import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import type { PerfilAcesso, Usuario } from '../lib/types'

interface AuthState {
  usuario: Usuario | null
  loading: boolean
  role: PerfilAcesso | null
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>
  signOut: () => void
}

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  // Firebase observer para manter a sessão
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Em um sistema real, buscaríamos o perfil real do Firestore.
        // Aqui assumimos admin para manter a simplicidade da migração.
        setUsuario({
          id: user.uid,
          nome: user.email || 'Usuário',
          role: 'admin',
          cabo_id: null
        })
      } else {
        setUsuario(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  async function signIn(email: string, senha: string) {
    try {
      await signInWithEmailAndPassword(auth, email, senha)
      return { error: null }
    } catch (err: any) {
      console.error("Erro completo do Firebase:", err)
      return { error: `Erro Firebase: ${err.message}` }
    }
  }

  function signOut() {
    firebaseSignOut(auth)
  }

  return (
    <AuthCtx.Provider
      value={{ usuario, loading, role: usuario?.role ?? null, signIn, signOut }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
