import { Link, useLocation } from 'react-router-dom'
import { Home, ChevronRight } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  planilha: 'Eleitores',
  mapa: 'Mapa de Força',
  eventos: 'Agenda',
  cabos: 'Lideranças',
  usuarios: 'Usuários',
  auditoria: 'Auditoria',
  campanhas: 'Campanhas',
  cadastro: 'Novo Cadastro',
}

export function Breadcrumbs() {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  // Não renderiza breadcrumbs nas páginas públicas ou no dashboard (Home)
  if (
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/c/') ||
    location.pathname === '/privacidade' ||
    location.pathname === '/esqueci-senha' ||
    location.pathname === '/resetar-senha'
  ) {
    return null
  }

  return (
    <nav className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        aria-label="Ir para Painel Geral"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Início</span>
      </Link>
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`
        const isLast = index === pathnames.length - 1
        const label = ROUTE_LABELS[value] || decodeURIComponent(value)

        return (
          <div key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            {isLast ? (
              <span className="text-slate-800 dark:text-slate-200 font-bold max-w-[180px] truncate">
                {label}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors max-w-[180px] truncate"
              >
                {label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
