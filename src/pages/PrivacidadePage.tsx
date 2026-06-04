/** Política de privacidade (LGPD). Página pública, sem autenticação. */
export function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <article className="prose-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Em conformidade com a Lei Geral de Proteção de Dados (Lei nº
          13.709/2018 — LGPD).
        </p>

        <Secao titulo="1. Dados coletados">
          Coletamos nome, telefone/WhatsApp, local de votação, zona, seção,
          bairro e cidade do eleitor, além do cabo eleitoral responsável pela
          indicação. Observações são opcionais.
        </Secao>

        <Secao titulo="2. Finalidade">
          Os dados são utilizados exclusivamente para organização e
          acompanhamento da campanha eleitoral, incluindo comunicação com o
          eleitor e análises estatísticas internas (por região e cabo).
        </Secao>

        <Secao titulo="3. Consentimento">
          O cadastro só é realizado mediante consentimento explícito do titular,
          coletado no momento do preenchimento do formulário.
        </Secao>

        <Secao titulo="4. Compartilhamento">
          Os dados não são vendidos nem compartilhados com terceiros fora do
          escopo da campanha. O acesso é restrito à equipe autorizada, com
          controle por perfil de acesso.
        </Secao>

        <Secao titulo="5. Segurança">
          Os dados são armazenados em banco de dados com criptografia em repouso,
          acesso via HTTPS e regras de segurança em nível de linha (RLS).
        </Secao>

        <Secao titulo="6. Direitos do titular">
          O titular pode solicitar, a qualquer momento, acesso, correção,
          anonimização ou exclusão dos seus dados, entrando em contato com a
          coordenação da campanha.
        </Secao>
      </article>
    </div>
  )
}

function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-5">
      <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">{titulo}</h2>
      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{children}</p>
    </section>
  )
}
