// Spintax: resolve grupos no formato {opção1|opção2|opção3} escolhendo uma
// opção aleatória a cada chamada. Assim cada disparo gera um texto ligeiramente
// diferente — um dos principais fatores para não cair em filtro anti-spam.
//
// IMPORTANTE: só grupos que contêm "|" são resolvidos. Placeholders de
// personalização ({nome}, {telefone}, ...) NÃO têm "|", então passam intactos e
// são substituídos depois.
export function resolverSpintax(texto: string): string {
  const regex = /\{([^{}]*\|[^{}]*)\}/
  let saida = texto
  let guarda = 0
  while (regex.test(saida) && guarda++ < 100) {
    saida = saida.replace(regex, (_m, grupo: string) => {
      const opcoes = grupo.split('|')
      return opcoes[Math.floor(Math.random() * opcoes.length)].trim()
    })
  }
  return saida
}

// Conta quantas variações possíveis um texto com spintax pode gerar (aprox.).
export function contarVariacoes(texto: string): number {
  const grupos = texto.match(/\{([^{}]*\|[^{}]*)\}/g) || []
  return grupos.reduce((total, g) => total * g.slice(1, -1).split('|').length, 1)
}
