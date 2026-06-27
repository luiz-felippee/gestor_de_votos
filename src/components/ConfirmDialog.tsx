import { useState, createContext, useContext, useCallback, type ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  isAlert?: boolean
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (message: string, title?: string) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider')
  }
  return context
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        open: true,
        options,
        resolve,
      })
    })
  }, [])

  const alert = useCallback((message: string, title = 'Aviso') => {
    return new Promise<void>((resolve) => {
      setDialogState({
        open: true,
        options: { message, title, isAlert: true, confirmText: 'Entendido' },
        resolve: () => resolve(),
      })
    })
  }, [])

  const handleClose = (value: boolean) => {
    if (dialogState) {
      dialogState.resolve(value)
      setDialogState(null)
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {dialogState?.open && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800 animate-slide-up sm:animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            {dialogState.options.title && (
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {dialogState.options.title}
              </h3>
            )}
            <p className="mt-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {dialogState.options.message}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="inline-flex w-full justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-98 transition-all"
              >
                {dialogState.options.confirmText || 'Confirmar'}
              </button>
              {!dialogState.options.isAlert && (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 active:scale-98 transition-all"
                >
                  {dialogState.options.cancelText || 'Cancelar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
