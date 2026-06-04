import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { PerfilAcesso } from '../lib/types'

/**
 * Protege uma rota: exige sessão e, opcionalmente, um dos perfis em `roles`.
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: PerfilAcesso[]
}) {
  const { usuario, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        Carregando...
      </div>
    )
  }

  if (!usuario) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  if (roles && role && !roles.includes(role)) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <h2 className="mb-1 font-semibold">Acesso restrito</h2>
        <p className="text-sm">
          Seu perfil ({role}) não tem permissão para esta área.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
