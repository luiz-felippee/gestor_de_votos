import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Plus, Trash2, Edit2, X, CalendarClock } from 'lucide-react'

export function WhatsAppFunilPage() {
  const [funis, setFunis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [funilAberto, setFunilAberto] = useState<any | null>(null)
  
  // States para criação/edição de etapa
  const [etapaEditando, setEtapaEditando] = useState<any | null>(null)
  const [etapaForm, setEtapaForm] = useState({ dias_espera: 0, mensagem_texto: '' })

  useEffect(() => {
    carregarFunis()
  }, [])

  async function carregarFunis() {
    try {
      const data = await api.getFunis()
      setFunis(data)
      if (funilAberto) {
        const atualizado = data.find((f: any) => f.id === funilAberto.id)
        if (atualizado) setFunilAberto(atualizado)
      }
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function criarFunil() {
    try {
      const nome = prompt('Nome do novo Funil (ex: Boas-vindas):')
      if (!nome) return
      await api.createFunil({ nome, gatilho: 'novo_cadastro' })
      carregarFunis()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function toggleFunilAtivo(funil: any) {
    try {
      await api.updateFunil(funil.id, { ativo: !funil.ativo })
      carregarFunis()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function excluirFunil(id: string) {
    if (!confirm('Excluir este funil e todas as suas etapas?')) return
    try {
      await api.deleteFunil(id)
      if (funilAberto?.id === id) setFunilAberto(null)
      carregarFunis()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function salvarEtapa(e: React.FormEvent) {
    e.preventDefault()
    if (!funilAberto) return
    try {
      if (etapaEditando?.id) {
        await api.updateFunilEtapa(funilAberto.id, etapaEditando.id, etapaForm)
      } else {
        await api.createFunilEtapa(funilAberto.id, {
          ordem: funilAberto.etapas.length + 1,
          ...etapaForm
        })
      }
      setEtapaEditando(null)
      carregarFunis()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function excluirEtapa(etapa: any) {
    if (!confirm('Excluir esta mensagem?')) return
    try {
      await api.deleteFunilEtapa(funilAberto.id, etapa.id)
      carregarFunis()
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando funis...</div>

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <CalendarClock className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          Automações e Funis
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Crie sequências de mensagens de WhatsApp programadas (Drip Campaigns).
        </p>
      </div>

      {erro && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{erro}</div>}

      <div className="grid md:grid-cols-3 gap-6">
        {/* LISTA DE FUNIS */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">Seus Funis</h2>
            <button onClick={criarFunil} className="p-1.5 bg-brand-100 text-brand-600 rounded-md hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-400">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {funis.length === 0 && <p className="text-sm text-slate-500">Nenhum funil criado.</p>}
            {funis.map(f => (
              <div 
                key={f.id} 
                className={`p-4 rounded-xl border cursor-pointer transition ${funilAberto?.id === f.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800'}`}
                onClick={() => setFunilAberto(f)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{f.nome}</h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleFunilAtivo(f) }}
                    className={`px-2 py-1 rounded text-xs font-semibold ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {f.ativo ? 'Ativo' : 'Pausado'}
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>{f.etapas?.length || 0} mensagens</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); excluirFunil(f.id) }}
                    className="p-1 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DETALHES DO FUNIL / ETAPAS */}
        <div className="md:col-span-2">
          {funilAberto ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{funilAberto.nome}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Este funil é disparado automaticamente no <strong>{funilAberto.gatilho.replace('_', ' ')}</strong>.
                </p>
              </div>

              <div className="space-y-6">
                {funilAberto.etapas.map((etapa: any, idx: number) => (
                  <div key={etapa.id} className="relative flex gap-4">
                    {/* Linha vertical conectando os passos */}
                    {idx < funilAberto.etapas.length - 1 && (
                      <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-slate-200 dark:bg-slate-800"></div>
                    )}
                    
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-400 flex items-center justify-center font-bold relative z-10">
                      {idx + 1}
                    </div>
                    
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {etapa.dias_espera === 0 ? 'Envio Imediato' : `Esperar ${etapa.dias_espera} dia(s)`}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => { setEtapaEditando(etapa); setEtapaForm({ dias_espera: etapa.dias_espera, mensagem_texto: etapa.mensagem_texto }) }} className="text-slate-400 hover:text-brand-500"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => excluirEtapa(etapa)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{etapa.mensagem_texto}</p>
                    </div>
                  </div>
                ))}

                {/* FORMULÁRIO DE NOVA / EDITAR ETAPA */}
                {etapaEditando !== null ? (
                  <form onSubmit={salvarEtapa} className="bg-brand-50 dark:bg-brand-900/10 p-5 rounded-xl border border-brand-200 dark:border-brand-900 mt-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-brand-800 dark:text-brand-300">
                        {etapaEditando.id ? 'Editar Mensagem' : 'Nova Mensagem na Sequência'}
                      </h4>
                      <button type="button" onClick={() => setEtapaEditando(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                    </div>

                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dias de Espera</span>
                        <p className="text-xs text-slate-500 mb-1">Quantos dias aguardar após o passo anterior (0 para enviar no mesmo dia).</p>
                        <input 
                          type="number" 
                          min="0"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:bg-slate-900 dark:border-slate-700" 
                          value={etapaForm.dias_espera}
                          onChange={e => setEtapaForm(prev => ({...prev, dias_espera: Number(e.target.value)}))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mensagem</span>
                        <textarea 
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:bg-slate-900 dark:border-slate-700" 
                          value={etapaForm.mensagem_texto}
                          onChange={e => setEtapaForm(prev => ({...prev, mensagem_texto: e.target.value}))}
                          placeholder="Olá {{nome}}! ..."
                          required
                        />
                      </label>
                      
                      <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-sm">
                        {etapaEditando.id ? 'Salvar Alterações' : 'Adicionar ao Funil'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button 
                    onClick={() => { setEtapaEditando({}); setEtapaForm({ dias_espera: funilAberto.etapas.length === 0 ? 0 : 1, mensagem_texto: '' }) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 text-slate-500 hover:border-brand-500 hover:text-brand-600 transition"
                  >
                    <Plus className="w-5 h-5" /> Adicionar Mensagem
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 p-8 text-center">
              <div>
                <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Selecione um funil na lista ou crie um novo para gerenciar as automações.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
