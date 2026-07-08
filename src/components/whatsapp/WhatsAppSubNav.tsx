import { NavLink } from 'react-router-dom'
import { Send, Network } from 'lucide-react'

/**
 * Navegação segmentada que integra as duas telas de relacionamento por WhatsApp:
 * a Central de Disparos (/whatsapp) e o Funil CRM (/funil). Ambas compartilham a
 * mesma conexão com a Evolution API.
 */
export function WhatsAppSubNav() {
  const base =
    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all'
  const cls = ({ isActive }: { isActive: boolean }) =>
    `${base} ${
      isActive
        ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
    }`

  return (
    <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
      <NavLink to="/whatsapp" className={cls} end>
        <Send className="h-4 w-4" /> Disparos
      </NavLink>
      <NavLink to="/funil" className={cls}>
        <Network className="h-4 w-4" /> Funil CRM
      </NavLink>
    </div>
  )
}
