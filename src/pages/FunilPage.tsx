import { useState } from 'react'
import { api } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Check, Plus, Trash2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { maskTelefone } from '../lib/format'
import { ConexaoEvolution } from '../components/whatsapp/ConexaoEvolution'
import { WhatsAppSubNav } from '../components/whatsapp/WhatsAppSubNav'
import { resolverSpintax } from '../lib/spintax'
import { segundosAleatorios } from '../lib/antiBloqueio'

export function FunilPage() {
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<'tarefas' | 'templates'>('tarefas')

  // -- Queries --
  const { data: tarefasData, isLoading: loadingTarefas } = useQuery({
    queryKey: ['funil-tarefas'],
    queryFn: api.getFunilTarefasHoje,
  })

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['funil-templates'],
    queryFn: api.getFunilTemplates,
  })

  // -- Mutations --
  const mutationAvancar = useMutation({
    mutationFn: ({ id, destino }: { id: string, destino: string }) => api.avancarFunil(id, destino),
    onSuccess: () => {
      toast.success('Contato registrado e eleitor movido no funil!')
      queryClient.invalidateQueries({ queryKey: ['funil-tarefas'] })
      queryClient.invalidateQueries({ queryKey: ['eleitores'] })
    }
  })

  const mutationCreateTemplate = useMutation({
    mutationFn: api.createFunilTemplate,
    onSuccess: () => {
      toast.success('Template criado!')
      queryClient.invalidateQueries({ queryKey: ['funil-templates'] })
    }
  })

  const mutationDeleteTemplate = useMutation({
    mutationFn: api.deleteFunilTemplate,
    onSuccess: () => {
      toast.success('Template removido!')
      queryClient.invalidateQueries({ queryKey: ['funil-templates'] })
    }
  })

  const mutationSend = useMutation({
    mutationFn: ({ numero, texto, delay }: { numero: string, texto: string, delay?: number }) => api.sendWhatsAppMessage(numero, texto, delay),
    onSuccess: () => {
      // toast de sucesso será tratado dentro do handler principal
    },
    onError: (err: any) => {
      toast.error(err.message || 'Falha ao enviar mensagem. O WhatsApp está conectado?')
    }
  })

  const handleEnviar = async (eleitor: any, template: any) => {
    const numero = `55${eleitor.telefone.replace(/\D/g, '')}`
    // Aplica variações (spintax) para reduzir o risco de bloqueio.
    const texto = resolverSpintax(template.texto_pronto)
    const delay = segundosAleatorios(2, 5) * 1000 // "digitando..." 2–5s

    // Tenta enviar via Evolution
    const loadingToast = toast.loading(`Enviando para ${eleitor.nome}...`)
    try {
      await mutationSend.mutateAsync({ numero, texto, delay })
      toast.success(`Mensagem enviada para ${eleitor.nome}!`, { id: loadingToast })
      
      // Se enviou com sucesso, avança a pessoa no funil
      mutationAvancar.mutate({ id: eleitor.id, destino: template.etapa_destino })
    } catch (e) {
      toast.dismiss(loadingToast)
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      <div className="bg-white px-6 py-6 border-b dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-lg dark:bg-emerald-900/30">
            <MessageCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Funil de Relacionamento (CRM)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Automatize o contato com seus eleitores através do WhatsApp
            </p>
          </div>
        </div>
      </div>

      <div className="border-b bg-white px-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex gap-6">
          <button
            onClick={() => setAba('tarefas')}
            className={`border-b-2 py-4 text-sm font-medium ${
              aba === 'tarefas'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Tarefas de Hoje
          </button>
          <button
            onClick={() => setAba('templates')}
            className={`border-b-2 py-4 text-sm font-medium ${
              aba === 'templates'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Configurar Regras
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto mb-6 space-y-4">
          <WhatsAppSubNav />
          <ConexaoEvolution compact />
        </div>
        {aba === 'tarefas' && (
          <div className="max-w-4xl mx-auto">
            {loadingTarefas ? (
              <p>Carregando tarefas...</p>
            ) : tarefasData?.tarefas.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <Check className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-800 dark:text-white">Funil Limpo!</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Você já enviou todas as mensagens agendadas para hoje.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tarefasData?.tarefas.map((tarefa, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-lg">{tarefa.eleitor.nome}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        Telefone: {maskTelefone(tarefa.eleitor.telefone)} • Etapa Atual: <span className="font-semibold">{tarefa.eleitor.etapa_funil}</span>
                      </p>
                      <div className="bg-slate-100 p-3 rounded-lg dark:bg-slate-700/50 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        "{tarefa.template.texto_pronto}"
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => handleEnviar(tarefa.eleitor, tarefa.template)}
                        className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        <MessageCircle className="h-5 w-5" />
                        Enviar Mensagem
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === 'templates' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Nova Regra de Funil</h3>
              <form 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  mutationCreateTemplate.mutate({
                    etapa_origem: fd.get('etapa_origem'),
                    etapa_destino: fd.get('etapa_destino'),
                    dias_espera: Number(fd.get('dias_espera')),
                    texto: fd.get('texto')
                  })
                  e.currentTarget.reset()
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Se a Etapa Atual for:</label>
                  <input required name="etapa_origem" placeholder="ex: novo" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mover para a Etapa:</label>
                  <input required name="etapa_destino" placeholder="ex: boas_vindas" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Esperar Quantos Dias? (0 = Hoje mesmo)</label>
                  <input required type="number" name="dias_espera" min="0" defaultValue="0" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Texto da Mensagem (use {'{nome}'} para personalizar)</label>
                  <textarea required name="texto" rows={4} placeholder="Olá {nome}, tudo bem?" className="w-full px-3 py-2 rounded border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white resize-none" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={mutationCreateTemplate.isPending} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Criar Regra
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Regras Cadastradas</h3>
              {loadingTemplates ? (
                <p>Carregando...</p>
              ) : templatesData?.templates.map((t: any) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold dark:bg-slate-700 dark:text-slate-300">{t.etapa_origem}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold dark:bg-emerald-900/50 dark:text-emerald-400">{t.etapa_destino}</span>
                      <span className="text-sm text-slate-500">• {t.dias_espera} dia(s)</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">"{t.texto}"</p>
                  </div>
                  <button onClick={() => mutationDeleteTemplate.mutate(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
