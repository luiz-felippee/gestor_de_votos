import { useMemo, useState, type FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
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
}

const VAZIO: FormState = {
  nome: '',
  telefone: '',
  bairro_atuacao: '',
  cidade: '',
  meta_eleitores: '',
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
      bairro_atuacao: form.bairro_atuacao.trim() || null,
      cidade: form.cidade || null,
      meta_eleitores: Number(form.meta_eleitores) || 0,
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
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Gestão de Liderança
      </h1>
      <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
        Cadastre cabos, defina metas e compartilhe o link personalizado de
        cadastro.
      </p>

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

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{cabo.nome}</h3>
          <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">{cabo.telefone}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {[cabo.bairro_atuacao, cabo.cidade].filter(Boolean).join(' · ') ||
              'Sem região definida'}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={onEditar} className="text-brand-600 hover:underline">
            Editar
          </button>
          <button onClick={onExcluir} className="text-red-600 hover:underline">
            Excluir
          </button>
        </div>
      </div>

      {/* Meta vs realizado */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>
            {realizado} / {meta || '—'} eleitores
          </span>
          <span>{meta > 0 ? `${pct}%` : 'sem meta'}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Link personalizado */}
      <div className="mt-5 flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
        />
        <button
          onClick={copiar}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {copiado ? 'Copiado!' : 'Copiar link'}
        </button>
        <button
          onClick={() => setMostrarQR((v) => !v)}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {mostrarQR ? 'Ocultar QR' : 'QR Code'}
        </button>
      </div>

      {/* QR Code do link do cabo */}
      {mostrarQR && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <QRCodeCanvas id={qrId} value={link} size={160} includeMargin />
          <button
            onClick={baixarQR}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            Baixar QR Code (PNG)
          </button>
        </div>
      )}
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
