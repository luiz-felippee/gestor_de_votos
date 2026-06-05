// Cliente HTTP da API do Gestor de Votos (backend próprio em Node/Express).
// A URL base vem de VITE_API_URL (padrão: backend local na porta 3001).
import type {
  CaboEleitoral,
  EleitorComCabo,
  Usuario,
  UsuarioAdmin,
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

  // ---- Usuários (gestão de acessos — admin) ----
  getUsuarios: () => request<UsuarioAdmin[]>('/usuarios'),
  createUsuario: (data: unknown) =>
    request<UsuarioAdmin>('/usuarios', { method: 'POST', body: data }),
  updateUsuario: (id: string, data: unknown) =>
    request<UsuarioAdmin>(`/usuarios/${id}`, { method: 'PUT', body: data }),
  deleteUsuario: (id: string) =>
    request<void>(`/usuarios/${id}`, { method: 'DELETE' }),

  // ---- Eleitores ----
  getEleitores: () => request<EleitorComCabo[]>('/eleitores'),
  createEleitor: (data: unknown) =>
    request<EleitorComCabo>('/eleitores', { method: 'POST', body: data }),
  updateEleitor: (id: string, data: unknown) =>
    request<EleitorComCabo>(`/eleitores/${id}`, { method: 'PUT', body: data }),
  deleteEleitor: (id: string) =>
    request<void>(`/eleitores/${id}`, { method: 'DELETE' }),
  anonimizarEleitor: (id: string) =>
    request<EleitorComCabo>(`/eleitores/${id}/anonimizar`, { method: 'POST' }),

  // ---- Bairros (autocomplete do formulário) ----
  getBairros: () => request<string[]>('/bairros'),
}
