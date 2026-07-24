// Espelho de backend/data/regioes-pe.json (dado estático, sem custo de round-trip
// pro seletor de escopo do painel da liderança). Se o backend mudar essa lista,
// atualize aqui também.
export const REGIOES_PE: Record<string, string[]> = {
  'Região Metropolitana do Recife': [
    'Abreu e Lima', 'Araçoiaba', 'Cabo de Santo Agostinho', 'Camaragibe', 'Igarassu',
    'Ilha de Itamaracá', 'Ipojuca', 'Itapissuma', 'Jaboatão dos Guararapes', 'Moreno',
    'Olinda', 'Paulista', 'Recife', 'São Lourenço da Mata',
  ],
  'Zona da Mata': [
    'Aliança', 'Buenos Aires', 'Camutanga', 'Carpina', 'Condado', 'Ferreiros', 'Goiana',
    'Itambé', 'Itaquitinga', 'Lagoa de Itaenga', 'Lagoa do Carro', 'Macaparana',
    'Nazaré da Mata', 'Paudalho', 'Timbaúba', 'Tracunhaém', 'Vicência',
    'Água Preta', 'Amaraji', 'Barreiros', 'Belém de Maria', 'Catende', 'Chã de Alegria',
    'Chã Grande', 'Cortês', 'Escada', 'Gameleira', 'Jaqueira', 'Joaquim Nabuco',
    'Maraial', 'Palmares', 'Pombos', 'Primavera', 'Quipapá', 'Ribeirão', 'Rio Formoso',
    'São Benedito do Sul', 'São José da Coroa Grande', 'Sirinhaém', 'Tamandaré',
    'Vitória de Santo Antão', 'Xexéu', 'Glória do Goitá',
  ],
  'Agreste': [
    'Agrestina', 'Águas Belas', 'Alagoinha', 'Altinho', 'Angelim', 'Belo Jardim',
    'Bezerros', 'Bom Conselho', 'Bom Jardim', 'Brejão', 'Brejo da Madre de Deus',
    'Cachoeirinha', 'Caetés', 'Calçado', 'Camocim de São Félix', 'Canhotinho',
    'Capoeiras', 'Caruaru', 'Casinhas', 'Correntes', 'Cumaru', 'Cupira', 'Feira Nova',
    'Frei Miguelinho', 'Garanhuns', 'Gravatá', 'Iati', 'Ibirajuba', 'Itaíba', 'Jataúba',
    'João Alfredo', 'Jucati', 'Jupi', 'Jurema', 'Lagoa do Ouro', 'Lagoa dos Gatos',
    'Lajedo', 'Limoeiro', 'Machados', 'Orobó', 'Panelas', 'Paranatama', 'Passira',
    'Pedra', 'Pesqueira', 'Poção', 'Riacho das Almas', 'Sairé', 'Salgadinho', 'Saloá',
    'Sanharó', 'Santa Cruz do Capibaribe', 'Santa Maria do Cambucá', 'São Bento do Una',
    'São Caitano', 'São João', 'São Joaquim do Monte', 'São Vicente Férrer', 'Surubim',
    'Tacaimbó', 'Taquaritinga do Norte', 'Terezinha', 'Toritama', 'Tupanatinga',
    'Venturosa', 'Vertente do Lério', 'Vertentes',
    'Barra de Guabiraba', 'Bonito', 'Buíque', 'Palmeirina',
  ],
  'Sertão': [
    'Afogados da Ingazeira', 'Araripina', 'Arcoverde', 'Betânia', 'Bodocó', 'Brejinho',
    'Calumbi', 'Carnaíba', 'Carnaubeira da Penha', 'Cedro', 'Custódia', 'Exu', 'Flores',
    'Floresta', 'Granito', 'Ibimirim', 'Iguaracy', 'Inajá', 'Ipubi', 'Itapetim',
    'Manari', 'Mirandiba', 'Moreilândia', 'Ouricuri', 'Parnamirim', 'Quixaba',
    'Salgueiro', 'Santa Cruz', 'Santa Cruz da Baixa Verde', 'Santa Filomena',
    'São José do Belmonte', 'São José do Egito', 'Serra Talhada', 'Serrita', 'Sertânia',
    'Solidão', 'Tabira', 'Trindade', 'Triunfo', 'Tuparetama', 'Verdejante',
    'Santa Terezinha', 'Ingazeira',
  ],
  'Sertão do São Francisco': [
    'Afrânio', 'Belém do São Francisco', 'Cabrobó', 'Dormentes', 'Itacuruba', 'Jatobá',
    'Lagoa Grande', 'Orocó', 'Petrolândia', 'Petrolina', 'Santa Maria da Boa Vista',
    'Tacaratu', 'Terra Nova',
  ],
  'Fernando de Noronha': ['Fernando de Noronha'],
}

export const NOMES_REGIOES = Object.keys(REGIOES_PE)

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const REGIAO_POR_MUNICIPIO = new Map<string, string>()
for (const [regiao, municipios] of Object.entries(REGIOES_PE)) {
  for (const m of municipios) REGIAO_POR_MUNICIPIO.set(normalizar(m), regiao)
}

export function regiaoDoMunicipio(cidade: string | null | undefined): string | null {
  if (!cidade) return null
  return REGIAO_POR_MUNICIPIO.get(normalizar(cidade)) ?? null
}
