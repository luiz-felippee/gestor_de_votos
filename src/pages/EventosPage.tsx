import { useState } from "react"
import { Calendar, Plus } from "lucide-react"
import { useEventos } from "../hooks/useEventos"
import { api } from "../lib/api"
import { formatDataHora } from "../lib/format"
import { useConfirm } from "../components/ConfirmDialog"
import { CardSkeleton } from "../components/Skeleton"
import type { Evento } from "../lib/types"

export function EventosPage() {
  const { eventos, loading, recarregar } = useEventos()
  const { confirm, alert } = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Evento>>({})

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editForm.id) {
        await api.updateEvento(editForm.id, editForm)
      } else {
        await api.createEvento(editForm)
      }
      setShowModal(false)
      recarregar()
    } catch (err) {
      alert((err as Error).message, 'Erro ao Salvar')
    }
  }

  async function handleExcluir(id: string) {
    const ok = await confirm({
      title: 'Excluir Reunião?',
      message: 'Tem certeza que deseja remover este evento da agenda? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Voltar',
    })
    if (!ok) return

    try {
      await api.deleteEvento(id)
      recarregar()
    } catch (err) {
      alert((err as Error).message, 'Erro ao Excluir')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">Agenda de Reuniões</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os eventos e reuniões da campanha.</p>
        </div>
        <button
          onClick={() => { setEditForm({}); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition active:scale-98"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Evento</span>
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col items-center justify-center p-6">
          <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center dark:bg-slate-800/50">
            <Calendar className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-white">Nenhum evento agendado</h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Crie reuniões e eventos para engajar os coordenadores e cabos eleitorais.
          </p>
          <button
            onClick={() => { setEditForm({}); setShowModal(true) }}
            className="mt-5 text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Começar agendamento &rarr;
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map(ev => (
            <div key={ev.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between dark:bg-slate-900 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{ev.titulo}</h3>
                <p className="text-sm text-brand-600 font-semibold mb-3">{formatDataHora(ev.data_hora)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2"><span className="font-semibold text-slate-700 dark:text-slate-200">Local:</span> {ev.local}</p>
                {(ev.bairro || ev.cidade) && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{ev.bairro} {ev.cidade && `- ${ev.cidade}`}</p>
                )}
                {ev.descricao && <p className="text-sm text-slate-500 mt-3 border-t pt-3 dark:border-slate-800">{ev.descricao}</p>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t pt-4 border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => { setEditForm(ev); setShowModal(true) }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg py-2 font-bold text-sm transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleExcluir(ev.id)}
                  className="px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                  aria-label="Excluir evento"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">{editForm.id ? "Editar Evento" : "Novo Evento"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSalvar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Título</label>
                <input required value={editForm.titulo || ""} onChange={e => setEditForm({...editForm, titulo: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data e Hora</label>
                <input required type="datetime-local" value={editForm.data_hora ? new Date(editForm.data_hora).toISOString().slice(0, 16) : ""} onChange={e => setEditForm({...editForm, data_hora: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Localização</label>
                <input required value={editForm.local || ""} onChange={e => setEditForm({...editForm, local: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Bairro (Para convites)</label>
                  <input value={editForm.bairro || ""} onChange={e => setEditForm({...editForm, bairro: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                  <input value={editForm.cidade || ""} onChange={e => setEditForm({...editForm, cidade: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea value={editForm.descricao || ""} onChange={e => setEditForm({...editForm, descricao: e.target.value})} rows={3} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-slate-600 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
