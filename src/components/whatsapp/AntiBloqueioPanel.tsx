import { Shield, ShieldCheck } from 'lucide-react'
import type { AntiBloqueioConfig } from '../../lib/antiBloqueio'

interface Props {
  config: AntiBloqueioConfig
  onChange: (c: AntiBloqueioConfig) => void
  contadorHoje: number
}

/**
 * Painel de configuração do Modo Anti-Bloqueio. Controla intervalos, limite
 * diário, pausa em lote, janela de horário e validação de número.
 */
export function AntiBloqueioPanel({ config, onChange, contadorHoje }: Props) {
  const set = (patch: Partial<AntiBloqueioConfig>) => onChange({ ...config, ...patch })

  const numInput =
    'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
  const label = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
          {config.ativo ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Shield className="h-5 w-5 text-slate-400" />
          )}
          Modo Anti-Bloqueio
        </h2>
        <button
          onClick={() => set({ ativo: !config.ativo })}
          role="switch"
          aria-checked={config.ativo}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            config.ativo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              config.ativo ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {config.ativo ? (
        <>
          <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            Enviadas hoje: <span className="font-extrabold">{contadorHoje}</span> / {config.limiteDiario}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-800/50">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (contadorHoje / Math.max(1, config.limiteDiario)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Intervalo mín. (s)</label>
              <input
                type="number"
                min={3}
                value={config.delayMinSeg}
                onChange={(e) => set({ delayMinSeg: Number(e.target.value) })}
                className={numInput}
              />
            </div>
            <div>
              <label className={label}>Intervalo máx. (s)</label>
              <input
                type="number"
                min={config.delayMinSeg}
                value={config.delayMaxSeg}
                onChange={(e) => set({ delayMaxSeg: Number(e.target.value) })}
                className={numInput}
              />
            </div>
            <div>
              <label className={label}>Limite por dia</label>
              <input
                type="number"
                min={1}
                value={config.limiteDiario}
                onChange={(e) => set({ limiteDiario: Number(e.target.value) })}
                className={numInput}
              />
            </div>
            <div>
              <label className={label}>Pausar a cada</label>
              <input
                type="number"
                min={0}
                value={config.lotePausaCada}
                onChange={(e) => set({ lotePausaCada: Number(e.target.value) })}
                className={numInput}
              />
            </div>
            <div>
              <label className={label}>Pausa do lote (s)</label>
              <input
                type="number"
                min={10}
                value={config.lotePausaSeg}
                onChange={(e) => set({ lotePausaSeg: Number(e.target.value) })}
                className={numInput}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Início</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={config.horarioInicio}
                  onChange={(e) => set({ horarioInicio: Number(e.target.value) })}
                  className={numInput}
                />
              </div>
              <div>
                <label className={label}>Fim</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={config.horarioFim}
                  onChange={(e) => set({ horarioFim: Number(e.target.value) })}
                  className={numInput}
                />
              </div>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <input
              type="checkbox"
              checked={config.validarNumero}
              onChange={(e) => set({ validarNumero: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Validar se o número existe no WhatsApp antes de enviar
            </span>
          </label>
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Recomendado manter ligado. Sem proteção, o envio em massa pode banir seu número.
        </p>
      )}
    </div>
  )
}
