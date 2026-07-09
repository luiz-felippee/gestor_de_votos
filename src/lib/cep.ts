// Busca de endereço por CEP com tolerância a falhas.
// Tenta vários provedores gratuitos em sequência (sem chave/API key). Se um
// estiver fora do ar ou lento, cai para o próximo — assim a busca não quebra
// quando o ViaCEP tem instabilidade (o que acontece com frequência).

export interface EnderecoCep {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

// fetch com timeout (aborta requisições travadas para não segurar o usuário).
async function fetchComTimeout(url: string, ms = 4000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// --- Provedores (cada um normaliza para EnderecoCep ou retorna null) ---

async function viaCep(cep: string): Promise<EnderecoCep | null> {
  const res = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`)
  const d = await res.json()
  if (d?.erro) return null
  return {
    cep,
    logradouro: d.logradouro || '',
    complemento: d.complemento || '',
    bairro: d.bairro || '',
    cidade: d.localidade || '',
    uf: d.uf || '',
  }
}

async function brasilApi(cep: string): Promise<EnderecoCep | null> {
  const res = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`)
  if (!res.ok) return null
  const d = await res.json()
  return {
    cep,
    logradouro: d.street || '',
    complemento: '',
    bairro: d.neighborhood || '',
    cidade: d.city || '',
    uf: d.state || '',
  }
}

async function openCep(cep: string): Promise<EnderecoCep | null> {
  const res = await fetchComTimeout(`https://opencep.com/v1/${cep}`)
  if (!res.ok) return null
  const d = await res.json()
  if (!d || d.erro) return null
  return {
    cep,
    logradouro: d.logradouro || '',
    complemento: d.complemento || '',
    bairro: d.bairro || '',
    cidade: d.localidade || '',
    uf: d.uf || '',
  }
}

const PROVEDORES = [viaCep, brasilApi, openCep]

/**
 * Busca o endereço de um CEP. Retorna null se o CEP for inválido ou nenhum
 * provedor encontrar/responder.
 */
export async function buscarCep(cepBruto: string): Promise<EnderecoCep | null> {
  const cep = cepBruto.replace(/\D/g, '')
  if (cep.length !== 8) return null

  for (const provedor of PROVEDORES) {
    try {
      const r = await provedor(cep)
      if (r) return r
    } catch {
      // provedor fora do ar / timeout — tenta o próximo
    }
  }
  return null
}
