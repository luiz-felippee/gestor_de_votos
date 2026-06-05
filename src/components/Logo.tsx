import { useState } from 'react'

export function Logo({ className = "h-9 w-auto", iconClassName = "h-9 w-9" }: { className?: string, iconClassName?: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30 ${iconClassName}`}>
        <svg className="w-1/2 h-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }

  return (
    <img 
      src="/logo.png" 
      alt="Logo da Campanha" 
      className={`object-contain ${className}`}
      onError={() => setError(true)}
    />
  )
}
