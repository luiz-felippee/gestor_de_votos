import { useState, type FormEvent } from 'react'
import { CheckCircle2, Users } from 'lucide-react'
import { api } from '../lib/api'
import { CIDADES } from '../lib/constants'
import { maskTelefone, isTelefoneValido } from '../lib/format'

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
  const [form, setForm] = useState<FormState>(VAZIO)
  const [website, setWebsite] = useState('') // honeypot (anti-robô)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)

  function atualizar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function validar(): string | null {
    if (!form.nome.trim()) return 'Informe seu nome completo.'
    if (!isTelefoneValido(form.telefone))
      return 'Telefone inválido. Use (XX) XXXXX-XXXX.'
    if (!arquivoFoto) return 'A foto da liderança é obrigatória.'
    if (!form.bairro_atuacao.trim()) return 'Informe o bairro onde atua.'
    if (!form.cidade) return 'Selecione sua cidade.'
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const problema = validar()
    if (problema) return setErro(problema)

    setEnviando(true)
    try {
      const { url } = await api.uploadArquivo(arquivoFoto!)
      await api.createCaboPublic({
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
    setForm(VAZIO)
    setArquivoFoto(null)
    setSucesso(false)
  }

  return (
    <div className="flex min-h-[100dvh] items-start justify-center bg-slate-50 py-6 sm:py-12 sm:px-4">
      <div className="w-full max-w-lg overflow-hidden sm:rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border-x border-y sm:border border-slate-200 dark:border-slate-800">
        
        {/* Cover Image & Avatar */}
        <div className="relative h-32 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 sm:h-40">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-10 left-6">
            <div className="flex h-20 w-20 overflow-hidden items-center justify-center rounded-2xl border-4 border-white bg-white shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {arquivoFoto ? (
                <img src={URL.createObjectURL(arquivoFoto)} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-10 w-10 text-teal-600 dark:text-teal-400" />
              )}
            </div>
          </div>
        </div>

        {/* Cabeçalho do modal */}
        <div className="px-6 pb-6 pt-12">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {sucesso ? 'Cadastro recebido!' : 'Seja uma Liderança'}
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
              Obrigado! Seu perfil de liderança foi criado. Em breve a equipe entrará em contato ou você já pode começar a indicar eleitores usando seu link personalizado que a coordenação vai te mandar.
            </p>
            <button
              onClick={novoCadastro}
              className="w-full rounded-lg bg-teal-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-teal-700"
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
              <Campo label="Sua Foto" obrigatorio>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivoFoto(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-teal-700 hover:file:bg-teal-100 dark:text-slate-400 dark:file:bg-teal-900/30 dark:file:text-teal-400"
                />
              </Campo>
              <Campo label="Nome completo" obrigatorio>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => atualizar('nome', e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: João Silva"
                />
              </Campo>
              <Campo label="WhatsApp / Telefone" obrigatorio>
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
            </Secao>

            <Secao titulo="Local de Atuação">
              <Campo label="Bairro Principal" obrigatorio>
                <input
                  type="text"
                  value={form.bairro_atuacao}
                  onChange={(e) => atualizar('bairro_atuacao', e.target.value)}
                  className={inputClass}
                  placeholder="Bairro onde atua forte"
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

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-teal-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
            >
              {enviando ? 'Enviando...' : 'Quero ser Liderança'}
            </button>
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
