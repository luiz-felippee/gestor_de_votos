import { useState } from "react"
import { useEventos } from "../hooks/useEventos"
import { useEleitores } from "../hooks/useEleitores"
import { api } from "../lib/api"
import { formatDataHora } from "../lib/format"
import { BulkWhatsAppModal } from "../components/BulkWhatsAppModal"
import type { Evento, EleitorComCabo } from "../lib/types"

export function EventosPage() {
  const { eventos, loading, recarregar } = useEventos()
  const { eleitores } = useEleitores()
  
  const [showModal, setShowModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Evento>>({})
  
  const [showBulkMessage, setShowBulkMessage] = useState(false)
  const [bulkEleitores, setBulkEleitores] = useState<EleitorComCabo[]>([])

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
      alert((err as Error).message)
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return
    try {
      await api.deleteEvento(id)
      recarregar()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  function handleConvidarBairro(evento: Evento) {
    if (!evento.bairro) {
      alert("Este evento não tem um bairro definido para filtrar eleitores.")
      return
    }
    const alvos = eleitores.filter(el => el.bairro === evento.bairro)
    if (alvos.length === 0) {
      alert("Nenhum eleitor encontrado neste bairro.")
      return
    }
    setBulkEleitores(alvos)
    setShowBulkMessage(true)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">Agenda de Reuniões</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie eventos e envie convites por bairro.</p>
        </div>
        <button
          onClick={() => { setEditForm({}); setShowModal(true) }}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition"
        >
          + Novo Evento
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando eventos...</p>
      ) : eventos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-slate-500 font-medium">Nenhum evento agendado.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map(ev => (
            <div key={ev.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between dark:bg-slate-900 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{ev.titulo}</h3>
                <p className="text-sm text-brand-600 font-semibold mb-3">{formatDataHora(ev.data_hora)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2"><span className="font-semibold">Local:</span> {ev.local}</p>
                {(ev.bairro || ev.cidade) && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{ev.bairro} {ev.cidade && `- ${ev.cidade}`}</p>
                )}
                {ev.descricao && <p className="text-sm text-slate-500 mt-3 border-t pt-3 dark:border-slate-800">{ev.descricao}</p>}
              </div>
              
              <div className="mt-5 flex gap-2 border-t pt-4 border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleConvidarBairro(ev)}
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-2 rounded-lg text-sm transition dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                >
                  Convidar Bairro
                </button>
                <button
                  onClick={() => { setEditForm(ev); setShowModal(true) }}
                  className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleExcluir(ev.id)}
                  className="px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">{editForm.id ? "Editar Evento" : "Novo Evento"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSalvar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Título</label>
                <input required value={editForm.titulo || ""} onChange={e => setEditForm({...editForm, titulo: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data e Hora</label>
                <input required type="datetime-local" value={editForm.data_hora ? new Date(editForm.data_hora).toISOString().slice(0, 16) : ""} onChange={e => setEditForm({...editForm, data_hora: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Localização</label>
                <input required value={editForm.local || ""} onChange={e => setEditForm({...editForm, local: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Bairro (Para convites)</label>
                  <input value={editForm.bairro || ""} onChange={e => setEditForm({...editForm, bairro: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                  <input value={editForm.cidade || ""} onChange={e => setEditForm({...editForm, cidade: e.target.value})} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea value={editForm.descricao || ""} onChange={e => setEditForm({...editForm, descricao: e.target.value})} rows={3} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-slate-600 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkMessage && (
        <BulkWhatsAppModal
          eleitores={bulkEleitores}
          onClose={() => setShowBulkMessage(false)}
          onSuccess={() => setShowBulkMessage(false)}
        />
      )}
    </div>
  )
}
