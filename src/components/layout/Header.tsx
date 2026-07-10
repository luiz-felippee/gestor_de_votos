import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTheme } from '../ThemeProvider'
import { Logo } from '../Logo'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import {
  WifiOff, Loader2, Home, Users, CalendarDays,
  Network, FileText, Building2, User,
  LogOut, Sun, Moon, Menu, X, ChevronRight, MessageCircle, Settings as SettingsIcon
} from 'lucide-react'

export function Header() {
  const { usuario, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const { online, pendentes } = useOfflineSync()
  const location = useLocation()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Fecha o menu quando a rota muda
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Esconde a barra global no login — a tela de login tem sua própria marca
  const ocultarHeader = location.pathname === '/login'

  // Trava o scroll do body quando o menu está aberto
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  if (ocultarHeader) return null

  return (
    <>
      <header className="shrink-0 sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 pt-safe">
        {/* Banner Offline */}
        {(!online || pendentes > 0) && (
          <div className={`px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${!online ? 'bg-amber-500 text-white' : 'bg-brand-500 text-white'}`}>
            {!online ? (
              <>
                <WifiOff className="h-4 w-4" />
                Você está offline. Trabalhando localmente ({pendentes} na fila).
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando {pendentes} cadastros pendentes...
              </>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 hover:opacity-90 transition-opacity">
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
          </NavLink>

          {usuario ? (
            <div className="flex items-center gap-5">
              {/* Desktop Nav */}
              <nav className="hidden gap-0.5 lg:flex">
                <Item to="/">Painel</Item>
                <Item to="/planilha">Eleitores</Item>
                {(role === 'admin' || role === 'coordenador') && (
                  <Item to="/cabos">Lideranças</Item>
                )}
                <Item to="/whatsapp">WhatsApp & CRM</Item>
                {(role === 'admin' || role === 'coordenador' || usuario?.super_admin) && (
                  <Dropdown title="Administração">
                    <DropdownItem to="/eventos">Agenda</DropdownItem>
                    {usuario?.super_admin && <DropdownItem to="/campanhas">Campanhas</DropdownItem>}
                    {role === 'admin' && <DropdownItem to="/usuarios">Usuários</DropdownItem>}
                    {role === 'admin' && <DropdownItem to="/auditoria">Auditoria</DropdownItem>}
                    {role === 'admin' && <DropdownItem to="/configuracoes">Configurações</DropdownItem>}

                  </Dropdown>
                )}
              </nav>
              <div className="flex items-center gap-3 border-l border-slate-200 pl-5 dark:border-slate-700">
                <NavLink to="/perfil" className="hidden flex-col text-right sm:flex hover:opacity-80 transition-opacity">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {usuario?.nome ?? 'Usuário'}
                  </span>
                  {role && (
                    <span className="text-[10px] font-medium tracking-widest text-brand-500 uppercase dark:text-brand-400">
                      {role}
                    </span>
                  )}
                </NavLink>
                <button
                  onClick={toggleTheme}
                  title="Alternar tema"
                  className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => signOut()}
                  className="hidden lg:flex h-9 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  Sair
                </button>
                {/* Hamburger - Mobile Only */}
                <button
                  onClick={() => setMenuOpen(true)}
                  className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-400"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : location.pathname !== '/login' && !location.pathname.startsWith('/c/') ? (
            <Item to="/login">Entrar</Item>
          ) : null}
        </div>
      </header>

      {/* ========== MOBILE DRAWER ========== */}
      {usuario && (
        <>
          {/* Overlay escuro */}
          <div
            className={`fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
              menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer lateral */}
          <div
            ref={drawerRef}
            className={`fixed top-0 right-0 z-[999] h-full w-[85vw] max-w-[320px] bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-out lg:hidden flex flex-col ${
              menuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Header do Drawer */}
            <div className="flex items-center justify-between px-5 pt-safe pb-2 pt-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-lg font-bold text-slate-800 dark:text-white">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-400"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Perfil do Usuário */}
            <NavLink
              to="/perfil"
              onClick={() => setMenuOpen(false)}
              className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 p-4 transition hover:from-brand-100 dark:from-brand-950/50 dark:to-indigo-950/50 dark:hover:from-brand-900/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-lg font-bold shadow-md">
                {(usuario?.nome ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{usuario?.nome ?? 'Usuário'}</p>
                {role && (
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider">{role}</p>
                )}
                {usuario?.campanha_nome && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{usuario.campanha_nome}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </NavLink>

            {/* Links de Navegação */}
            <nav className="flex-1 overflow-y-auto px-4 mt-4 space-y-1">
              {/* Seção Principal */}
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Navegação</p>
              <MobileDrawerItem to="/" icon={<Home className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Painel Geral</MobileDrawerItem>
              <MobileDrawerItem to="/planilha" icon={<Users className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Eleitores</MobileDrawerItem>
              {(role === 'admin' || role === 'coordenador') && (
                <MobileDrawerItem to="/cabos" icon={<Network className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Lideranças</MobileDrawerItem>
              )}
              <MobileDrawerItem to="/whatsapp" icon={<MessageCircle className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>WhatsApp & CRM</MobileDrawerItem>

              {/* Seção Admin */}
              {(role === 'admin' || role === 'coordenador' || usuario?.super_admin) && (
                <>
                  <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Administração</p>

                  <MobileDrawerItem to="/eventos" icon={<CalendarDays className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Agenda & Eventos</MobileDrawerItem>
                  {usuario?.super_admin && (
                    <MobileDrawerItem to="/campanhas" icon={<Building2 className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Campanhas</MobileDrawerItem>
                  )}
                  {role === 'admin' && (
                    <MobileDrawerItem to="/usuarios" icon={<User className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Usuários</MobileDrawerItem>
                  )}
                  {role === 'admin' && (
                    <MobileDrawerItem to="/auditoria" icon={<FileText className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Auditoria</MobileDrawerItem>
                  )}
                  {role === 'admin' && (
                    <MobileDrawerItem to="/configuracoes" icon={<SettingsIcon className="h-5 w-5" />} onClick={() => setMenuOpen(false)}>Configurações</MobileDrawerItem>
                  )}

                </>
              )}
            </nav>

            {/* Footer do Drawer */}
            <div className="border-t border-slate-100 dark:border-slate-800 p-4 pb-safe space-y-2">
              <button
                onClick={() => { toggleTheme(); setMenuOpen(false) }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              <button
                onClick={() => { signOut(); setMenuOpen(false) }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-5 w-5" />
                Sair da Conta
              </button>
            </div>
          </div>
        </>
      )}
    </>
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

function MobileDrawerItem({ to, icon, onClick, children }: { to: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
          isActive
            ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-500/10 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/70'
        }`
      }
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
    </NavLink>
  )
}

