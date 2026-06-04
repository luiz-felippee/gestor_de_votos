import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken, clearToken } from '../lib/api'
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

  // Ao abrir, valida o token salvo buscando o usuário atual.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    let ativo = true
    api
      .get<{ usuario: Usuario }>('/auth/me')
      .then(({ usuario }) => ativo && setUsuario(usuario))
      .catch(() => {
        clearToken()
        if (ativo) setUsuario(null)
      })
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  async function signIn(email: string, senha: string) {
    try {
      const { token, usuario } = await api.post<{
        token: string
        usuario: Usuario
      }>('/auth/login', { email, senha })
      setToken(token)
      setUsuario(usuario)
      return { error: null }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }

  function signOut() {
    clearToken()
    setUsuario(null)
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
