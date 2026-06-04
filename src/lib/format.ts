/** Aplica a máscara (XX) XXXXX-XXXX a um valor de telefone digitado. */
export function maskTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Telefone é válido quando tem 10 (fixo) ou 11 (celular) dígitos. */
export function isTelefoneValido(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

/** Formata um ISO timestamp para dd/mm/aaaa hh:mm. */
export function formatDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
