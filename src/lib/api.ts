// Cliente HTTP da API do Gestor de Votos (backend próprio em Node/Express).
// A URL base vem de VITE_API_URL (padrão: backend local na porta 3001).
import type {
  CaboEleitoral,
  EleitorComCabo,
  Usuario,
  UsuarioAdmin,
  Evento,
  LogAuditoria,
  Campanha,
  FunilTemplate,
  TarefaFunil,
  MeuPainelLideranca,
  RankingLiderancaItem,
} from './types'
import { saveToOfflineQueue } from './offline'

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

// Aborta requisições que travam (ex.: backend do Render acordando de cold start).
// Sem timeout, um fetch pendurado deixa a tela "carregando" pra sempre, sem erro.
const TIMEOUT_PADRAO_MS = 20_000

export async function fetchComTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_PADRAO_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
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
    res = await fetchComTimeout(`${API_BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (e) {
    const foiTimeout = e instanceof DOMException && e.name === 'AbortError'
    throw new ApiError(
      foiTimeout
        ? 'O servidor está demorando a responder (pode estar reiniciando). Tente de novo em alguns segundos.'
        : 'Não foi possível conectar ao servidor. Verifique sua conexão.',
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

export interface EleitorFiltros {
  busca?: string
  cidade?: string
  bairro?: string
  status?: string
  cabo_id?: string
  zona?: number
  mes_aniversario?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

function montarQueryEleitores(p?: EleitorFiltros & { page?: number; limit?: number }): string {
  const q = new URLSearchParams()
  if (!p) return ''
  if (p.page) q.set('page', String(p.page))
  if (p.limit) q.set('limit', String(p.limit))
  if (p.busca) q.set('busca', p.busca)
  if (p.cidade) q.set('cidade', p.cidade)
  if (p.bairro) q.set('bairro', p.bairro)
  if (p.status) q.set('status', p.status)
  if (p.cabo_id) q.set('cabo_id', p.cabo_id)
  if (p.zona) q.set('zona', String(p.zona))
  if (p.mes_aniversario) q.set('mes_aniversario', p.mes_aniversario)
  if (p.sort) q.set('sort', p.sort)
  if (p.dir) q.set('dir', p.dir)
  return q.toString()
}

// Acorda o backend (Render free dorme após ~15min). Disparado ao abrir a tela de
// login para que, enquanto o usuário digita, o servidor já esteja quente.
// Best-effort: falhas são ignoradas de propósito (não deve travar nada).
export function prewarmBackend(): void {
  try {
    fetch(`${API_BASE}/api/health`, { method: 'GET', cache: 'no-store' }).catch(() => {})
  } catch {
    /* ignore */
  }
}

export const api = {
  base: API_BASE,

  // ---- Autenticação ----
  login: (email: string, senha: string) =>
    request<{ token: string; usuario: Usuario } | { require2FA: true; userId: string }>('/auth/login', {
      method: 'POST',
      body: { email, senha },
    }),
  googleLogin: (credential: string) =>
    request<{ token: string; usuario: Usuario } | { require2FA: true; userId: string }>('/auth/google', {
      method: 'POST',
      body: { credential },
    }),
  login2FA: (userId: string, token: string) =>
    request<{ token: string; usuario: Usuario }>('/auth/login-2fa', {
      method: 'POST',
      body: { userId, token },
    }),
  generate2FA: () => request<{ secret: string; qrCodeUrl: string }>('/auth/2fa/generate', { method: 'POST' }),
  enable2FA: (token: string) => request<{ message: string }>('/auth/2fa/enable', { method: 'POST', body: { token } }),
  disable2FA: (senha: string) => request<{ message: string }>('/auth/2fa/disable', { method: 'POST', body: { senha } }),
  me: () => request<{ usuario: Usuario }>('/auth/me'),
  async esqueciSenha(email: string) {
    return request<{ message: string }>('/auth/esqueci-senha', {
      method: 'POST',
      body: { email },
    })
  },
  async resetarSenha(token: string, senha: string) {
    return request<{ message: string }>('/auth/resetar-senha', {
      method: 'POST',
      body: { token, senha },
    })
  },

  // ---- Cabos ----
  getCabos: () => request<CaboEleitoral[]>('/cabos'),
  createCabo: (data: unknown) =>
    request<CaboEleitoral>('/cabos', { method: 'POST', body: data }),
  updateCabo: (id: string, data: unknown) =>
    request<CaboEleitoral>(`/cabos/${id}`, { method: 'PUT', body: data }),
  deleteCabo: (id: string, excluirEleitores?: boolean) =>
    request<void>(`/cabos/${id}${excluirEleitores ? '?excluirEleitores=true' : ''}`, { method: 'DELETE' }),
  createCaboPublic: async (dados: Partial<CaboEleitoral> & { website?: string; campanha_slug?: string }) => {
    const res = await fetchComTimeout(`${API_BASE}/api/cabos-public`, {
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
    const res = await fetchComTimeout(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    }, 60_000) // upload de imagem: teto maior
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer upload da imagem.')
    return data as { url: string }
  },

  // ---- Auditoria (admin) ----
  getAuditoria: () => request<LogAuditoria[]>('/auditoria'),

  // ---- Configurações globais (admin) ----
  getConfiguracoes: () => request<{ imgbb_key_set: boolean; imgbb_key_via_env: boolean }>('/configuracoes'),
  saveConfiguracoes: (data: { imgbb_key?: string }) => request<{ success: boolean }>('/configuracoes', { method: 'POST', body: data }),

  // ---- Campanhas (super-admin) ----
  getCampanhas: () => request<Campanha[]>('/campanhas'),
  getCampanhaPublic: async (slug: string) => {
    const res = await fetchComTimeout(`${API_BASE}/api/campanhas-public/${slug}`)
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
  getEleitores: async (params?: EleitorFiltros & { page?: number; limit?: number }) => {
    const qs = montarQueryEleitores(params)
    const res = await request<{ data: EleitorComCabo[]; total: number; page: number; limit: number; totalPages: number }>(`/eleitores${qs ? `?${qs}` : ''}`)
    return res
  },
  /** Busca TODOS os eleitores que batem com os filtros (para exportar / selecionar todos). */
  getEleitoresFiltrados: async (filtros?: EleitorFiltros) => {
    const first = await request<{ data: EleitorComCabo[]; total: number }>(
      `/eleitores?${montarQueryEleitores({ ...filtros, page: 1, limit: 200 })}`,
    )
    const all = [...(first.data ?? [])]
    if ((first.total ?? 0) > 200) {
      const pages = Math.ceil(first.total / 200)
      const proms: Promise<{ data: EleitorComCabo[] }>[] = []
      for (let p = 2; p <= pages; p++) {
        proms.push(request<{ data: EleitorComCabo[] }>(`/eleitores?${montarQueryEleitores({ ...filtros, page: p, limit: 200 })}`))
      }
      const rs = await Promise.all(proms)
      for (const r of rs) all.push(...(r.data ?? []))
    }
    return all
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
  getMapaPontos: (query: string = '') => request<any>(`/dashboard/mapa-pontos${query}`),

  // ---- Painel da Liderança ----
  getMeuPainel: () => request<MeuPainelLideranca>('/liderancas/meu-painel'),
  getRankingLiderancas: (escopo: 'municipio' | 'regiao' | 'pe', valor?: string | null) => {
    const q = new URLSearchParams({ escopo })
    if (valor) q.set('valor', valor)
    return request<{ ranking: RankingLiderancaItem[]; regioes: string[] }>(`/liderancas/ranking?${q.toString()}`)
  },
  validarSecao: (zona: number | string, secao: number | string) =>
    request<{ valido: boolean; cidade: string | null }>(
      `/locais/validar?zona=${encodeURIComponent(zona)}&secao=${encodeURIComponent(secao)}`
    ),
  geocodificarEleitores: () =>
    request<{ processados: number; geocodificados: number; restantes: number }>(
      '/eleitores/geocodificar',
      { method: 'POST' }
    ),
  regeocodificarEleitores: () =>
    request<{ message: string; resetados: number }>(
      '/eleitores/regeocodificar',
      { method: 'POST' }
    ),
  createEleitor: async (data: unknown) => {
    if (!navigator.onLine) {
      // Estamos offline. Salva no IndexedDB e forja uma resposta de sucesso pro componente.
      const offlineItem = await saveToOfflineQueue(data)
      return {
        id: offlineItem.tempId,
        ...data as any,
        created_at: new Date().toISOString(),
        _offline: true // Flag pra interface saber que ainda não subiu
      } as EleitorComCabo
    }
    return request<EleitorComCabo>('/eleitores', { method: 'POST', body: data })
  },
  importarEleitores: (eleitores: unknown[]) =>
    request<{ message: string; inserted: number; totalSent: number }>('/eleitores/import', { method: 'POST', body: { eleitores } }),
  updateEleitor: (id: string, data: unknown) =>
    request<EleitorComCabo>(`/eleitores/${id}`, { method: 'PUT', body: data }),
  deleteEleitor: (id: string) =>
    request<void>(`/eleitores/${id}`, { method: 'DELETE' }),
  anonimizarEleitor: (id: string) =>
    request<EleitorComCabo>(`/eleitores/${id}/anonimizar`, { method: 'POST' }),

  // ---- Bairros (autocomplete do formulário) ----
  getBairros: () => request<string[]>('/bairros'),

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

  // ---- Funil CRM ----
  getFunilTarefasHoje: () => request<{ tarefas: TarefaFunil[] }>('/funil/tarefas-hoje'),
  avancarFunil: (eleitor_id: string, etapa_destino: string) => request<{ success: boolean }>('/funil/avancar', { method: 'POST', body: { eleitor_id, etapa_destino } }),
  getFunilTemplates: () => request<{ templates: FunilTemplate[] }>('/funil/templates'),
  createFunilTemplate: (data: unknown) => request<{ template: FunilTemplate }>('/funil/templates', { method: 'POST', body: data }),
  deleteFunilTemplate: (id: string) => request<{ success: boolean }>(`/funil/templates/${id}`, { method: 'DELETE' }),

  // ---- Evolution API (WhatsApp) ----
  getWhatsAppConfig: () => request<{ evo_api_url: string; evo_global_key_set: boolean; instance_name: string | null }>('/whatsapp/config'),
  saveWhatsAppConfig: (data: { evo_api_url: string; evo_global_key?: string }) => request<{ success: boolean }>('/whatsapp/config', { method: 'POST', body: data }),
  getWhatsAppStatus: () => request<{ status: string }>('/whatsapp/status'),
  connectWhatsApp: () => request<{ qrcode: string, message?: string }>('/whatsapp/connect', { method: 'POST' }),
  disconnectWhatsApp: () => request<{ success: boolean }>('/whatsapp/disconnect', { method: 'POST' }),
  sendWhatsAppMessage: (numero: string, texto: string, delay?: number) => request<{ success: boolean }>('/whatsapp/send', { method: 'POST', body: { numero, texto, delay } }),
  checkWhatsAppNumbers: (numeros: string[]) => request<{ validos: string[]; aviso?: string }>('/whatsapp/check-numbers', { method: 'POST', body: { numeros } }),
}
