import { useState } from 'react'

export function Logo({ className = "h-9 w-auto", iconClassName = "h-9 w-9" }: { className?: string, iconClassName?: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30 ${iconClassName}`}>
        <svg className="w-1/2 h-1/2" viewBox="0 0 512 512" fill="none">
          <rect x="136" y="220" width="240" height="180" rx="20" stroke="white" strokeWidth="24" strokeLinejoin="round"/>
          <rect x="206" y="210" width="100" height="16" rx="8" fill="white"/>
          <path d="M136 260 L136 230 Q136 200 166 200 L346 200 Q376 200 376 230 L376 260" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="216" y="100" width="80" height="110" rx="6" fill="white" transform="rotate(-15 256 155)"/>
          <path d="M240 145 L253 158 L275 130" stroke="#4f46e5" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-15 256 145)"/>
        </svg>
      </div>
    )
  }

  return (
    <img
      src="/icon-192.png?v=2"
      alt="Gestor de Votos"
      className={`object-contain rounded-xl shadow-md ${className}`}
      onError={() => setError(true)}
    />
  )
}

