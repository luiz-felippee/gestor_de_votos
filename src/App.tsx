import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ThemeProvider } from './components/ThemeProvider'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Breadcrumbs } from './components/Breadcrumbs'
import { Header } from './components/layout/Header'
import { InstallPrompt } from './components/layout/InstallPrompt'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { NaoEncontradoPage } from './pages/NaoEncontradoPage'

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

const CadastroLiderancaPage = lazyPage(
  () => import('./pages/CadastroLiderancaPage'),
  'CadastroLiderancaPage',
)
const EventosPage = lazyPage(() => import('./pages/EventosPage'), 'EventosPage')
const AuditoriaPage = lazyPage(() => import('./pages/AuditoriaPage'), 'AuditoriaPage')
const CampanhasPage = lazyPage(() => import('./pages/CampanhasPage'), 'CampanhasPage')
const BillingPage = lazyPage(() => import('./pages/BillingPage').then(m => ({ BillingPage: m.BillingPage })), 'BillingPage')
const PerfilPage = lazyPage(() => import('./pages/PerfilPage').then(m => ({ PerfilPage: m.PerfilPage })), 'PerfilPage')

function CarregandoPagina() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
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
  const { toast } = useToast()
  const { usuario } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!usuario) return
    const socket = getSocket()
    const handleChanged = () => {
      toast('A base de eleitores foi atualizada em tempo real.', 'info')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['eleitores'] })
    }
    socket.on('eleitores:changed', handleChanged)
    return () => {
      socket.off('eleitores:changed', handleChanged)
    }
  }, [usuario, toast])

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <Breadcrumbs />
      <main className="flex-1">
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
