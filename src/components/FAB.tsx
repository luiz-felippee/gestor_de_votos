import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { vibrar } from '../lib/haptics'

/**
 * Botão de ação flutuante (FAB) para a ação principal de uma lista no mobile.
 * Fica acima da barra de navegação inferior e só aparece no celular (lg:hidden).
 */
export function FAB({
  onClick,
  label = 'Adicionar',
  icon,
}: {
  onClick: () => void
  label?: string
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        vibrar()
        onClick()
      }}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 74px)' }}
      className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-90 hover:bg-brand-700 lg:hidden"
    >
      {icon ?? <Plus className="h-7 w-7" />}
    </button>
  )
}
