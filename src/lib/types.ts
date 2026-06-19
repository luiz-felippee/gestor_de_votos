export type StatusEleitor = 'ativo' | 'inativo' | 'pendente'

export type PerfilAcesso = 'admin' | 'coordenador' | 'cabo' | 'visualizador'

/** Usuário autenticado, conforme retornado pela API. */
export interface Usuario {
  id: string
  nome: string | null
  role: PerfilAcesso
  cabo_id: string | null
  campanha_id?: string | null
  super_admin?: boolean
  campanha_nome?: string | null
  campanha_slug?: string | null
}

/** Campanha (candidato) — visão do super-admin. */
export interface Campanha {
  id: string
  nome: string
  slug?: string | null
  ativa: boolean
  foto_url?: string | null
  cargo_ultima_eleicao?: string | null
  ano_ultima_eleicao?: string | null
  votos_ultima_eleicao?: number | null
  created_at: string
  total_eleitores?: number
  total_usuarios?: number
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
  campanha_id?: string | null
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
  foto_url?: string | null
  created_at?: string
  _count?: { eleitores: number }
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
  msg_boas_vindas: string | null
  ativar_chatbot: boolean
  fluxo_chatbot: any | null
  usar_ia: boolean
  ia_prompt: string | null
  updated_at: string
}

export interface MensagemWhatsApp {
  id: string
  campanha_id: string
  numero: string
  texto: string
  is_from_me: boolean
  lida: boolean
  created_at: string
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
