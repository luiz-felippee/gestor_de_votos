// Vibração leve para dar feedback tátil em ações-chave (só onde o aparelho
// suportar — iOS Safari ignora silenciosamente). Uso: vibrar() ou vibrar(20).
export function vibrar(ms = 12): void {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* dispositivo sem suporte — ignora */
  }
}
