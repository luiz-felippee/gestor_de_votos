import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTheme } from '../ThemeProvider'
import { Logo } from '../Logo'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { WifiOff, Loader2 } from 'lucide-react'

export function Header() {
  const { usuario, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const { online, pendentes } = useOfflineSync()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
          <NavLink to="/perfil" onClick={() => setMenuOpen(false)} className="mb-4 flex flex-col border-b border-slate-200 pb-4 dark:border-slate-800 hover:opacity-80 transition-opacity">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {usuario?.nome ?? 'Usuário'}
            </span>
            {role && (
              <span className="text-[10px] font-bold tracking-widest text-brand-500 uppercase dark:text-brand-400 mt-0.5">
                {role}
              </span>
            )}
          </NavLink>
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
