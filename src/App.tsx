import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import { Logo } from './components/Logo'
import { ToastProvider } from './components/Toast'
// Leves / críticas: carregam de imediato (formulário público e login)
import { CadastroPage } from './pages/CadastroPage'
import { LoginPage } from './pages/LoginPage'
import { EsqueciSenhaPage } from './pages/EsqueciSenhaPage'
import { ResetarSenhaPage } from './pages/ResetarSenhaPage'
import { PrivacidadePage } from './pages/PrivacidadePage'

// Pesadas: carregam sob demanda (mapa, gráficos, planilha, etc.)
const lazyPage = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  nome: keyof T,
) => lazy(() => loader().then((m) => ({ default: m[nome] })))

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage')
const PlanilhaPage = lazyPage(() => import('./pages/PlanilhaPage'), 'PlanilhaPage')
const CabosPage = lazyPage(() => import('./pages/CabosPage'), 'CabosPage')
const UsuariosPage = lazyPage(() => import('./pages/UsuariosPage'), 'UsuariosPage')
const MapaCalorPage = lazyPage(() => import('./pages/MapaCalorPage'), 'MapaCalorPage')
const CadastroLiderancaPage = lazyPage(
  () => import('./pages/CadastroLiderancaPage'),
  'CadastroLiderancaPage',
)
const EventosPage = lazyPage(() => import('./pages/EventosPage'), 'EventosPage')
const AuditoriaPage = lazyPage(() => import('./pages/AuditoriaPage'), 'AuditoriaPage')
const CampanhasPage = lazyPage(() => import('./pages/CampanhasPage'), 'CampanhasPage')
const BillingPage = lazyPage(() => import('./pages/BillingPage').then(m => ({ BillingPage: m.BillingPage })), 'BillingPage')

function CarregandoPagina() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  )
}

import { useOfflineSync } from './hooks/useOfflineSync'

export default function App() {
  useOfflineSync()
  return (
    <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-full flex-col">
          <Header />
          <main className="flex-1">
            <Suspense fallback={<CarregandoPagina />}>
            <Routes>
              {/* Públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
              <Route path="/resetar-senha" element={<ResetarSenhaPage />} />
              <Route path="/c/:campanhaSlug" element={<CadastroPage />} />
              <Route path="/c/:campanhaSlug/:nomeCabo" element={<CadastroPage />} />
              <Route path="/c/:campanhaSlug/cadastro-lideranca" element={<CadastroLiderancaPage />} />
              <Route path="/privacidade" element={<PrivacidadePage />} />

              {/* Protegidas */}
              <Route
                path="/"
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
                path="/eventos"
                element={
                  <ProtectedRoute>
                    <EventosPage />
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
              <Route
                path="/auditoria"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AuditoriaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campanhas"
                element={
                  <ProtectedRoute>
                    <CampanhasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assinatura"
                element={
                  <ProtectedRoute roles={['admin', 'coordenador']}>
                    <BillingPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </main>
          <BottomNavWrapper />
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}

function Header() {
  const { usuario, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="hidden sm:inline">Gestor de Votos</span>
            {usuario?.campanha_nome && (
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                {usuario.super_admin ? '★ ' : ''}
                {usuario.campanha_nome}
              </span>
            )}
          </span>
        </span>

        {usuario ? (
          <div className="flex items-center gap-5">
            <nav className="hidden gap-0.5 lg:flex">
              <Item to="/">Painel</Item>
              <Item to="/planilha">Eleitores</Item>
              <Item to="/mapa">Mapa</Item>
              <Item to="/eventos">Agenda</Item>
              <Item to="/cadastro">Cadastro</Item>

              {(role === 'admin' || role === 'coordenador' || usuario?.super_admin) && (
                <Dropdown title="Administração">
                  {(role === 'admin' || role === 'coordenador') && (
                    <DropdownItem to="/cabos">Lideranças</DropdownItem>
                  )}
                  {usuario?.super_admin && <DropdownItem to="/campanhas">Campanhas</DropdownItem>}
                  {role === 'admin' && <DropdownItem to="/usuarios">Usuários</DropdownItem>}
                  {role === 'admin' && <DropdownItem to="/auditoria">Auditoria</DropdownItem>}
                  {(role === 'admin' || role === 'coordenador') && <DropdownItem to="/assinatura">Assinatura</DropdownItem>}
                </Dropdown>
              )}
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
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-400"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <Item to="/login">Entrar</Item>
        )}
      </div>

      {/* Menu Mobile Dropdown */}
      {usuario && menuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 shadow-inner">
          <div className="mb-4 flex flex-col border-b border-slate-200 pb-4 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {usuario?.nome ?? 'Usuário'}
            </span>
            {role && (
              <span className="text-[10px] font-bold tracking-widest text-brand-500 uppercase dark:text-brand-400 mt-0.5">
                {role}
              </span>
            )}
          </div>
          <nav className="flex flex-col gap-2">
            <MobileItem to="/" onClick={() => setMenuOpen(false)}>Painel Geral</MobileItem>
            <MobileItem to="/planilha" onClick={() => setMenuOpen(false)}>Eleitores</MobileItem>
            <MobileItem to="/mapa" onClick={() => setMenuOpen(false)}>Mapa de Força</MobileItem>
            <MobileItem to="/eventos" onClick={() => setMenuOpen(false)}>Agenda & Eventos</MobileItem>
            {(role === 'admin' || role === 'coordenador') && (
              <MobileItem to="/cabos" onClick={() => setMenuOpen(false)}>Lideranças</MobileItem>
            )}
            {(role === 'admin' || role === 'coordenador') && (
              <MobileItem to="/assinatura" onClick={() => setMenuOpen(false)}>Assinatura</MobileItem>
            )}
            {usuario?.super_admin && <MobileItem to="/campanhas" onClick={() => setMenuOpen(false)}>Campanhas</MobileItem>}
            {role === 'admin' && <MobileItem to="/usuarios" onClick={() => setMenuOpen(false)}>Usuários</MobileItem>}
            {role === 'admin' && <MobileItem to="/auditoria" onClick={() => setMenuOpen(false)}>Auditoria</MobileItem>}
            <MobileItem to="/cadastro" onClick={() => setMenuOpen(false)}>Novo Cadastro</MobileItem>
          </nav>
        </div>
      )}
    </header>
  )
}

function Item({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
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

function Dropdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 transition-colors">
        {title}
        <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className="absolute left-0 top-full mt-1 hidden w-48 flex-col rounded-xl bg-white shadow-xl border border-slate-200 p-1.5 group-hover:flex dark:bg-slate-900 dark:border-slate-800 z-50">
        {children}
      </div>
    </div>
  )
}

function DropdownItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-slate-100 text-brand-700 dark:bg-slate-800 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function MobileItem({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-4 py-3 text-base font-semibold transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-2 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-900 lg:hidden">
      <BottomNavItem to="/" icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} label="Início" />
      <BottomNavItem to="/planilha" icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Eleitores" />
      
      {/* Central Floating Action Button Style for Add */}
      <NavLink
        to="/cadastro"
        className="group relative flex h-12 w-12 -translate-y-4 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform active:scale-95 dark:bg-brand-500"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
      </NavLink>
      
      <BottomNavItem to="/eventos" icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} label="Agenda" />
      <BottomNavItem to="/cabos" icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} label="Cabos" />
    </nav>
  )
}

function BottomNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center space-y-1 rounded-lg px-2 py-1 transition-colors ${
          isActive
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        }`
      }
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  )
}

function BottomNavWrapper() {
  const { usuario } = useAuth()
  if (!usuario) return null
  return <BottomNav />
}
