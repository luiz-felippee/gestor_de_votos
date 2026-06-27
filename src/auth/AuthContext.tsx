import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken, clearToken, ApiError } from '../lib/api'
import type { PerfilAcesso, Usuario } from '../lib/types'

const USER_KEY = 'gv_user'
function lerUsuarioCache(): Usuario | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

interface AuthState {
  usuario: Usuario | null
  loading: boolean
  role: PerfilAcesso | null
  signIn: (email: string, senha: string) => Promise<{ error: string | null; require2FA?: boolean; userId?: string }>
  signInWithGoogle: (credential: string) => Promise<{ error: string | null; require2FA?: boolean; userId?: string }>
  signIn2FA: (userId: string, token: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    senha: string,
  ) => Promise<{ error: string | null; message?: string }>
  signOut: () => void
}

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restaura a sessão do cache na hora (evita "piscar" o login a cada refresh).
  const cacheInicial = getToken() ? lerUsuarioCache() : null
  const [usuario, setUsuarioState] = useState<Usuario | null>(cacheInicial)
  // Só bloqueia com spinner se há token mas ainda não temos o usuário em cache.
  const [loading, setLoading] = useState(!!getToken() && !cacheInicial)

  // setUsuario que também persiste o cache, mantendo a sessão após o refresh.
  function setUsuario(u: Usuario | null) {
    setUsuarioState(u)
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
  }

  // Ao abrir, revalida a sessão em segundo plano.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    let ativo = true
    api
      .me()
      .then(({ usuario }) => ativo && setUsuario(usuario))
      .catch((err) => {
        // Só desloga se o token for REALMENTE inválido/expirado (401).
        // Servidor dormindo / erro de rede NÃO desloga — mantém o que está no cache.
        if (ativo && err instanceof ApiError && err.status === 401) {
          clearToken()
          setUsuario(null)
        }
      })
      .finally(() => ativo && setLoading(false))
    return () => {
      ativo = false
    }
  }, [])

  async function signIn(email: string, senha: string) {
    try {
      const res = await api.login(email, senha)
      if ('require2FA' in res) {
        return { error: null, require2FA: true, userId: res.userId }
      }
      setToken(res.token)
      setUsuario(res.usuario)
      return { error: null }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }

  async function signInWithGoogle(credential: string) {
    try {
      const res = await api.googleLogin(credential)
      if ('require2FA' in res) {
        return { error: null, require2FA: true, userId: res.userId }
      }
      setToken(res.token)
      setUsuario(res.usuario)
      return { error: null }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }

  async function signIn2FA(userId: string, mfaToken: string) {
    try {
      const { token, usuario } = await api.login2FA(userId, mfaToken)
      setToken(token)
      setUsuario(usuario)
      return { error: null }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }

  // Cadastro público é desativado por segurança (base de eleitores / LGPD).
  // Novos usuários são criados por um administrador.
  async function signUp() {
    return {
      error:
        'O cadastro de novos acessos é feito pelo administrador da campanha.',
    }
  }

  function signOut() {
    clearToken()
    setUsuario(null)
  }

  return (
    <AuthCtx.Provider
      value={{
        usuario,
        loading,
        role: usuario?.role ?? null,
        signIn,
        signInWithGoogle,
        signIn2FA,
        signUp,
        signOut,
      }}
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
