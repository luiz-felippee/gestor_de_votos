export type StatusEleitor = 'ativo' | 'inativo' | 'pendente'

export type PerfilAcesso = 'admin' | 'coordenador' | 'cabo' | 'visualizador'

/** Usuário autenticado, conforme retornado pela API. */
export interface Usuario {
  id: string
  nome: string | null
  role: PerfilAcesso
  cabo_id: string | null
}

/** Usuário completo, usado na tela de gestão de acessos (admin). */
export interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  role: PerfilAcesso
  cabo_id: string | null
  created_at: string
  cabo: { id: string; nome: string } | null
}

export interface Eleitor {
  id: string
  nome: string
  telefone: string
  local_votacao: string
  zona: number
  secao: number
  bairro: string
  cidade: string
  cabo_id: string | null
  status: StatusEleitor
  observacoes: string | null
  data_nascimento?: string | null
  cpf?: string | null
  titulo_eleitor?: string | null
  lat?: number | null
  lng?: number | null
  whatsapp_enviado: boolean
  created_at: string
}

export interface CaboEleitoral {
  id: string
  nome: string
  telefone: string
  bairro_atuacao?: string
  cidade?: string
  meta_eleitores: number
  foi_candidato?: boolean
  cargo_candidato?: string
  ano_eleicao?: string
  votacao?: number
  data_nascimento?: string | null
  created_at?: string
}

/** Eleitor com o nome do cabo já resolvido (join), usado na planilha. */
export interface EleitorComCabo extends Eleitor {
  cabo: Pick<CaboEleitoral, 'id' | 'nome'> | null
}

export interface ConfiguracaoWhatsApp {
  id: string
  modo: string
  api_url: string | null
  api_token: string | null
  api_instancia_id: string | null
  updated_at: string
}

export interface LogAuditoria {
  id: string
  usuario_id: string | null
  usuario_nome: string | null
  acao: string
  entidade: string
  entidade_id: string | null
  detalhe: string | null
  ip: string | null
  created_at: string
}

export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_hora: string
  local: string
  bairro: string | null
  cidade: string | null
  created_at: string
}
