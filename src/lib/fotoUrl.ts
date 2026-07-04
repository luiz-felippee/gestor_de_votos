import { API_BASE } from './api'

/**
 * Resolve uma foto_url para uma URL completa.
 * 
 * Cenários suportados:
 *  - Data URL (base64): "data:image/webp;base64,..." → retorna direto
 *  - URL absoluta (http/https): "https://..." → retorna direto
 *  - Caminho relativo (legado): "/uploads/xxx.webp" → prefixa com API_BASE
 *  - null/undefined/vazio → retorna o fallback ou null
 */
export function resolverFotoUrl(url: string | null | undefined, fallback?: string): string | null {
  if (!url) return fallback ?? null
  if (url.startsWith('data:') || url.startsWith('http')) return url
  return `${API_BASE}${url}`
}
