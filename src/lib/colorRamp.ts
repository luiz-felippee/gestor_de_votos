// Gera uma escala de 11 tons (50..950, no padrão Tailwind) a partir de UMA cor
// hex escolhida pela campanha. A cor escolhida vira o tom 600 — o mesmo peso
// visual do brand-600 padrão (usado nos botões primários) — e o resto da escada
// acompanha a curva de luminosidade/saturação do indigo padrão, só deslocada
// para a luminosidade da cor escolhida. Resultado: qualquer cor de campanha
// rende uma escala com o mesmo "sentimento" de contraste do tema original.

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const limpo = hex.replace('#', '')
  const full = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: RGB = [0, 0, 0]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgb.map((v) => Math.round((v + m) * 255)) as RGB
}

const ESTAGIOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
// Curva de referência = luminosidade/saturação reais do brand-* padrão (indigo).
const L_REFERENCIA = [97, 94, 87, 79, 69, 60, 53, 46, 38, 30, 18]
const S_REFERENCIA = [92, 90, 88, 86, 85, 84, 78, 68, 60, 52, 45]

/** Retorna `{ 50: "R G B", ..., 950: "R G B" }` — pronto pra virar CSS custom property. */
export function gerarEscalaCor(hex: string): Record<(typeof ESTAGIOS)[number], string> {
  const [h, sBase, lBase] = rgbToHsl(hexToRgb(hex))
  const idxBase = ESTAGIOS.indexOf(600)
  const deltaL = lBase - L_REFERENCIA[idxBase]
  // Normaliza pelo valor de referência do próprio 600: sem isso, o 600 saía sempre
  // ~22% mais desbotado que a cor escolhida (78/100 da referência), porque a
  // multiplicação usava a % absoluta da curva em vez da posição relativa ao ponto
  // que a cor do usuário deveria ocupar. Com isso, o tom 600 fica IDÊNTICO à cor
  // escolhida (mesmo H/S/L), e o resto da escada varia relativamente a partir dele.
  const sRefBase = S_REFERENCIA[idxBase]

  const escala = {} as Record<(typeof ESTAGIOS)[number], string>
  ESTAGIOS.forEach((estagio, i) => {
    const l = Math.min(98, Math.max(4, L_REFERENCIA[i] + deltaL))
    const s = Math.min(100, Math.max(0, sBase * (S_REFERENCIA[i] / sRefBase)))
    const [r, g, b] = hslToRgb(h, s, l)
    escala[estagio] = `${r} ${g} ${b}`
  })
  return escala
}

/** Estilo inline com as CSS custom properties --brand-50..950, escopado ao elemento. */
export function cssVarsDaCor(hex: string | null | undefined): React.CSSProperties {
  if (!hex || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return {}
  const escala = gerarEscalaCor(hex)
  const vars: Record<string, string> = {}
  for (const estagio of ESTAGIOS) {
    vars[`--brand-${estagio}`] = escala[estagio]
  }
  return vars as React.CSSProperties
}
