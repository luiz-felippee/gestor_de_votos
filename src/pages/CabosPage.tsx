import { useMemo, useState, type FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Link as LinkIcon, CheckCircle2, MessageCircle, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { useCabos } from '../hooks/useCabos'
import { CIDADES } from '../lib/constants'
import { maskTelefone, generateSlug } from '../lib/format'
import { compressImage } from '../lib/imageOptimization'
import { useConfirm } from '../components/ConfirmDialog'
import { CardSkeleton } from '../components/Skeleton'
import type { CaboEleitoral } from '../lib/types'

interface FormState {
  nome: string
  telefone: string
  bairro_atuacao: string
  cidade: string
  meta_eleitores: string
  data_nascimento: string
  foi_candidato: boolean
  cargo_candidato: string
  ano_eleicao: string
  votacao: string
  foto_url: string
}

const VAZIO: FormState = {
  nome: '',
  telefone: '',
  bairro_atuacao: '',
  cidade: '',
  meta_eleitores: '',
  data_nascimento: '',
  foi_candidato: false,
  cargo_candidato: '',
  ano_eleicao: '',
  votacao: '',
  foto_url: '',
}

export function CabosPage() {
  const { cabos, loading, recarregar } = useCabos()
  const { confirm, alert } = useConfirm()

  const [form, setForm] = useState<FormState>(VAZIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)
  const [ordenacao, setOrdenacao] = useState<'nome' | 'ranking'>('ranking')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const cabosOrdenados = useMemo(() => {
    const comRealizado = cabos.map(c => ({
      ...c,
      realizado: c._count?.eleitores ?? 0
    }))
    
    if (ordenacao === 'ranking') {
      return comRealizado.sort((a, b) => b.realizado - a.realizado)
    }
    
    // ordenação por nome
    return comRealizado.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [cabos, ordenacao])

  function atualizar<K extends keyof FormState>(c: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [c]: v }))
  }

  function editar(c: CaboEleitoral) {
    setEditId(c.id)
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      bairro_atuacao: c.bairro_atuacao ?? '',
      cidade: c.cidade ?? '',
      meta_eleitores: String(c.meta_eleitores ?? 0),
      data_nascimento: c.data_nascimento || '',
      foi_candidato: c.foi_candidato ?? false,
      cargo_candidato: c.cargo_candidato ?? '',
      ano_eleicao: c.ano_eleicao ?? '',
      votacao: c.votacao ? String(c.votacao) : '',
      foto_url: c.foto_url ?? '',
    })
    setArquivoFoto(null)
    setErro(null)
    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setEditId(null)
    setForm(VAZIO)
    setArquivoFoto(null)
    setErro(null)
    setIsFormOpen(false)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!form.nome.trim()) return setErro('Informe o nome do cabo.')
    if (!form.telefone.trim()) return setErro('Informe o telefone.')
    if (!form.foto_url && !arquivoFoto) return setErro('A foto da liderança é obrigatória.')

    setSalvando(true)
    let finalFotoUrl = form.foto_url

    if (arquivoFoto) {
      try {
        const compressed = await compressImage(arquivoFoto)
        const { url } = await api.uploadArquivo(compressed)
        finalFotoUrl = url
      } catch (err) {
        setSalvando(false)
        setErro(`Erro ao enviar foto: ${(err as Error).message}`)
        return
      }
    }
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone,
      bairro_atuacao: form.bairro_atuacao.trim(),
      cidade: form.cidade,
      data_nascimento: form.data_nascimento || null,
      meta_eleitores: Number(form.meta_eleitores) || 0,
      foi_candidato: form.foi_candidato,
      cargo_candidato: form.foi_candidato ? form.cargo_candidato : undefined,
      ano_eleicao: form.foi_candidato ? form.ano_eleicao : undefined,
      votacao: form.foi_candidato && form.votacao ? Number(form.votacao) : undefined,
      foto_url: finalFotoUrl,
    }

    try {
      if (editId) {
        await api.updateCabo(editId, payload)
      } else {
        await api.createCabo(payload)
      }
      recarregar()
    } catch (err) {
      setSalvando(false)
      setErro(`Erro ao salvar: ${(err as Error).message}`)
      return
    }
    setSalvando(false)
    cancelar()
  }

  async function excluir(c: CaboEleitoral & { realizado?: number }) {
    const ok = await confirm({
      title: 'Excluir Liderança?',
      message: `Tem certeza que deseja excluir a liderança "${c.nome}"?`,
      confirmText: 'Excluir',
      cancelText: 'Voltar',
    })
    if (!ok) return

    const totalEleitores = c.realizado ?? c._count?.eleitores ?? 0
    let excluirEleitores = false

    if (totalEleitores > 0) {
      excluirEleitores = await confirm({
        title: 'Excluir Eleitores Vinculados?',
        message: `Esta liderança possui ${totalEleitores} eleitor(es) cadastrado(s). Deseja excluir TODOS estes eleitores também (removendo-os do sistema e do mapa de calor) ou mantê-los no sistema sem vinculação?`,
        confirmText: 'Excluir Eleitores',
        cancelText: 'Manter Eleitores',
      })
    }

    try {
      await api.deleteCabo(c.id, excluirEleitores)
      recarregar()
      toast.success(
        excluirEleitores
          ? `Liderança "${c.nome}" e seus eleitores foram excluídos com sucesso.`
          : `Liderança "${c.nome}" excluída com sucesso. Os eleitores foram mantidos.`
      )
    } catch (err) {
      alert(`Erro ao excluir: ${(err as Error).message}`, 'Erro')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Gestão de Liderança
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Cadastre cabos, defina metas e compartilhe o link personalizado de cadastro.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Link Público para Lideranças */}
          <LinkPublicoLideranca />

          <button
            onClick={() => {
              if (isFormOpen) {
                cancelar()
              } else {
                setForm(VAZIO)
                setEditId(null)
                setArquivoFoto(null)
                setErro(null)
                setIsFormOpen(true)
              }
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition active:scale-95 sm:py-2.5 h-full ${
              isFormOpen
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {isFormOpen ? (
              <>
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="whitespace-nowrap">Fechar Formulário</span>
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">Cadastrar Liderança</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Formulário de criação/edição */}
      {isFormOpen && (
        <form
        onSubmit={salvar}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {editId ? 'Editar cabo' : 'Novo cabo'}
          </h2>
          <button
            type="button"
            onClick={cancelar}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            {arquivoFoto ? (
              <img src={URL.createObjectURL(arquivoFoto)} alt="Preview" className="h-full w-full object-cover" />
            ) : form.foto_url ? (
              <img src={resolverFotoUrl(form.foto_url)!} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <Campo label="Foto da Liderança (Obrigatório)">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  key={arquivoFoto ? arquivoFoto.name : (form.foto_url || 'empty')}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivoFoto(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-400 dark:file:bg-brand-900/30 dark:file:text-brand-400"
                />
                {(arquivoFoto || form.foto_url) && (
                  <button
                    type="button"
                    onClick={() => {
                      setArquivoFoto(null)
                      if (form.foto_url) atualizar('foto_url', '')
                    }}
                    className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors whitespace-nowrap"
                  >
                    Excluir foto
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">Envie uma foto clara do rosto (JPG ou PNG).</p>
            </Campo>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome completo">
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => atualizar('nome', e.target.value)}
            />
          </Campo>
          <Campo label="Telefone / WhatsApp">
            <input
              className={inputClass}
              value={form.telefone}
              onChange={(e) => atualizar('telefone', maskTelefone(e.target.value))}
              placeholder="(11) 91234-5678"
            />
          </Campo>
          <Campo label="Bairro de atuação">
            <input
              className={inputClass}
              value={form.bairro_atuacao}
              onChange={(e) => atualizar('bairro_atuacao', e.target.value)}
            />
          </Campo>
          <Campo label="Cidade">
            <select
              className={inputClass}
              value={form.cidade}
              onChange={(e) => atualizar('cidade', e.target.value)}
            >
              <option value="">Selecione...</option>
              {CIDADES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Meta de eleitores">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.meta_eleitores}
              onChange={(e) => atualizar('meta_eleitores', e.target.value)}
            />
          </Campo>
          <Campo label="Data de Nascimento (Opcional)">
            <input
              type="date"
              className={inputClass}
              value={form.data_nascimento}
              onChange={(e) => atualizar('data_nascimento', e.target.value)}
            />
          </Campo>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={form.foi_candidato}
              onChange={(e) => atualizar('foi_candidato', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Já foi candidato(a)?
          </label>

          {form.foi_candidato && (
            <div className="grid gap-4 sm:grid-cols-3 animate-fade-in">
              <Campo label="Qual cargo?">
                <input
                  type="text"
                  className={inputClass}
                  value={form.cargo_candidato}
                  onChange={(e) => atualizar('cargo_candidato', e.target.value)}
                  placeholder="Ex.: Vereador"
                />
              </Campo>
              <Campo label="Ano da Eleição">
                <input
                  type="text"
                  className={inputClass}
                  value={form.ano_eleicao}
                  onChange={(e) => atualizar('ano_eleicao', e.target.value)}
                  placeholder="Ex.: 2020"
                  maxLength={4}
                />
              </Campo>
              <Campo label="Quantidade de Votos">
                <input
                  type="number"
                  className={inputClass}
                  value={form.votacao}
                  onChange={(e) => atualizar('votacao', e.target.value)}
                  placeholder="Votos recebidos"
                />
              </Campo>
            </div>
          )}
        </div>

        {erro && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {erro}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Adicionar cabo'}
          </button>
          <button
            type="button"
            onClick={cancelar}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </form>
      )}

      {/* Lista de cabos */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Lideranças Cadastradas ({cabos.length})
        </h2>
        
        {cabos.length > 0 && (
          <div className="flex w-full sm:w-auto items-center gap-2 text-sm font-medium">
            <span className="text-slate-500 whitespace-nowrap">Organizar por:</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as 'nome' | 'ranking')}
              className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="ranking">🏆 Mais Eleitores (Ranking)</option>
              <option value="nome">🔤 Ordem Alfabética</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : cabos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800 text-slate-400 mb-4 animate-bounce">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Nenhuma liderança cadastrada</h3>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            Adicione os cabos eleitorais e coordenadores para que eles possam indicar eleitores e atingir suas metas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cabosOrdenados.map((c, i) => (
            <CardCabo
              key={c.id}
              cabo={c}
              realizado={c.realizado}
              posicaoRanking={ordenacao === 'ranking' ? i + 1 : undefined}
              onEditar={() => editar(c)}
              onExcluir={() => excluir(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CardCabo({
  cabo,
  realizado,
  posicaoRanking,
  onEditar,
  onExcluir,
}: {
  cabo: CaboEleitoral
  realizado: number
  posicaoRanking?: number
  onEditar: () => void
  onExcluir: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [mostrarQR, setMostrarQR] = useState(false)
  const { usuario } = useAuth()
  const { alert } = useConfirm()
  
  // Cria a url amigavel: dominio.com/c/nome-campanha/joao-silva
  const slugLideranca = generateSlug(cabo.nome)
  const slugCampanha = usuario?.campanha_slug || 'gestor'
  const link = `${window.location.origin}/c/${slugCampanha}/${slugLideranca}`
  
  const meta = cabo.meta_eleitores || 0
  const pct = meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : 0
  const qrId = `qr-${cabo.id}`

  async function copiar() {
    const mensagem = `Faça seu cadastro com a liderança *${cabo.nome}* para apoiar *${usuario?.campanha_nome || 'nossa campanha'}*!\n\nAcesse o link:\n${link}`
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert(link, 'Link de Indicação')
    }
  }

  function baixarQR() {
    const canvas = document.getElementById(qrId) as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qrcode-${cabo.nome.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300/80 dark:border-slate-800/60 dark:bg-slate-900/50 dark:hover:border-slate-700/80">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar & Ranking */}
            <div className="relative">
              <img 
                src={resolverFotoUrl(cabo.foto_url, `https://ui-avatars.com/api/?name=${encodeURIComponent(cabo.nome)}&background=random`)!}
                alt={cabo.nome} 
                className="h-11 w-11 shrink-0 rounded-full object-cover shadow-inner ring-2 ring-white dark:ring-slate-800" 
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(cabo.nome)}&background=random`;
                }}
              />
              {posicaoRanking !== undefined && (
                <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm text-[10px] font-black ${
                  posicaoRanking === 1 ? 'bg-yellow-400 text-yellow-900' :
                  posicaoRanking === 2 ? 'bg-slate-300 text-slate-800' :
                  posicaoRanking === 3 ? 'bg-amber-600 text-white' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                } dark:border-slate-900`}>
                  {posicaoRanking}
                </div>
              )}
            </div>
            <div>
              <h3 className="flex items-center flex-wrap gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                <span className="line-clamp-1">{cabo.nome}</span>
                {cabo.foi_candidato && (
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">
                    {cabo.cargo_candidato || 'Candidato(a)'} {cabo.ano_eleicao && `(${cabo.ano_eleicao})`}
                    {cabo.votacao ? ` - ${cabo.votacao} votos` : ''}
                  </span>
                )}
              </h3>
              <div className="mt-0.5 flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 group/phone">
                  <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {cabo.telefone}
                  <a 
                    href={`https://wa.me/55${cabo.telefone.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    title="Conversar no WhatsApp"
                    className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 opacity-0 group-hover/phone:opacity-100 transition-opacity ml-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                </span>
              </div>
            </div>
          </div>
          
          {/* Ações (Editar / Excluir) */}
          <div className="flex shrink-0 gap-1.5 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button 
              onClick={onEditar} 
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
              title="Editar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button 
              onClick={onExcluir} 
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title="Excluir"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>

        {/* Localização Badge */}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="truncate">{[cabo.bairro_atuacao, cabo.cidade].filter(Boolean).join(' · ') || 'Sem região definida'}</span>
        </div>

        {/* Meta vs realizado */}
        <div className="mt-6 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
          <div className="mb-2 flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Progresso</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {realizado} <span className="text-xs font-semibold text-slate-400">/ {meta || '—'} eleitores</span>
              </span>
            </div>
            <span className={`text-sm font-bold ${pct >= 100 ? 'text-green-500' : 'text-brand-500'}`}>
              {meta > 0 ? `${pct}%` : 'sem meta'}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-700/50">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${
                pct >= 100 
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                  : 'bg-gradient-to-r from-brand-400 to-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer com Ações de Link e QR */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/30">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 group/input">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 opacity-40">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <input
              readOnly
              value={link}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full cursor-pointer truncate rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-500 outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-400/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
            />
          </div>
          
          <button
            onClick={copiar}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
              copiado
                ? 'bg-green-50 text-green-600 ring-1 ring-inset ring-green-500/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
            }`}
          >
            {copiado ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Copiado
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copiar
              </>
            )}
          </button>
          
          <button
            onClick={() => setMostrarQR((v) => !v)}
            className={`flex shrink-0 items-center justify-center rounded-lg px-2.5 py-2 transition-all active:scale-95 ${
              mostrarQR
                ? 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-400 dark:ring-brand-500/30'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
            }`}
            title="QR Code"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        {mostrarQR && (
          <div className="mt-4 flex animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-inner dark:border-slate-800/80 dark:bg-slate-950">
            <div className="rounded-xl border border-slate-100 p-2 shadow-sm dark:border-slate-800">
              <QRCodeCanvas id={qrId} value={link} size={150} includeMargin />
            </div>
            <button
              onClick={baixarQR}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Baixar PNG
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/50'

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  )
}

function LinkPublicoLideranca() {
  const [copiado, setCopiado] = useState(false)
  const linkBase = `${window.location.origin}/cadastro-lideranca`

  const copiarLink = () => {
    navigator.clipboard.writeText(linkBase)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 shadow-sm dark:border-brand-900/30 dark:bg-brand-900/20">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-800">
        <LinkIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
          Link Público
        </p>
        <p className="text-sm font-medium text-brand-900 dark:text-brand-100">
          Convide novas lideranças
        </p>
      </div>
      <button
        type="button"
        onClick={copiarLink}
        className={`ml-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold shadow-sm transition-all ${
          copiado
            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
            : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {copiado ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="hidden sm:inline">{copiado ? 'Copiado!' : 'Copiar Link'}</span>
      </button>
    </div>
  )
}
