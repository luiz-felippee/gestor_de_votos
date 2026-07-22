import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { useAuth } from '../auth/AuthContext'
import { formatDataHora } from '../lib/format'
import { compressImage } from '../lib/imageOptimization'
import { useConfirm } from '../components/ConfirmDialog'
import type { Campanha } from '../lib/types'

interface FormState {
  nome: string
  admin_nome: string
  admin_email: string
  admin_senha: string
  foto_url: string
  trajetoria: string
  cor: string
  cargo_ultima_eleicao: string
  ano_ultima_eleicao: string
  votos_ultima_eleicao: string
}

// Só os campos editáveis depois que a campanha já existe — sem credenciais de
// admin, que só são definidas na criação (a rota PUT nem aceita isso).
interface EditFormState {
  nome: string
  foto_url: string
  trajetoria: string
  cor: string
  cargo_ultima_eleicao: string
  ano_ultima_eleicao: string
  votos_ultima_eleicao: string
}

const COR_PADRAO = '#4f46e5'
const VAZIO: FormState = { nome: '', admin_nome: '', admin_email: '', admin_senha: '', foto_url: '', trajetoria: '', cor: COR_PADRAO, cargo_ultima_eleicao: '', ano_ultima_eleicao: '', votos_ultima_eleicao: '' }
const EDIT_VAZIO: EditFormState = { nome: '', foto_url: '', trajetoria: '', cor: COR_PADRAO, cargo_ultima_eleicao: '', ano_ultima_eleicao: '', votos_ultima_eleicao: '' }

export function CampanhasPage() {
  const { usuario } = useAuth()
  const { confirm, alert } = useConfirm()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(VAZIO)
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Edição de campanha existente
  const [editando, setEditando] = useState<Campanha | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(EDIT_VAZIO)
  const [arquivoFotoEdit, setArquivoFotoEdit] = useState<File | null>(null)
  const [erroEdit, setErroEdit] = useState<string | null>(null)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  async function recarregar() {
    try {
      setCampanhas(await api.getCampanhas())
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [])

  function set<K extends keyof FormState>(c: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [c]: v }))
  }

  function setEdit<K extends keyof EditFormState>(c: K, v: EditFormState[K]) {
    setEditForm((f) => ({ ...f, [c]: v }))
  }

  function abrirEdicao(c: Campanha) {
    setEditando(c)
    setErroEdit(null)
    setArquivoFotoEdit(null)
    setEditForm({
      nome: c.nome,
      foto_url: c.foto_url ?? '',
      trajetoria: c.trajetoria ?? '',
      cor: c.cor || COR_PADRAO,
      cargo_ultima_eleicao: c.cargo_ultima_eleicao ?? '',
      ano_ultima_eleicao: c.ano_ultima_eleicao ?? '',
      votos_ultima_eleicao: c.votos_ultima_eleicao != null ? String(c.votos_ultima_eleicao) : '',
    })
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault()
    if (!editando) return
    setErroEdit(null)
    if (!editForm.nome.trim()) return setErroEdit('Informe o nome da campanha.')
    if (!editForm.trajetoria.trim()) return setErroEdit('Informe a trajetória completa do candidato.')

    setSalvandoEdit(true)
    try {
      let fotoUrl = editForm.foto_url.trim() || undefined
      if (arquivoFotoEdit) {
        const compressed = await compressImage(arquivoFotoEdit)
        const { url } = await api.uploadArquivo(compressed)
        fotoUrl = url
      }

      await api.updateCampanha(editando.id, {
        nome: editForm.nome.trim(),
        foto_url: fotoUrl,
        trajetoria: editForm.trajetoria.trim(),
        cor: editForm.cor,
        cargo_ultima_eleicao: editForm.cargo_ultima_eleicao.trim() || undefined,
        ano_ultima_eleicao: editForm.ano_ultima_eleicao.trim() || undefined,
        votos_ultima_eleicao: editForm.votos_ultima_eleicao ? Number(editForm.votos_ultima_eleicao) : undefined,
      })
      setEditando(null)
      await recarregar()
    } catch (err) {
      setErroEdit((err as Error).message)
    } finally {
      setSalvandoEdit(false)
    }
  }

  async function excluir(c: Campanha) {
    const ok = await confirm({
      title: 'Excluir Campanha?',
      message: `EXCLUIR a campanha "${c.nome}" e TODOS os dados dela (${c.total_eleitores ?? 0} eleitores)? Esta ação é permanente e não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Voltar',
    })
    if (!ok) return

    try {
      await api.deleteCampanha(c.id)
      await recarregar()
    } catch (err) {
      alert(`Erro ao excluir: ${(err as Error).message}`, 'Erro')
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)
    if (!form.nome.trim()) return setErro('Informe o nome da campanha.')
    if (!arquivoFoto && !form.foto_url.trim()) return setErro('A foto do candidato é obrigatória.')
    if (!form.trajetoria.trim()) return setErro('Informe a trajetória completa do candidato.')
    if (!form.admin_email.trim() || !form.admin_senha)
      return setErro('Informe o e-mail e a senha do administrador da campanha.')

    setSalvando(true)
    try {
      // Se o usuário escolheu um arquivo, comprime e faz upload antes de salvar.
      let fotoUrl = form.foto_url.trim() || undefined
      if (arquivoFoto) {
        const compressed = await compressImage(arquivoFoto)
        const { url } = await api.uploadArquivo(compressed)
        fotoUrl = url
      }

      await api.createCampanha({
        nome: form.nome.trim(),
        admin_nome: form.admin_nome.trim() || undefined,
        admin_email: form.admin_email.trim(),
        admin_senha: form.admin_senha,
        foto_url: fotoUrl,
        trajetoria: form.trajetoria.trim(),
        cor: form.cor || undefined,
        cargo_ultima_eleicao: form.cargo_ultima_eleicao.trim() || undefined,
        ano_ultima_eleicao: form.ano_ultima_eleicao.trim() || undefined,
        votos_ultima_eleicao: form.votos_ultima_eleicao ? Number(form.votos_ultima_eleicao) : undefined,
      })
      setSucesso(
        `Campanha "${form.nome.trim()}" criada! O candidato já pode entrar com ${form.admin_email.trim()}.`,
      )
      setForm(VAZIO)
      setArquivoFoto(null)
      await recarregar()
    } catch (err) {
      setErro(`Erro: ${(err as Error).message}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Campanhas
      </h1>
      <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
        Cada campanha é um candidato isolado — vê apenas os próprios dados. Crie a
        campanha e o login do administrador dela aqui.
      </p>

      {/* Formulário de nova campanha */}
      <form
        onSubmit={salvar}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-5 text-lg font-bold text-slate-800 dark:text-slate-100">
          Nova campanha (candidato)
        </h2>
        {/* Foto do candidato (upload) */}
        <div className="mb-4 flex items-center gap-4">
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
            <Campo label="Foto do Candidato">
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
                      if (form.foto_url) set('foto_url', '')
                    }}
                    className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors whitespace-nowrap"
                  >
                    Excluir foto
                  </button>
                )}
              </div>
            </Campo>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome da campanha / candidato *">
            <input className={inputClass} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </Campo>
          <Campo label="Cargo na Última Eleição">
            <input className={inputClass} value={form.cargo_ultima_eleicao} onChange={(e) => set('cargo_ultima_eleicao', e.target.value)} placeholder="Ex: Vereador, Deputado..." />
          </Campo>
          <Campo label="Ano da Última Eleição">
            <input className={inputClass} value={form.ano_ultima_eleicao} onChange={(e) => set('ano_ultima_eleicao', e.target.value)} placeholder="Ex: 2020" />
          </Campo>
          <Campo label="Quantidade de Votos na Última">
            <input type="number" className={inputClass} value={form.votos_ultima_eleicao} onChange={(e) => set('votos_ultima_eleicao', e.target.value)} />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Trajetória do Candidato *">
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={form.trajetoria}
              onChange={(e) => set('trajetoria', e.target.value)}
              placeholder="Descreva a trajetória, história e propostas do candidato..."
            />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Cor da campanha">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.cor}
                onChange={(e) => set('cor', e.target.value)}
                className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Usada só na página pública de cadastro do candidato (/c/{'{slug}'}).
              </span>
            </div>
          </Campo>
        </div>

        <h3 className="mt-6 mb-3 text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 dark:border-slate-800">
          Dados de Acesso (Administrador)
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Nome do administrador">
            <input className={inputClass} value={form.admin_nome} onChange={(e) => set('admin_nome', e.target.value)} placeholder="Opcional" />
          </Campo>
          <Campo label="E-mail de login *">
            <input type="email" className={inputClass} value={form.admin_email} onChange={(e) => set('admin_email', e.target.value)} />
          </Campo>
          <Campo label="Senha inicial *">
            <input type="text" className={inputClass} value={form.admin_senha} onChange={(e) => set('admin_senha', e.target.value)} />
          </Campo>
        </div>

        {erro && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            {sucesso}
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {salvando ? 'Criando...' : 'Criar campanha'}
        </button>
      </form>

      {/* Lista */}
      {/* Cards no mobile */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-slate-400">Carregando...</p>
        ) : campanhas.length === 0 ? (
          <p className="py-8 text-center text-slate-400">Nenhuma campanha ainda.</p>
        ) : (
          campanhas.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {c.nome}
                  {c.id === usuario?.campanha_id && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-brand-500">a sua</span>
                  )}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Editar
                  </button>
                  {c.id !== usuario?.campanha_id && (
                    <button
                      onClick={() => excluir(c)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition active:scale-95 dark:bg-red-900/20 dark:text-red-400"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  <strong className="text-brand-600 dark:text-brand-400">{c.total_eleitores ?? 0}</strong> eleitores
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-200">{c.total_usuarios ?? 0}</strong> usuários
                </span>
              </div>
              <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
                Criada em {formatDataHora(c.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Tabela no desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Campanha</th>
              <th className="px-4 py-3">Eleitores</th>
              <th className="px-4 py-3">Usuários</th>
              <th className="px-4 py-3">Criada em</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Carregando...</td></tr>
            ) : campanhas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nenhuma campanha ainda.</td></tr>
            ) : (
              campanhas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                    {c.nome}
                    {c.id === usuario?.campanha_id && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-brand-500">a sua</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-brand-600 dark:text-brand-400">{c.total_eleitores ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.total_usuarios ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDataHora(c.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="font-medium text-slate-600 hover:underline dark:text-slate-300"
                      >
                        Editar
                      </button>
                      {c.id !== usuario?.campanha_id && (
                        <button
                          onClick={() => excluir(c)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">Editar campanha</h3>
              <button
                onClick={() => setEditando(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={salvarEdicao} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {arquivoFotoEdit ? (
                    <img src={URL.createObjectURL(arquivoFotoEdit)} alt="Preview" className="h-full w-full object-cover" />
                  ) : editForm.foto_url ? (
                    <img src={resolverFotoUrl(editForm.foto_url)!} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Campo label="Foto do Candidato">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setArquivoFotoEdit(e.target.files?.[0] || null)}
                      className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-400 dark:file:bg-brand-900/30 dark:file:text-brand-400"
                    />
                  </Campo>
                </div>
              </div>

              <Campo label="Nome da campanha / candidato *">
                <input className={inputClass} value={editForm.nome} onChange={(e) => setEdit('nome', e.target.value)} />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Cargo na Última Eleição">
                  <input className={inputClass} value={editForm.cargo_ultima_eleicao} onChange={(e) => setEdit('cargo_ultima_eleicao', e.target.value)} placeholder="Ex: Vereador, Deputado..." />
                </Campo>
                <Campo label="Ano da Última Eleição">
                  <input className={inputClass} value={editForm.ano_ultima_eleicao} onChange={(e) => setEdit('ano_ultima_eleicao', e.target.value)} placeholder="Ex: 2020" />
                </Campo>
              </div>
              <Campo label="Quantidade de Votos na Última">
                <input type="number" className={inputClass} value={editForm.votos_ultima_eleicao} onChange={(e) => setEdit('votos_ultima_eleicao', e.target.value)} />
              </Campo>

              <Campo label="Trajetória do Candidato *">
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={editForm.trajetoria}
                  onChange={(e) => setEdit('trajetoria', e.target.value)}
                />
              </Campo>

              <Campo label="Cor da campanha">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editForm.cor}
                    onChange={(e) => setEdit('cor', e.target.value)}
                    className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Usada só na página pública de cadastro do candidato.
                  </span>
                </div>
              </Campo>

              {erroEdit && (
                <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {erroEdit}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdit}
                  className="flex-1 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {salvandoEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  )
}
