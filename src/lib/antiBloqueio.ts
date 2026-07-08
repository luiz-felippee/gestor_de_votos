// Configuração e utilitários do "Modo Anti-Bloqueio" para disparos de WhatsApp.
// Objetivo: fazer o envio em massa parecer humano e respeitar limites, reduzindo
// drasticamente o risco de banimento do número na Evolution API.

export interface AntiBloqueioConfig {
  ativo: boolean
  delayMinSeg: number // intervalo mínimo entre uma mensagem e a próxima (s)
  delayMaxSeg: number // intervalo máximo (s) — o real é sorteado nesse range
  limiteDiario: number // teto de mensagens por dia (aquecimento do número)
  lotePausaCada: number // a cada N envios, faz uma pausa maior
  lotePausaSeg: number // duração da pausa em lote (s)
  horarioInicio: number // hora do dia a partir da qual pode enviar (0-23)
  horarioFim: number // hora do dia até a qual pode enviar (0-23)
  validarNumero: boolean // checa no WhatsApp se o número existe antes de enviar
}

export const ANTIBLOQUEIO_PADRAO: AntiBloqueioConfig = {
  ativo: true,
  delayMinSeg: 15,
  delayMaxSeg: 45,
  limiteDiario: 200,
  lotePausaCada: 25,
  lotePausaSeg: 180,
  horarioInicio: 8,
  horarioFim: 20,
  validarNumero: false,
}

const CONFIG_KEY = 'whatsapp_antibloqueio'
const CONTADOR_KEY = 'whatsapp_contador_dia'

export function carregarConfig(): AntiBloqueioConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...ANTIBLOQUEIO_PADRAO, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...ANTIBLOQUEIO_PADRAO }
}

export function salvarConfig(config: AntiBloqueioConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

// ---- Contador diário (reseta sozinho a cada dia) ----

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function contadorHoje(): number {
  try {
    const raw = localStorage.getItem(CONTADOR_KEY)
    if (!raw) return 0
    const { data, count } = JSON.parse(raw)
    return data === hojeISO() ? count : 0
  } catch {
    return 0
  }
}

export function incrementarContador(): number {
  const atual = contadorHoje()
  const novo = atual + 1
  try {
    localStorage.setItem(CONTADOR_KEY, JSON.stringify({ data: hojeISO(), count: novo }))
  } catch {
    /* ignore */
  }
  return novo
}

// ---- Helpers de tempo ----

export function segundosAleatorios(min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return Math.floor(lo + Math.random() * (hi - lo))
}

export function dentroDoHorario(config: AntiBloqueioConfig, agora = new Date()): boolean {
  const h = agora.getHours()
  return h >= config.horarioInicio && h < config.horarioFim
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
