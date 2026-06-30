import { useState, useEffect, type FormEvent } from 'react'
import { CheckCircle2, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { CIDADES } from '../lib/constants'
import { maskTelefone, isTelefoneValido, generateSlug } from '../lib/format'
import { compressImage } from '../lib/imageOptimization'
import { useConfirm } from '../components/ConfirmDialog'
import { toast } from 'sonner'
import type { Campanha } from '../lib/types'

interface FormState {
  nome: string
  telefone: string
  bairro_atuacao: string
  cidade: string
  data_nascimento: string
  foi_candidato: boolean
  cargo_candidato: string
  ano_eleicao: string
  votacao: string
}

const VAZIO: FormState = {
  nome: '',
  telefone: '',
  bairro_atuacao: '',
  cidade: '',
  data_nascimento: '',
  foi_candidato: false,
  cargo_candidato: '',
  ano_eleicao: '',
  votacao: '',
}

export function CadastroLiderancaPage() {
  const { campanhaSlug } = useParams() // Rota: /c/:campanhaSlug/cadastro-lideranca
  const { alert } = useConfirm()
  const [form, setForm] = useState<FormState>(VAZIO)
  const [website, setWebsite] = useState('') // honeypot (anti-robô)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({})
  const [sucesso, setSucesso] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)

  // Busca dados públicos da campanha
  const [campanha, setCampanha] = useState<Partial<Campanha> | null>(null)
  useEffect(() => {
    if (campanhaSlug) {
      api.getCampanhaPublic(campanhaSlug).then(setCampanha).catch(() => {})
    }
  }, [campanhaSlug])

  function atualizar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function validar(): boolean {
    const novosErros: Record<string, string> = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe seu nome completo.'
    if (!isTelefoneValido(form.telefone))
      novosErros.telefone = 'Telefone inválido. Use (XX) XXXXX-XXXX.'
    if (!arquivoFoto) novosErros.foto = 'A foto da liderança é obrigatória.'
    if (!form.bairro_atuacao.trim()) novosErros.bairro_atuacao = 'Informe o bairro onde atua.'
    if (!form.cidade) novosErros.cidade = 'Selecione sua cidade.'

    setErrosCampos(novosErros)

    if (Object.keys(novosErros).length > 0) {
      const primeiro = Object.keys(novosErros)[0]
      const el = document.getElementById(`campo-${primeiro}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }
    return true
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setErrosCampos({})
    if (!validar()) return

    setEnviando(true)
    try {
      const compressed = await compressImage(arquivoFoto!)
      const { url } = await api.uploadArquivo(compressed)
      const novoCabo = await api.createCaboPublic({
        nome: form.nome.trim(),
        telefone: form.telefone,
        bairro_atuacao: form.bairro_atuacao.trim(),
        cidade: form.cidade,
        data_nascimento: form.data_nascimento || null,
        foi_candidato: form.foi_candidato,
        cargo_candidato: form.foi_candidato ? form.cargo_candidato : undefined,
        ano_eleicao: form.foi_candidato ? form.ano_eleicao : undefined,
        votacao: form.foi_candidato && form.votacao ? Number(form.votacao) : undefined,
        foto_url: url,
        website, // honeypot
        campanha_slug: campanhaSlug, // Identifica para qual campanha vai este cabo
      })
      
      const slugLideranca = generateSlug(novoCabo.nome)
      const link = `${window.location.origin}/c/${campanhaSlug}/${slugLideranca}`
      setLinkGerado(link)
    } catch (err) {
      setEnviando(false)
      setErro('Erro ao cadastrar: ' + (err as Error).message)
      return
    }
    setEnviando(false)
    setSucesso(true)
    toast.success('Cadastro finalizado com sucesso!')
  }

  function novoCadastro() {
    setForm(VAZIO)
    setArquivoFoto(null)
    setSucesso(false)
    setLinkGerado(null)
  }

  return (
    <div className="flex min-h-[100dvh] min-h-safe items-start justify-center bg-slate-50 py-0 sm:py-12 px-0 sm:px-4">
      <div className="w-full max-w-lg overflow-hidden sm:rounded-2xl bg-white shadow-none sm:shadow-2xl dark:bg-slate-900 border-x-0 border-y-0 sm:border border-slate-200 dark:border-slate-800">
        
        {/* Cover Image & Avatar */}
        <div className="relative h-32 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 sm:h-40">
          {campanha?.foto_url && (
            <img src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} alt="Capa" className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay" />
          )}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-10 left-6">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {campanha?.foto_url ? (
                <img src={campanha.foto_url.startsWith('http') ? campanha.foto_url : `${api.base}${campanha.foto_url}`} alt="Candidato" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
          </div>
        </div>

        {/* Cabeçalho do modal */}
        <div className="px-6 pb-6 pt-12">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {sucesso ? 'Cadastro realizado!' : (campanha?.nome ? `Liderança: ${campanha.nome}` : 'Cadastro de Liderança')}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {sucesso
              ? 'Seus dados foram enviados para a coordenação.'
              : 'Preencha seus dados para fazer parte do time de lideranças da campanha.'}
          </p>
        </div>

        {sucesso ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mb-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              Obrigado! Seu perfil de liderança foi criado. Você já pode começar a indicar eleitores usando seu link exclusivo abaixo.
            </p>
            
            {linkGerado && (
              <div className="mb-8 overflow-hidden rounded-xl border border-teal-200 bg-teal-50 dark:border-teal-900/50 dark:bg-teal-900/20">
                <div className="px-4 py-3 bg-teal-100/50 dark:bg-teal-900/40 border-b border-teal-200 dark:border-teal-900/50">
                  <p className="text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wider text-left">
                    Seu Link de Indicação
                  </p>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={linkGerado}
                    className="flex-1 w-full truncate bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-lg py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-teal-500 focus:border-teal-500"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(linkGerado);
                        toast.success('Link copiado com sucesso!');
                      } catch {
                        alert(linkGerado, 'Copiar Link');
                      }
                    }}
                    className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={novoCadastro}
              className="w-full rounded-lg bg-slate-800 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Fazer outro cadastro
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
            <Secao titulo="Seus Dados">
              <Campo label="Sua Foto" obrigatorio error={errosCampos.foto}>
                <input
                  id="campo-foto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivoFoto(e.target.files?.[0] || null)}
                  className={`w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-teal-700 hover:file:bg-teal-100 dark:text-slate-400 dark:file:bg-teal-900/30 dark:file:text-teal-400`}
                />
              </Campo>
              <Campo label="Nome completo" obrigatorio error={errosCampos.nome}>
                <input
                  id="campo-nome"
                  type="text"
                  value={form.nome}
                  onChange={(e) => atualizar('nome', e.target.value)}
                  className={`${inputClass} ${errosCampos.nome ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Ex.: João Silva"
                />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="WhatsApp / Telefone" obrigatorio error={errosCampos.telefone}>
                  <input
                    id="campo-telefone"
                    type="tel"
                    inputMode="numeric"
                    value={form.telefone}
                    onChange={(e) => atualizar('telefone', maskTelefone(e.target.value))}
                    className={`${inputClass} ${errosCampos.telefone ? 'border-red-500 focus:ring-red-500' : ''}`}
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
              </div>
            </Secao>

            <Secao titulo="Local de Atuação">
              <Campo label="Bairro Principal" obrigatorio error={errosCampos.bairro_atuacao}>
                <input
                  id="campo-bairro_atuacao"
                  type="text"
                  value={form.bairro_atuacao}
                  onChange={(e) => atualizar('bairro_atuacao', e.target.value)}
                  className={`${inputClass} ${errosCampos.bairro_atuacao ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Bairro onde atua forte"
                />
              </Campo>
              <Campo label="Cidade" obrigatorio error={errosCampos.cidade}>
                <select
                  id="campo-cidade"
                  value={form.cidade}
                  onChange={(e) => atualizar('cidade', e.target.value)}
                  className={`${inputClass} ${errosCampos.cidade ? 'border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">Selecione...</option>
                  {CIDADES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Campo>
            </Secao>

            <Secao titulo="Histórico Político">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.foi_candidato}
                  onChange={(e) => atualizar('foi_candidato', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Já foi candidato(a) a algum cargo?
              </label>

              {form.foi_candidato && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
                  <Campo label="Qual cargo?">
                    <input
                      type="text"
                      value={form.cargo_candidato}
                      onChange={(e) => atualizar('cargo_candidato', e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: Vereador, Prefeito..."
                    />
                  </Campo>
                  <Campo label="Ano da Eleição">
                    <input
                      type="text"
                      value={form.ano_eleicao}
                      onChange={(e) => atualizar('ano_eleicao', e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: 2020"
                      maxLength={4}
                    />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Quantidade de Votos">
                      <input
                        type="number"
                        value={form.votacao}
                        onChange={(e) => atualizar('votacao', e.target.value)}
                        className={inputClass}
                        placeholder="Votos recebidos"
                      />
                    </Campo>
                  </div>
                </div>
              )}
            </Secao>

            {erro && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {erro}
              </div>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:static sm:mx-0 sm:mb-0 sm:mt-0 sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none">
              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-xl bg-teal-600 px-5 py-4 font-bold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] text-base"
              >
                {enviando ? 'Enviando...' : 'Quero ser Liderança'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}

function Campo({
  label,
  obrigatorio,
  error,
  children,
}: {
  label: string
  obrigatorio?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {obrigatorio && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-bold text-red-500">{error}</span>}
    </label>
  )
}
