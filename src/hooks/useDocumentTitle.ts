import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TITLES: Record<string, string> = {
  '/': 'Painel Geral | Gestor de Votos',
  '/planilha': 'Eleitores | Gestor de Votos',
  '/mapa': 'Mapa de Força | Gestor de Votos',
  '/eventos': 'Agenda | Gestor de Votos',
  '/cabos': 'Lideranças | Gestor de Votos',
  '/usuarios': 'Usuários | Gestor de Votos',
  '/auditoria': 'Auditoria | Gestor de Votos',
  '/campanhas': 'Campanhas | Gestor de Votos',
  '/assinatura': 'Assinatura | Gestor de Votos',
  '/login': 'Entrar | Gestor de Votos',
  '/esqueci-senha': 'Recuperar Senha | Gestor de Votos',
  '/resetar-senha': 'Redefinir Senha | Gestor de Votos',
  '/privacidade': 'Política de Privacidade | Gestor de Votos',
}

export function useDocumentTitle() {
  const location = useLocation()

  useEffect(() => {
    // Tenta rotas fixas
    let title = TITLES[location.pathname]

    // Trata rotas dinâmicas
    if (!title) {
      if (location.pathname.startsWith('/c/')) {
        title = 'Cadastro | Gestor de Votos'
      } else {
        title = 'Gestor de Votos'
      }
    }

    document.title = title
  }, [location])
}
