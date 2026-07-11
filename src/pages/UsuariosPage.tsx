import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useCabos } from '../hooks/useCabos'
import { useAuth } from '../auth/AuthContext'
import { Eye, EyeOff } from 'lucide-react'
import { useConfirm } from '../components/ConfirmDialog'
import type { PerfilAcesso, UsuarioAdmin } from '../lib/types'

const PERFIS: { value: PerfilAcesso; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'cabo', label: 'Cabo eleitoral' },
  { value: 'visualizador', label: 'Visualizador' },
]

const ROLE_LABEL: Record<PerfilAcesso, string> = {
  admin: 'Administrador',
  coordenador: 'Coordenador',
  cabo: 'Cabo eleitoral',
  visualizador: 'Visualizador',
}

interface FormState {
  nome: string
  email: string
  senha: string
  role: PerfilAcesso
  cabo_id: string
}

const VAZIO: FormState = {
  nome: '',
  email: '',
  senha: '',
  role: 'visualizador',
  cabo_id: '',
}

export function UsuariosPage() {
  const { cabos } = useCabos()
  const { usuario: atual } = useAuth()
  const { confirm, alert } = useConfirm()

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(VAZIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function recarregar() {
    try {
      setUsuarios(await api.getUsuarios())
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [])

  function atualizar<K extends keyof FormState>(c: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [c]: v }))
  }

  function editar(u: UsuarioAdmin) {
    setEditId(u.id)
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      role: u.role,
      cabo_id: u.cabo_id ?? '',
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
    if (!form.nome.trim()) return setErro('Informe o nome.')
    if (!form.email.trim()) return setErro('Informe o e-mail.')
    if (!editId && !form.senha) return setErro('Defina uma senha inicial.')
    if (form.role === 'cabo' && !form.cabo_id)
      return setErro('Selecione o cabo vinculado a este usuário.')

    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      role: form.role,
      cabo_id: form.role === 'cabo' ? form.cabo_id : null,
      ...(form.senha ? { senha: form.senha } : {}),
    }
    try {
      if (editId) await api.updateUsuario(editId, payload)
      else await api.createUsuario(payload)
      await recarregar()
    } catch (err) {
      setSalvando(false)
      setErro(`Erro ao salvar: ${(err as Error).message}`)
      return
    }
    setSalvando(false)
    cancelar()
  }

  async function excluir(u: UsuarioAdmin) {
    const ok = await confirm({
      title: 'Excluir Usuário?',
      message: `Tem certeza que deseja remover o acesso de "${u.nome}" (${u.email})?`,
      confirmText: 'Excluir',
      cancelText: 'Voltar',
    })
    if (!ok) return

    try {
      await api.deleteUsuario(u.id)
      await recarregar()
    } catch (err) {
      alert(`Erro ao excluir: ${(err as Error).message}`, 'Erro')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Gestão de Usuários
      </h1>
      <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
        Cadastre os acessos da equipe e defina o perfil de cada um.
      </p>

      {/* Formulário */}
      <form
        onSubmit={salvar}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-5 text-lg font-bold text-slate-800 dark:text-slate-100">
          {editId ? 'Editar usuário' : 'Novo usuário'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome completo">
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => atualizar('nome', e.target.value)}
            />
          </Campo>
          <Campo label="E-mail (login)">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => atualizar('email', e.target.value)}
            />
          </Campo>
          <Campo label={editId ? 'Nova senha (deixe em branco p/ manter)' : 'Senha inicial'}>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                className={`${inputClass} pr-10`}
                value={form.senha}
                onChange={(e) => atualizar('senha', e.target.value)}
                placeholder={editId ? '••••••••' : ''}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Campo>
          <Campo label="Perfil de acesso">
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => atualizar('role', e.target.value as PerfilAcesso)}
            >
              {PERFIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Campo>
          {form.role === 'cabo' && (
            <Campo label="Cabo vinculado">
              <select
                className={inputClass}
                value={form.cabo_id}
                onChange={(e) => atualizar('cabo_id', e.target.value)}
              >
                <option value="">Selecione...</option>
                {cabos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>

        {erro && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {erro}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Adicionar usuário'}
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

      {/* Lista — Cards no mobile */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-slate-400">Carregando...</p>
        ) : usuarios.length === 0 ? (
          <p className="py-8 text-center text-slate-400">Nenhum usuário cadastrado.</p>
        ) : (
          usuarios.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800 dark:text-slate-100">
                    {u.nome}
                    {u.id === atual?.id && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-brand-500">você</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{u.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {ROLE_LABEL[u.role]}
                </span>
              </div>
              {u.cabo?.nome && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cabo: {u.cabo.nome}</p>
              )}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => editar(u)}
                  className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-bold text-slate-700 transition active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                >
                  Editar
                </button>
                {u.id !== atual?.id && (
                  <button
                    onClick={() => excluir(u)}
                    className="flex-1 rounded-lg bg-red-50 py-2 text-sm font-bold text-red-600 transition active:scale-95 dark:bg-red-900/20 dark:text-red-400"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lista — Tabela no desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Cabo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {u.nome}
                    {u.id === atual?.id && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-brand-500">
                        você
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.cabo?.nome ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() => editar(u)}
                      className="mr-3 font-medium text-brand-600 hover:underline"
                    >
                      Editar
                    </button>
                    {u.id !== atual?.id && (
                      <button
                        onClick={() => excluir(u)}
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
