import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ThemeProvider } from './components/ThemeProvider'
import { Toaster, toast } from 'sonner'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
// Layout Elements carregados de forma lazy abaixo
import { InstallPrompt } from './components/layout/InstallPrompt'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useKeepAlive } from './hooks/useKeepAlive'
import { NaoEncontradoPage } from './pages/NaoEncontradoPage'

// Crítica: carrega de imediato (entrada principal)
import { LoginPage } from './pages/LoginPage'

// Pesadas / menos frequentes: carregam sob demanda
const lazyPage = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  nome: keyof T,
) => lazy(() => loader().then((m) => ({ default: m[nome] })))

// Públicas: sob demanda (não pesam no bundle inicial de quem já está logado)
const CadastroPage = lazyPage(() => import('./pages/CadastroPage'), 'CadastroPage')
const EsqueciSenhaPage = lazyPage(() => import('./pages/EsqueciSenhaPage'), 'EsqueciSenhaPage')
const ResetarSenhaPage = lazyPage(() => import('./pages/ResetarSenhaPage'), 'ResetarSenhaPage')
const PrivacidadePage = lazyPage(() => import('./pages/PrivacidadePage'), 'PrivacidadePage')

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage')
const PlanilhaPage = lazyPage(() => import('./pages/PlanilhaPage'), 'PlanilhaPage')
const CabosPage = lazyPage(() => import('./pages/CabosPage'), 'CabosPage')
const UsuariosPage = lazyPage(() => import('./pages/UsuariosPage'), 'UsuariosPage')

const CadastroLiderancaPage = lazyPage(
  () => import('./pages/CadastroLiderancaPage'),
  'CadastroLiderancaPage',
)
const EventosPage = lazyPage(() => import('./pages/EventosPage'), 'EventosPage')
const AuditoriaPage = lazyPage(() => import('./pages/AuditoriaPage'), 'AuditoriaPage')
const CampanhasPage = lazyPage(() => import('./pages/CampanhasPage'), 'CampanhasPage')
const WhatsAppPage = lazyPage(() => import('./pages/WhatsAppPage'), 'WhatsAppPage')

const PerfilPage = lazyPage(() => import('./pages/PerfilPage').then(m => ({ PerfilPage: m.PerfilPage })), 'PerfilPage')


const ConfiguracoesPage = lazyPage(() => import('./pages/ConfiguracoesPage').then(m => ({ ConfiguracoesPage: m.ConfiguracoesPage })), 'ConfiguracoesPage')

// Layout Elements (Pesados, carregados sob demanda)
const Header = lazy(() => import('./components/layout/Header').then(m => ({ default: m.Header })))
const Breadcrumbs = lazy(() => import('./components/Breadcrumbs').then(m => ({ default: m.Breadcrumbs })))

function CarregandoPagina() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute h-full w-full animate-ping rounded-full bg-brand-500/20 opacity-75" />
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent shadow-md" />
      </div>
      <p className="animate-pulse text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Carregando painel...
      </p>
    </div>
  )
}

import { useOfflineSync } from './hooks/useOfflineSync'
import { getSocket } from './lib/socket'
import { useAuth } from './auth/AuthContext'
import { useQueryClient } from '@tanstack/react-query'

function AppContent() {
  useOfflineSync()
  useDocumentTitle()
  const { usuario } = useAuth()
  const queryClient = useQueryClient()

  // Mantém o backend acordado enquanto o usuário logado está com o app aberto.
  useKeepAlive(!!usuario)

  useEffect(() => {
    if (!usuario) return
    const socket = getSocket()
    const handleChanged = () => {
      toast.info('A base de eleitores foi atualizada em tempo real.')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['eleitores'] })
    }
    socket.on('eleitores:changed', handleChanged)
    return () => {
      socket.off('eleitores:changed', handleChanged)
    }
  }, [usuario])

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {usuario && (
        <Suspense fallback={null}>
          <Header />
          <Breadcrumbs />
        </Suspense>
      )}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <ErrorBoundary>
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
                path="/whatsapp"
                element={
                  <ProtectedRoute>
                    <WhatsAppPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <PerfilPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/mapa" element={<Navigate to="/" replace />} />
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
                path="/configuracoes"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <ConfiguracoesPage />
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


              {/* Custom 404 Route */}
              <Route path="/404" element={<NaoEncontradoPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <InstallPrompt />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (invalidates automatically via websocket if data changes)
      refetchOnWindowFocus: false, // Prevents aggressive refetching when switching tabs
    },
  },
})

function NetworkOptimizer() {
  const { isSlow } = useNetworkStatus()
  
  useEffect(() => {
    // Ajusta o staleTime global de acordo com a rede
    queryClient.setDefaultOptions({
      queries: {
        staleTime: isSlow ? 1000 * 60 * 60 : 1000 * 60 * 5, // 1 hr se estiver lento, 5 min normal
        refetchOnWindowFocus: false,
        retry: isSlow ? 1 : 3, // tenta menos vezes se a rede estiver caindo
      },
    })
  }, [isSlow])
  
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkOptimizer />
      <ThemeProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
        <Toaster position="bottom-right" richColors mobileOffset={{ bottom: '84px' }} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
