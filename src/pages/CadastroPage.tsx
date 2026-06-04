import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import { useCabos } from '../hooks/useCabos'
import { CIDADES } from '../lib/constants'
import { maskTelefone, isTelefoneValido } from '../lib/format'

interface FormState {
  nome: string
  telefone: string
  local_votacao: string
  zona: string
  secao: string
  bairro: string
  cidade: string
  cabo_id: string
  observacoes: string
}

const VAZIO: FormState = {
  nome: '',
  telefone: '',
  local_votacao: '',
  zona: '',
  secao: '',
  bairro: '',
  cidade: '',
  cabo_id: '',
  observacoes: '',
}

export function CadastroPage() {
  const { cabos } = useCabos()
  const [params] = useSearchParams()
  const caboDoLink = params.get('cabo') ?? ''

  const [form, setForm] = useState<FormState>({ ...VAZIO, cabo_id: caboDoLink })
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const nomeCaboDoLink = useMemo(
    () => cabos.find((c) => c.id === caboDoLink)?.nome ?? null,
    [cabos, caboDoLink],
  )
  const caboTravado = Boolean(caboDoLink && nomeCaboDoLink)

  function atualizar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function validar(): string | null {
    if (!form.nome.trim()) return 'Informe o nome completo do eleitor.'
    if (!isTelefoneValido(form.telefone))
      return 'Telefone inválido. Use (XX) XXXXX-XXXX.'
    if (!form.local_votacao.trim()) return 'Informe o local de votação.'
    if (!form.zona.trim()) return 'Informe a zona eleitoral.'
    if (!form.secao.trim()) return 'Informe a seção eleitoral.'
    if (!form.bairro.trim()) return 'Informe o bairro.'
    if (!form.cidade) return 'Selecione a cidade.'
    if (!form.cabo_id) return 'Selecione quem indicou o eleitor.'
    if (!consentimento)
      return 'É necessário aceitar o uso dos dados para concluir o cadastro.'
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const problema = validar()
    if (problema) return setErro(problema)

    setEnviando(true)
    try {
      await api.createEleitor({
        nome: form.nome.trim(),
        telefone: form.telefone,
        local_votacao: form.local_votacao.trim(),
        zona: Number(form.zona),
        secao: Number(form.secao),
        bairro: form.bairro.trim(),
        cidade: form.cidade,
        cabo_id: form.cabo_id || null,
        observacoes: form.observacoes.trim() || null,
        status: 'ativo',
      })
    } catch (err) {
      setEnviando(false)
      setErro('Erro ao cadastrar: ' + (err as Error).message)
      return
    }
    setEnviando(false)
    setSucesso(true)
  }

  function novoCadastro() {
    setForm({ ...VAZIO, cabo_id: caboDoLink })
    setConsentimento(false)
    setSucesso(false)
  }

  return (
    // Fundo estilo "modal": backdrop com gradiente e o card centralizado
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Cabeçalho do modal */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            {sucesso ? <CheckCircle2 className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {sucesso ? 'Cadastro realizado!' : 'Cadastro de Eleitor'}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {sucesso
                ? 'Os dados foram registrados com sucesso.'
                : nomeCaboDoLink
                  ? `Indicação de ${nomeCaboDoLink}`
                  : 'Preencha os dados abaixo'}
            </p>
          </div>
        </div>

        {sucesso ? (
          <div className="px-6 py-10 text-center">
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Obrigado! O eleitor foi adicionado à base da campanha.
            </p>
            <button
              onClick={novoCadastro}
              className="w-full rounded-lg bg-brand-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Cadastrar outro eleitor
            </button>
          </div>
        ) : (
          <form
            onSubmit={enviar}
            className="max-h-[calc(100vh-9rem)] space-y-6 overflow-y-auto px-6 py-6"
          >
            {/* Seção: dados pessoais */}
            <Secao titulo="Dados do eleitor">
              <Campo label="Nome completo" obrigatorio>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => atualizar('nome', e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: José da Silva"
                />
              </Campo>
              <Campo label="Telefone / WhatsApp" obrigatorio>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.telefone}
                  onChange={(e) => atualizar('telefone', maskTelefone(e.target.value))}
                  className={inputClass}
                  placeholder="(11) 91234-5678"
                />
              </Campo>
            </Secao>

            {/* Seção: local de votação */}
            <Secao titulo="Local de votação">
              <Campo label="Local de votação" obrigatorio>
                <input
                  type="text"
                  value={form.local_votacao}
                  onChange={(e) => atualizar('local_votacao', e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: EMEF João XXIII"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Zona" obrigatorio>
                  <input
                    type="number"
                    min={1}
                    value={form.zona}
                    onChange={(e) => atualizar('zona', e.target.value)}
                    className={inputClass}
                  />
                </Campo>
                <Campo label="Seção" obrigatorio>
                  <input
                    type="number"
                    min={1}
                    value={form.secao}
                    onChange={(e) => atualizar('secao', e.target.value)}
                    className={inputClass}
                  />
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Bairro" obrigatorio>
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => atualizar('bairro', e.target.value)}
                    className={inputClass}
                    placeholder="Ex.: Centro"
                  />
                </Campo>
                <Campo label="Cidade" obrigatorio>
                  <select
                    value={form.cidade}
                    onChange={(e) => atualizar('cidade', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione...</option>
                    {CIDADES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </Secao>

            {/* Seção: indicação (quem trouxe o eleitor) */}
            <Secao titulo="Indicação">
              <Campo label="Quem indicou este eleitor?" obrigatorio>
                <select
                  value={form.cabo_id}
                  onChange={(e) => atualizar('cabo_id', e.target.value)}
                  className={inputClass}
                  disabled={caboTravado}
                >
                  <option value="">Selecione...</option>
                  {cabos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {caboTravado && (
                  <span className="mt-1 block text-xs text-brand-600 dark:text-brand-400">
                    Indicação preenchida automaticamente pelo link.
                  </span>
                )}
                {!caboTravado && cabos.length === 0 && (
                  <span className="mt-1 block text-xs text-amber-600">
                    Nenhum cabo cadastrado ainda — peça ao coordenador para cadastrar.
                  </span>
                )}
              </Campo>
              <Campo label="Observações">
                <textarea
                  value={form.observacoes}
                  onChange={(e) => atualizar('observacoes', e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="Notas adicionais (opcional)"
                />
              </Campo>
            </Secao>

            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                Autorizo o uso dos meus dados para fins da campanha, conforme a{' '}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 underline"
                >
                  Política de Privacidade (LGPD)
                </a>
                .
              </span>
            </label>

            {erro && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-brand-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {enviando ? 'Salvando...' : 'Cadastrar eleitor'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}

function Campo({
  label,
  obrigatorio,
  children,
}: {
  label: string
  obrigatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {obrigatorio && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
