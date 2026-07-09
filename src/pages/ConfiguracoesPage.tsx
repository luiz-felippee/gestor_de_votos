import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Image as ImageIcon, Check, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

export function ConfiguracoesPage() {
  const queryClient = useQueryClient()
  const [imgbbKey, setImgbbKey] = useState('')

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: api.getConfiguracoes,
  })

  const salvar = useMutation({
    mutationFn: () => api.saveConfiguracoes({ imgbb_key: imgbbKey.trim() }),
    onSuccess: () => {
      toast.success('Configuração salva! As próximas fotos vão para o ImgBB.')
      setImgbbKey('')
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
    },
    onError: (e: any) => toast.error(e.message || 'Falha ao salvar.'),
  })

  const configuradoPorEnv = config?.imgbb_key_via_env
  const jaConfigurado = config?.imgbb_key_set

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-brand-100 p-3 dark:bg-brand-900/30">
          <Settings className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Configurações</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ajustes gerais do sistema</p>
        </div>
      </div>

      {/* Storage de imagens (ImgBB) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
            <ImageIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Armazenamento de Fotos (ImgBB)
          </h2>
          {jaConfigurado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              Não configurado
            </span>
          )}
        </div>

        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Com o ImgBB configurado, as fotos enviadas viram um link permanente e leve — em vez de
          ficarem salvas dentro do banco de dados (o que deixa o sistema pesado).
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : configuradoPorEnv ? (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            A chave está definida por variável de ambiente no servidor. Nada a fazer aqui.
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Chave de API do ImgBB
            </label>
            <input
              type="password"
              value={imgbbKey}
              onChange={(e) => setImgbbKey(e.target.value)}
              placeholder={jaConfigurado ? '•••••••• (deixe em branco para manter)' : 'Cole aqui sua chave do ImgBB'}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || !imgbbKey.trim()}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {salvar.isPending ? 'Salvando...' : 'Salvar chave'}
              </button>
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Gerar chave grátis <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-400">
              É gratuito: entre em api.imgbb.com, faça login e clique em "Get API Key". Cole o código aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
