import { useMemo, useState, type FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { useCabos } from '../hooks/useCabos'
import { useEleitores } from '../hooks/useEleitores'
import { CIDADES } from '../lib/constants'
import { maskTelefone } from '../lib/format'
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
}

export function CabosPage() {
  const { cabos, loading, recarregar } = useCabos()
  const { eleitores } = useEleitores()

  const [form, setForm] = useState<FormState>(VAZIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Total de eleitores cadastrados por cabo (realizado).
  const realizadoPorCabo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of eleitores) {
      if (e.cabo_id) mapa.set(e.cabo_id, (mapa.get(e.cabo_id) ?? 0) + 1)
    }
    return mapa
  }, [eleitores])

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
    })
    setErro(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setEditId(null)
    setForm(VAZIO)
    setErro(null)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!form.nome.trim()) return setErro('Informe o nome do cabo.')
    if (!form.telefone.trim()) return setErro('Informe o telefone.')

    setSalvando(true)
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

  async function excluir(c: CaboEleitoral) {
    if (
      !confirm(
        `Excluir o cabo "${c.nome}"? Os eleitores vinculados ficarão sem cabo.`,
      )
    )
      return
    try {
      await api.deleteCabo(c.id)
      recarregar()
    } catch (err) {
      alert(`Erro ao excluir: ${(err as Error).message}`)
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
        
        {/* Link Público para Lideranças */}
        <LinkPublicoLideranca />
      </div>

      {/* Formulário de criação/edição */}
      <form
        onSubmit={salvar}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-5 text-lg font-bold text-slate-800 dark:text-slate-100">
          {editId ? 'Editar cabo' : 'Novo cabo'}
        </h2>
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
          {editId && (
            <button
              type="button"
              onClick={cancelar}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Lista de cabos */}
      {loading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : cabos.length === 0 ? (
        <p className="text-slate-400">Nenhum cabo cadastrado ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cabos.map((c) => (
            <CardCabo
              key={c.id}
              cabo={c}
              realizado={realizadoPorCabo.get(c.id) ?? 0}
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
  onEditar,
  onExcluir,
}: {
  cabo: CaboEleitoral
  realizado: number
  onEditar: () => void
  onExcluir: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [mostrarQR, setMostrarQR] = useState(false)
  const link = `${window.location.origin}/cadastro?cabo=${cabo.id}`
  const meta = cabo.meta_eleitores || 0
  const pct = meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : 0
  const qrId = `qr-${cabo.id}`

  const iniciais = cabo.nome
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert(link)
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
            {/* Avatar */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-bold text-white shadow-inner">
              {iniciais}
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
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {cabo.telefone}
                </span>
              </div>
            </div>
          </div>
          
          {/* Ações (Editar / Excluir) */}
          <div className="flex shrink-0 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 sm:opacity-100">
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
        <div className="flex items-center gap-2">
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
