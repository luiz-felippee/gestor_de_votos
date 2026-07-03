import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
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
  cargo_ultima_eleicao: string
  ano_ultima_eleicao: string
  votos_ultima_eleicao: string
}

const VAZIO: FormState = { nome: '', admin_nome: '', admin_email: '', admin_senha: '', foto_url: '', cargo_ultima_eleicao: '', ano_ultima_eleicao: '', votos_ultima_eleicao: '' }

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
              <img src={form.foto_url.startsWith('http') ? form.foto_url : `${api.base}${form.foto_url}`} alt="Preview" className="h-full w-full object-cover" />
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                    {c.id !== usuario?.campanha_id && (
                      <button
                        onClick={() => excluir(c)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
