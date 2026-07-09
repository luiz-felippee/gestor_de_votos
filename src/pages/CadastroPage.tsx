import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { CheckCircle2, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { buscarCep } from '../lib/cep'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { useCabos } from '../hooks/useCabos'
import { CIDADES } from '../lib/constants'
import { maskTelefone, isTelefoneValido, generateSlug } from '../lib/format'
import { LocalVotacaoAutocomplete } from '../components/LocalVotacaoAutocomplete'
import { saveToOfflineQueue } from '../lib/offline'
import { updateFavicon } from '../lib/favicon'
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
  endereco: string
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
  endereco: '',
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

  // Atualiza o favicon dinamicamente
  useEffect(() => {
    if (campanha?.foto_url) {
      const url = resolverFotoUrl(campanha.foto_url)
      updateFavicon(url)
    } else {
      updateFavicon(null)
    }
    return () => updateFavicon(null)
  }, [campanha])

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
  const [erros, setErros] = useState<Record<string, string>>({})
  const [sucesso, setSucesso] = useState(false)

  // Validação de zona/seção contra a base oficial do TSE (PE)
  const [secaoCheck, setSecaoCheck] = useState<{ estado: 'idle' | 'checando' | 'valida' | 'invalida'; cidade?: string | null }>({ estado: 'idle' })
  const [cepBuscando, setCepBuscando] = useState(false)

  // Sugestões de bairro para o autocomplete
  useEffect(() => {
    api.getBairros().then(setBairros).catch(() => {})
  }, [])

  // Confere zona+seção no TSE (com debounce) sempre que ambos estiverem preenchidos
  useEffect(() => {
    const z = form.zona.trim(), s = form.secao.trim()
    if (!z || !s) { setSecaoCheck({ estado: 'idle' }); return }
    setSecaoCheck({ estado: 'checando' })
    const t = setTimeout(() => {
      api.validarSecao(z, s)
        .then((r) => setSecaoCheck({ estado: r.valido ? 'valida' : 'invalida', cidade: r.cidade }))
        .catch(() => setSecaoCheck({ estado: 'idle' }))
    }, 450)
    return () => clearTimeout(t)
  }, [form.zona, form.secao])

  // Inicializa o form com o id do cabo
  useEffect(() => {
    if (caboEncontrado) {
      setForm(f => ({ ...f, cabo_id: caboEncontrado.id }))
    }
  }, [caboEncontrado])

  const caboTravado = Boolean(caboEncontrado)

  function atualizar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // Limpa erro do campo ao começar a digitar
    if (erros[campo]) {
      setErros((e) => {
        const copy = { ...e }
        delete copy[campo]
        return copy
      })
    }
  }

  async function preencherPorCep(cepFormatado: string) {
    setCepBuscando(true)
    try {
      const end = await buscarCep(cepFormatado)
      if (end) {
        setForm(f => ({
          ...f,
          bairro: end.bairro || f.bairro,
          cidade: end.cidade || f.cidade,
          endereco: end.logradouro ? `${end.logradouro}, ` : f.endereco
        }))
      }
    } finally {
      setCepBuscando(false)
    }
  }

  function handleCepChange(val: string) {
    let f = val.replace(/\D/g, '')
    if (f.length > 5) f = f.slice(0, 5) + '-' + f.slice(5, 8)
    atualizar('cep', f)
    if (f.length === 9) preencherPorCep(f)
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

  function validar(): boolean {
    const novosErros: Record<string, string> = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe o nome completo do eleitor.'
    if (!isTelefoneValido(form.telefone))
      novosErros.telefone = 'Telefone inválido. Use (XX) XXXXX-XXXX.'
    if (!form.local_votacao.trim()) novosErros.local_votacao = 'Informe o local de votação.'
    if (!form.zona.trim()) novosErros.zona = 'Informe a zona eleitoral.'
    if (!form.secao.trim()) novosErros.secao = 'Informe a seção eleitoral.'
    if (!form.bairro.trim()) novosErros.bairro = 'Informe o bairro.'
    if (!form.cidade) novosErros.cidade = 'Selecione a cidade.'
    if (!form.cabo_id) novosErros.cabo_id = 'Selecione quem indicou o eleitor.'
    if (!consentimento)
      novosErros.consentimento = 'É necessário aceitar o uso dos dados para concluir o cadastro.'

    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErros({})
    if (!validar()) {
      // Faz scroll até o primeiro campo com erro
      const primeiroErro = Object.keys(erros)[0]
      const el = document.getElementsByName(primeiroErro)[0]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setEnviando(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone,
      local_votacao: form.local_votacao.trim(),
      zona: Number(form.zona),
      secao: Number(form.secao),
      bairro: form.bairro.trim(),
      cidade: form.cidade,
      endereco: form.endereco.trim() || null,
      data_nascimento: form.data_nascimento || null,
      cpf: form.cpf || null,
      titulo_eleitor: form.titulo_eleitor || null,
      cabo_id: form.cabo_id || null,
      observacoes: form.observacoes.trim() || null,
      status: 'ativo',
      website, // honeypot: humanos deixam vazio
      campanha_slug: campanhaSlug,
    }

    if (!navigator.onLine) {
      await saveToOfflineQueue(payload)
      window.dispatchEvent(new Event('gv_queue_updated'))
      setEnviando(false)
      setSucesso(true)
      return
    }

    try {
      await api.createEleitor(payload as any)
    } catch (err) {
      setEnviando(false)
      setErros({ global: 'Erro ao cadastrar: ' + (err as Error).message })
      return
    }
    setEnviando(false)
    setSucesso(true)
  }

  function novoCadastro() {
    setForm({ ...VAZIO, cabo_id: caboEncontrado?.id || '' })
    setConsentimento(false)
    setSucesso(false)
    setErros({})
  }

  return (
    <div className="flex min-h-[100dvh] min-h-safe items-start justify-center bg-slate-50 py-6 pb-safe pt-safe sm:py-12 sm:px-4">
      <div className="w-full max-w-lg overflow-hidden sm:rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border-x border-y sm:border border-slate-200 dark:border-slate-800">
        
        {/* Cover Image & Avatar */}
        <div className="relative h-32 w-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-700 sm:h-40">
          {campanha?.foto_url && (
            <img src={resolverFotoUrl(campanha.foto_url)!} alt="Capa" className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay" />
          )}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-10 left-6">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {campanha?.foto_url ? (
                <img src={resolverFotoUrl(campanha.foto_url)!} alt="Candidato" className="h-full w-full object-cover" />
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
          
          {caboEncontrado && !sucesso ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50">
              <img 
                src={resolverFotoUrl(caboEncontrado.foto_url, `https://ui-avatars.com/api/?name=${encodeURIComponent(caboEncontrado.nome)}&background=random`)!} 
                alt={caboEncontrado.nome} 
                className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-800" 
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(caboEncontrado.nome)}&background=random`;
                }}
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Indicado por liderança</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{caboEncontrado.nome}</p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {sucesso
                ? 'Os dados foram registrados com sucesso.'
                : 'Preencha seus dados para fazer parte do projeto.'}
            </p>
          )}
        </div>

        {sucesso ? (
          <div className="px-6 py-10 text-center">
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {navigator.onLine 
                ? 'Obrigado! O eleitor foi adicionado à base da campanha.'
                : 'Você está offline! Seus dados foram salvos e serão sincronizados automaticamente quando houver conexão com a internet.'}
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
            className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto px-6 py-6"
          >
            {/* Honeypot anti-robô */}
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
              <Campo label="Nome completo" obrigatorio erro={erros.nome}>
                <input
                  type="text"
                  name="nome"
                  value={form.nome}
                  onChange={(e) => atualizar('nome', e.target.value)}
                  className={`${inputClass} ${erros.nome ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  placeholder="Ex.: José da Silva"
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Telefone / WhatsApp" obrigatorio erro={erros.telefone}>
                  <input
                    type="tel"
                    name="telefone"
                    inputMode="numeric"
                    value={form.telefone}
                    onChange={(e) => atualizar('telefone', maskTelefone(e.target.value))}
                    className={`${inputClass} ${erros.telefone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    placeholder="(11) 91234-5678"
                  />
                </Campo>
                <Campo label="Data de Nascimento (Opcional)" erro={erros.data_nascimento}>
                  <input
                    type="date"
                    name="data_nascimento"
                    value={form.data_nascimento}
                    onChange={(e) => atualizar('data_nascimento', e.target.value)}
                    className={inputClass}
                  />
                </Campo>
              </div>
              <Campo label="CEP" erro={erros.cep}>
                <div className="relative">
                  <input
                    type="tel"
                    name="cep"
                    value={form.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className={inputClass}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {cepBuscando ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    </div>
                  ) : form.cep.length === 9 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                </div>
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="CPF (Opcional)" erro={erros.cpf}>
                  <input
                    type="tel"
                    name="cpf"
                    value={form.cpf}
                    onChange={(e) => atualizar('cpf', maskCpf(e.target.value))}
                    className={inputClass}
                    placeholder="000.000.000-00"
                  />
                </Campo>
                <Campo label="Título de Eleitor (Opcional)" erro={erros.titulo_eleitor}>
                  <input
                    type="tel"
                    name="titulo_eleitor"
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
              <Campo label="Local de votação" obrigatorio erro={erros.local_votacao}>
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
                  className={`${inputClass} ${erros.local_votacao ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Zona" obrigatorio erro={erros.zona}>
                  <input
                    type="number"
                    name="zona"
                    min={1}
                    value={form.zona}
                    onChange={(e) => atualizar('zona', e.target.value)}
                    className={`${inputClass} ${erros.zona ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  />
                </Campo>
                <Campo label="Seção" obrigatorio erro={erros.secao}>
                  <input
                    type="number"
                    name="secao"
                    min={1}
                    value={form.secao}
                    onChange={(e) => atualizar('secao', e.target.value)}
                    className={`${inputClass} ${erros.secao ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  />
                </Campo>
              </div>
              {secaoCheck.estado === 'checando' && (
                <p className="-mt-2 text-xs font-medium text-slate-400">Conferindo zona/seção…</p>
              )}
              {secaoCheck.estado === 'valida' && (
                <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Zona/seção confere{secaoCheck.cidade ? ` · ${secaoCheck.cidade}` : ''}
                </p>
              )}
              {secaoCheck.estado === 'invalida' && (
                <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500">
                  <AlertCircle className="h-3.5 w-3.5" /> Zona/seção não encontrada em PE — confira no título de eleitor.
                </p>
              )}
              <Campo label="Endereço (Rua e Número)" erro={erros.endereco}>
                <input
                  type="text"
                  name="endereco"
                  value={form.endereco}
                  onChange={(e) => atualizar('endereco', e.target.value)}
                  className={`${inputClass} ${erros.endereco ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  placeholder="Ex.: Rua Quinze de Novembro, 123"
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Bairro" obrigatorio erro={erros.bairro}>
                  <input
                    type="text"
                    name="bairro"
                    list="lista-bairros"
                    value={form.bairro}
                    onChange={(e) => atualizar('bairro', e.target.value)}
                    className={`${inputClass} ${erros.bairro ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    placeholder="Ex.: Centro"
                  />
                  <datalist id="lista-bairros">
                    {bairros.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </Campo>
                <Campo label="Cidade" obrigatorio erro={erros.cidade}>
                  <select
                    name="cidade"
                    value={form.cidade}
                    onChange={(e) => atualizar('cidade', e.target.value)}
                    className={`${inputClass} ${erros.cidade ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
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

            {/* Seção: indicação */}
            <Secao titulo="Indicação">
              <Campo label="Quem indicou este eleitor?" obrigatorio erro={erros.cabo_id}>
                <select
                  name="cabo_id"
                  value={form.cabo_id}
                  onChange={(e) => atualizar('cabo_id', e.target.value)}
                  className={`${inputClass} ${erros.cabo_id ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
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
              <Campo label="Observações" erro={erros.observacoes}>
                <textarea
                  name="observacoes"
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
                className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 ${erros.consentimento ? 'border-red-500 ring-red-500/20 ring-1' : ''}`}
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
            {erros.consentimento && (
              <p className="text-xs font-bold text-red-500">{erros.consentimento}</p>
            )}

            {erros.global && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{erros.global}</span>
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
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm sm:py-2 font-medium outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}

interface CampoProps {
  label: string
  obrigatorio?: boolean
  erro?: string
  children: React.ReactNode
}

function Campo({
  label,
  obrigatorio,
  erro,
  children,
}: CampoProps) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {obrigatorio && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {erro && (
        <span className="mt-1 block text-xs font-bold text-red-500 flex items-center gap-1 animate-slide-up">
          <AlertCircle className="h-3 w-3" />
          <span>{erro}</span>
        </span>
      )}
    </div>
  )
}
