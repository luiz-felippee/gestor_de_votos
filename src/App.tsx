import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import { CadastroPage } from './pages/CadastroPage'
import { PlanilhaPage } from './pages/PlanilhaPage'
import { DashboardPage } from './pages/DashboardPage'
import { CabosPage } from './pages/CabosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { LoginPage } from './pages/LoginPage'
import { PrivacidadePage } from './pages/PrivacidadePage'
import { MapaCalorPage } from './pages/MapaCalorPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-full flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<CadastroPage />} />
              <Route path="/privacidade" element={<PrivacidadePage />} />

              {/* Protegidas */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planilha"
                element={
                  <ProtectedRoute>
                    <PlanilhaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mapa"
                element={
                  <ProtectedRoute>
                    <MapaCalorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cabos"
                element={
                  <ProtectedRoute roles={['admin', 'coordenador']}>
                    <CabosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <UsuariosPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}

function Header() {
  const { usuario, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Gestor de Votos
        </span>

        {usuario ? (
          <div className="flex items-center gap-5">
            <nav className="hidden gap-1.5 md:flex">
              <Item to="/">Painel Geral</Item>
              <Item to="/planilha">Eleitores</Item>
              <Item to="/mapa">Mapa de Força</Item>
              {(role === 'admin' || role === 'coordenador') && (
                <Item to="/cabos">Gestão de Cabos</Item>
              )}
              {role === 'admin' && <Item to="/usuarios">Usuários</Item>}
              <Item to="/cadastro">Novo Cadastro</Item>
            </nav>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-5 dark:border-slate-700">
              <span className="hidden flex-col text-right sm:flex">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {usuario?.nome ?? 'Usuário'}
                </span>
                {role && (
                  <span className="text-[10px] font-medium tracking-widest text-brand-500 uppercase dark:text-brand-400">
                    {role}
                  </span>
                )}
              </span>
              <button
                onClick={toggleTheme}
                title="Alternar tema"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                {theme === 'dark' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => signOut()}
                className="flex h-9 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                Sair
              </button>
            </div>
          </div>
        ) : (
          <Item to="/login">Entrar</Item>
        )}
      </div>
    </header>
  )
}

function Item({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-slate-100 text-brand-700 dark:bg-slate-800 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
