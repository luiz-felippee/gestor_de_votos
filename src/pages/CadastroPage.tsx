import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { CheckCircle2, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import { useCabos } from '../hooks/useCabos'
import { CIDADES } from '../lib/constants'
import { maskTelefone, isTelefoneValido, generateSlug } from '../lib/format'
import { LocalVotacaoAutocomplete } from '../components/LocalVotacaoAutocomplete'
import type { Campanha } from '../lib/types'

interface FormState {
  nome: string
  telefone: string
  cep: string
  local_votacao: string
  zona: string
  secao: string
  bairro: string
  cidade: string
  data_nascimento: string
  cpf: string
  titulo_eleitor: string
  cabo_id: string
  observacoes: string
}

const VAZIO: FormState = {
  nome: '',
  telefone: '',
  cep: '',
  local_votacao: '',
  zona: '',
  secao: '',
  bairro: '',
  cidade: '',
  data_nascimento: '',
  cpf: '',
  titulo_eleitor: '',
  cabo_id: '',
  observacoes: '',
}

export function CadastroPage() {
  const { cabos } = useCabos()
  const [params] = useSearchParams()
  const { campanhaSlug, nomeCabo } = useParams() // Rota: /c/:campanhaSlug/:nomeCabo
  
  const caboDoLink = params.get('cabo') ?? ''

  // Busca dados públicos da campanha
  const [campanha, setCampanha] = useState<Partial<Campanha> | null>(null)
  useEffect(() => {
    if (campanhaSlug) {
      api.getCampanhaPublic(campanhaSlug).then(setCampanha).catch(() => {})
    }
  }, [campanhaSlug])

  // Encontra o cabo se vier pelo query param antigo, OU pelo novo slug
  const caboEncontrado = useMemo(() => {
    if (caboDoLink) {
      return cabos.find((c) => c.id === caboDoLink) || null
    }
    if (nomeCabo) {
      return cabos.find((c) => generateSlug(c.nome) === nomeCabo) || null
    }
    return null
  }, [cabos, caboDoLink, nomeCabo])

  const [form, setForm] = useState<FormState>(VAZIO)
  const [website, setWebsite] = useState('') // honeypot (anti-robô)
  const [bairros, setBairros] = useState<string[]>([])
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  // Sugestões de bairro para o autocomplete
  useEffect(() => {
    api.getBairros().then(setBairros).catch(() => {})
  }, [])

  // Inicializa o form com o id do cabo
  useEffect(() => {
    if (caboEncontrado) {
      setForm(f => ({ ...f, cabo_id: caboEncontrado.id }))
    }
  }, [caboEncontrado])

  const nomeCaboDoLink = caboEncontrado?.nome || null
  const caboTravado = Boolean(caboEncontrado)

  function atualizar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function buscarCep(cepFormatado: string) {
    const limpo = cepFormatado.replace(/\D/g, '')
    if (limpo.length !== 8) return

    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => ({
          ...f,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade
        }))
      }
    } catch {
      // Ignora erro do viacep
    }
  }

  function handleCepChange(val: string) {
    // Formata CEP: 12345-678
    let f = val.replace(/\D/g, '')
    if (f.length > 5) f = f.slice(0, 5) + '-' + f.slice(5, 8)
    atualizar('cep', f)
    if (f.length === 9) buscarCep(f)
  }

  function maskCpf(v: string) {
    return v
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  }

  function maskTitulo(v: string) {
    return v.replace(/\D/g, '').slice(0, 12);
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
        data_nascimento: form.data_nascimento || null,
        cpf: form.cpf || null,
        titulo_eleitor: form.titulo_eleitor || null,
        cabo_id: form.cabo_id || null,
        observacoes: form.observacoes.trim() || null,
        status: 'ativo',
        website, // honeypot: humanos deixam vazio
        campanha_slug: campanhaSlug, // <-- Adicionando o slug da campanha para o backend
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
    setForm({ ...VAZIO, cabo_id: caboEncontrado?.id || '' })
    setConsentimento(false)
    setSucesso(false)
  }

  return (
    // Fundo da página (tela toda)
    <div className="flex min-h-[100dvh] min-h-safe items-start justify-center bg-slate-50 py-6 pb-safe pt-safe sm:py-12 sm:px-4">
      <div className="w-full max-w-lg overflow-hidden sm:rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border-x border-y sm:border border-slate-200 dark:border-slate-800">
        
        {/* Cover Image & Avatar */}
        <div className="relative h-32 w-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-700 sm:h-40">
          {campanha?.foto_url && (
            <img src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} alt="Capa" className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay" />
          )}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-10 left-6">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {campanha?.foto_url ? (
                <img src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} alt="Candidato" className="h-full w-full object-cover" />
              ) : (
                <UserPlus className="h-10 w-10 text-brand-600 dark:text-brand-400" />
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-12">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {sucesso ? 'Cadastro realizado!' : (campanha?.nome ? `Apoio: ${campanha.nome}` : 'Apoio à Campanha')}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {sucesso
              ? 'Os dados foram registrados com sucesso.'
              : nomeCaboDoLink
                ? `Indicação de ${nomeCaboDoLink}`
                : 'Preencha seus dados para fazer parte do projeto.'}
          </p>
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
            {/* Honeypot anti-robô: invisível e fora do fluxo de tab */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
            />

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
              <Campo label="Data de Nascimento (Opcional)">
                <input
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => atualizar('data_nascimento', e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo label="CEP">
                <div className="relative">
                  <input
                    type="tel"
                    value={form.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className={inputClass}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {form.cep.length === 9 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                </div>
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="CPF (Opcional)">
                  <input
                    type="tel"
                    value={form.cpf}
                    onChange={(e) => atualizar('cpf', maskCpf(e.target.value))}
                    className={inputClass}
                    placeholder="000.000.000-00"
                  />
                </Campo>
                <Campo label="Título de Eleitor (Opcional)">
                  <input
                    type="tel"
                    value={form.titulo_eleitor}
                    onChange={(e) => atualizar('titulo_eleitor', maskTitulo(e.target.value))}
                    className={inputClass}
                    placeholder="Apenas números"
                  />
                </Campo>
              </div>
            </Secao>

            {/* Seção: local de votação */}
            <Secao titulo="Local de votação">
              <Campo label="Local de votação" obrigatorio>
                <LocalVotacaoAutocomplete
                  value={form.local_votacao}
                  onChangeLocal={(val) => atualizar('local_votacao', val)}
                  onSelectAddress={(bairro, cidade) => {
                    setForm(f => ({
                      ...f,
                      bairro: bairro || f.bairro,
                      cidade: cidade || f.cidade
                    }))
                  }}
                  className={inputClass}
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label="Bairro" obrigatorio>
                  <input
                    type="text"
                    list="lista-bairros"
                    value={form.bairro}
                    onChange={(e) => atualizar('bairro', e.target.value)}
                    className={inputClass}
                    placeholder="Ex.: Centro"
                  />
                  <datalist id="lista-bairros">
                    {bairros.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
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
                  {cabos.filter((c) => campanha ? c.campanha_id === campanha.id : true).map((c) => (
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
