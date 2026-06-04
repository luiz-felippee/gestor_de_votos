import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
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
    if (!form.cabo_id) return 'Selecione o cabo eleitoral responsável.'
    if (!consentimento)
      return 'É necessário aceitar o uso dos dados para concluir o cadastro.'
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const problema = validar()
    if (problema) {
      setErro(problema)
      return
    }

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
        status: 'ativo'
      })
    } catch (err) {
      setEnviando(false)
      setErro('Erro ao cadastrar eleitor: ' + (err as Error).message)
      return
    }
    setSucesso(true)
  }

  function novoCadastro() {
    setForm({ ...VAZIO, cabo_id: caboDoLink })
    setConsentimento(false)
    setSucesso(false)
  }

  if (sucesso) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-xl border border-green-200 bg-white p-8 text-center shadow-lg dark:border-green-900/30 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600 dark:bg-green-900/30 dark:text-green-400">
          ✓
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">
          Cadastro realizado!
        </h2>
        <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
          O eleitor foi registrado com sucesso.
        </p>
        <button
          onClick={novoCadastro}
          className="w-full rounded-lg bg-brand-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Cadastrar outro eleitor
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-md sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          Cadastro de Eleitor
        </h1>
        <p className="mt-1 mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {nomeCaboDoLink
            ? `Indicação por ${nomeCaboDoLink}.`
            : 'Preencha os dados do eleitor abaixo.'}
        </p>

        <form onSubmit={enviar} className="space-y-6">
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

          <Campo label="Local de votação" obrigatorio>
            <input
              type="text"
              value={form.local_votacao}
              onChange={(e) => atualizar('local_votacao', e.target.value)}
              className={inputClass}
              placeholder="Ex.: EMEF João XXIII"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
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

          <Campo label="Cabo eleitoral responsável" obrigatorio>
            <select
              value={form.cabo_id}
              onChange={(e) => atualizar('cabo_id', e.target.value)}
              className={inputClass}
              disabled={Boolean(caboDoLink && nomeCaboDoLink)}
            >
              <option value="">Selecione...</option>
              {cabos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Observações">
            <textarea
              value={form.observacoes}
              onChange={(e) => atualizar('observacoes', e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Notas adicionais (opcional)"
            />
          </Campo>

          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={consentimento}
              onChange={(e) => setConsentimento(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              Autorizo o uso dos meus dados para fins da campanha eleitoral,
              conforme a{' '}
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
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
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
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/50 disabled:bg-slate-100 disabled:text-slate-500'

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
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
        {label}
        {obrigatorio && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
