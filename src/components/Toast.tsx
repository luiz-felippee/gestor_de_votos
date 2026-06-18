import { useState, useCallback, useEffect, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

let nextId = 0

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type }])
    // Auto-remove após 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Container de toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const STYLES: Record<ToastType, string> = {
  success:
    'bg-green-600 text-white shadow-lg shadow-green-500/20',
  error:
    'bg-red-600 text-white shadow-lg shadow-red-500/20',
  info:
    'bg-blue-600 text-white shadow-lg shadow-blue-500/20',
  warning:
    'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setShow(true))
  }, [])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all duration-300 ease-out cursor-pointer ${
        STYLES[toast.type]
      } ${show ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
      onClick={onClose}
      role="alert"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
        {ICONS[toast.type]}
      </span>
      <span>{toast.message}</span>
    </div>
  )
}
