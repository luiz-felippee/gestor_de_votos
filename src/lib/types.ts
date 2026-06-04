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
  created_at: string
}

export interface CaboEleitoral {
  id: string
  nome: string
  telefone: string
  bairro_atuacao: string | null
  cidade: string | null
  meta_eleitores: number
  created_at: string
}

/** Eleitor com o nome do cabo já resolvido (join), usado na planilha. */
export interface EleitorComCabo extends Eleitor {
  cabo: Pick<CaboEleitoral, 'id' | 'nome'> | null
}
