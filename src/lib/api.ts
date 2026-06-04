// Cliente HTTP da API do Gestor de Votos.
// A URL base vem de VITE_API_URL (padrão: backend local na porta 3001).

const BASE =
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

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Ele está rodando?',
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
  base: BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
