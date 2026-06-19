// Cliente HTTP da API do Gestor de Votos (backend próprio em Node/Express).
// A URL base vem de VITE_API_URL (padrão: backend local na porta 3001).
import type {
  CaboEleitoral,
  EleitorComCabo,
  Usuario,
  UsuarioAdmin,
  ConfiguracaoWhatsApp,
  Evento,
  LogAuditoria,
  Campanha,
  MensagemWhatsApp,
} from './types'

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:3001'

const TOKEN_KEY = 'gv_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique se a API está rodando.',
      0,
    )
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? 'Erro na requisição.',
      res.status,
    )
  }
  return data as T
}

export const api = {
  base: API_BASE,

  // ---- Autenticação ----
  login: (email: string, senha: string) =>
    request<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: { email, senha },
    }),
  me: () => request<{ usuario: Usuario }>('/auth/me'),

  // ---- Cabos ----
  getCabos: () => request<CaboEleitoral[]>('/cabos'),
  createCabo: (data: unknown) =>
    request<CaboEleitoral>('/cabos', { method: 'POST', body: data }),
  updateCabo: (id: string, data: unknown) =>
    request<CaboEleitoral>(`/cabos/${id}`, { method: 'PUT', body: data }),
  deleteCabo: (id: string) =>
    request<void>(`/cabos/${id}`, { method: 'DELETE' }),
  createCaboPublic: async (dados: Partial<CaboEleitoral> & { website?: string; campanha_slug?: string }) => {
    const res = await fetch(`${API_BASE}/api/cabos-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao criar liderança')
    return data
  },
  uploadArquivo: async (file: File) => {
    const formData = new FormData()
    formData.append('foto', file)
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer upload da imagem.')
    return data as { url: string }
  },

  // ---- Auditoria (admin) ----
  getAuditoria: () => request<LogAuditoria[]>('/auditoria'),

  // ---- Campanhas (super-admin) ----
  getCampanhas: () => request<Campanha[]>('/campanhas'),
  getCampanhaPublic: async (slug: string) => {
    const res = await fetch(`${API_BASE}/api/campanhas-public/${slug}`)
    if (!res.ok) throw new Error('Campanha não encontrada')
    return res.json() as Promise<Partial<Campanha>>
  },
  createCampanha: (data: unknown) =>
    request<Campanha>('/campanhas', { method: 'POST', body: data }),
  updateCampanha: (id: string, data: Partial<Campanha>) =>
    request<Campanha>(`/campanhas/${id}`, { method: 'PUT', body: data }),
  deleteCampanha: (id: string) =>
    request<void>(`/campanhas/${id}`, { method: 'DELETE' }),

  // ---- Usuários (gestão de acessos — admin) ----
  getUsuarios: () => request<UsuarioAdmin[]>('/usuarios'),
  createUsuario: (data: unknown) =>
    request<UsuarioAdmin>('/usuarios', { method: 'POST', body: data }),
  updateUsuario: (id: string, data: unknown) =>
    request<UsuarioAdmin>(`/usuarios/${id}`, { method: 'PUT', body: data }),
  deleteUsuario: (id: string) =>
    request<void>(`/usuarios/${id}`, { method: 'DELETE' }),

  // ---- Eleitores ----
  getEleitores: async (params?: { page?: number; limit?: number; busca?: string; cidade?: string; bairro?: string; status?: string; cabo_id?: string; zona?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.busca) query.set('busca', params.busca)
    if (params?.cidade) query.set('cidade', params.cidade)
    if (params?.bairro) query.set('bairro', params.bairro)
    if (params?.status) query.set('status', params.status)
    if (params?.cabo_id) query.set('cabo_id', params.cabo_id)
    if (params?.zona) query.set('zona', String(params.zona))
    const qs = query.toString()
    const res = await request<{ data: EleitorComCabo[]; total: number; page: number; limit: number; totalPages: number }>(`/eleitores${qs ? `?${qs}` : ''}`)
    return res
  },
  /** Busca TODOS os eleitores (sem paginação), para páginas que precisam da lista completa (mapa, cabos, eventos). */
  getAllEleitores: async () => {
    const res = await request<any>('/eleitores?limit=200&page=1')
    // Compatibilidade: backend novo retorna { data, total }; backend antigo retorna um array.
    if (Array.isArray(res)) return res as EleitorComCabo[]
    const all: EleitorComCabo[] = [...(res?.data ?? [])]
    const total: number = res?.total ?? all.length
    // Se houver mais que 200, busca os demais lotes em paralelo
    if (total > 200) {
      const totalPages = Math.ceil(total / 200)
      const promises: Promise<any>[] = []
      for (let p = 2; p <= totalPages; p++) {
        promises.push(request<any>(`/eleitores?limit=200&page=${p}`))
      }
      const results = await Promise.all(promises)
      for (const r of results) all.push(...(Array.isArray(r) ? r : (r?.data ?? [])))
    }
    return all
  },
  getDashboardStats: (query: string = '') => request<any>(`/dashboard/stats${query}`),
  createEleitor: (data: unknown) =>
    request<EleitorComCabo>('/eleitores', { method: 'POST', body: data }),
  updateEleitor: (id: string, data: unknown) =>
    request<EleitorComCabo>(`/eleitores/${id}`, { method: 'PUT', body: data }),
  deleteEleitor: (id: string) =>
    request<void>(`/eleitores/${id}`, { method: 'DELETE' }),
  marcarWhatsAppEnviado: (id: string, enviado: boolean) =>
    request<EleitorComCabo>(`/eleitores/${id}/whatsapp`, { method: 'PATCH', body: { enviado } }),
  anonimizarEleitor: (id: string) =>
    request<EleitorComCabo>(`/eleitores/${id}/anonimizar`, { method: 'POST' }),

  // ---- Bairros (autocomplete do formulário) ----
  getBairros: () => request<string[]>('/bairros'),

  // ---- Configurações WhatsApp ----
  getConfigWhatsApp: () => request<ConfiguracaoWhatsApp>('/whatsapp/config'),
  updateConfigWhatsApp: (data: Partial<ConfiguracaoWhatsApp>) =>
    request<ConfiguracaoWhatsApp>('/whatsapp/config', { method: 'POST', body: data }),
  
  // ---- CRM Inbox WhatsApp ----
  fetchWhatsAppChats: () => request<any[]>('/whatsapp/chats'),
  fetchWhatsAppChatHistory: (numero: string) => request<MensagemWhatsApp[]>(`/whatsapp/chats/${numero}`),
  sendWhatsApp: (numero: string, texto: string) =>
    request<{ success: boolean }>('/whatsapp/send', { method: 'POST', body: { numero, texto, tipo: 'text' } }),

  // ---- Eventos ----
  getEventos: () => request<Evento[]>('/eventos'),
  createEvento: (data: unknown) =>
    request<Evento>('/eventos', { method: 'POST', body: data }),
  updateEvento: (id: string, data: unknown) =>
    request<Evento>(`/eventos/${id}`, { method: 'PUT', body: data }),
  deleteEvento: (id: string) =>
    request<void>(`/eventos/${id}`, { method: 'DELETE' }),

  // ---- Assinaturas (Billing) ----
  billingCheckout: (planoId: string) => request<{ url: string }>('/billing/checkout', { method: 'POST', body: { planoId } }),
  billingPortal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),

  // ---- Funis de Automação (WhatsApp Drip Campaigns) ----
  getFunis: () => request<any[]>('/funis'),
  getFunil: (id: string) => request<any>(`/funis/${id}`),
  createFunil: (data: unknown) => request<any>('/funis', { method: 'POST', body: data }),
  updateFunil: (id: string, data: unknown) => request<any>(`/funis/${id}`, { method: 'PUT', body: data }),
  deleteFunil: (id: string) => request<void>(`/funis/${id}`, { method: 'DELETE' }),
  createFunilEtapa: (funilId: string, data: unknown) => request<any>(`/funis/${funilId}/etapas`, { method: 'POST', body: data }),
  updateFunilEtapa: (funilId: string, etapaId: string, data: unknown) => request<any>(`/funis/${funilId}/etapas/${etapaId}`, { method: 'PUT', body: data }),
  deleteFunilEtapa: (funilId: string, etapaId: string) => request<void>(`/funis/${funilId}/etapas/${etapaId}`, { method: 'DELETE' }),
}
