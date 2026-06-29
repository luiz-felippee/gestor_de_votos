// Logo desenhado em SVG (urna), preenchendo todo o quadrado azul — sem a
// margem transparente do PNG. `iconClassName` controla o tamanho do ícone.
export function Logo({ iconClassName = "h-11 w-11" }: { className?: string, iconClassName?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-600 text-white shadow-md ${iconClassName}`}>
      <svg className="h-3/4 w-3/4" viewBox="0 0 512 512" fill="none">
        <rect x="136" y="220" width="240" height="180" rx="20" stroke="white" strokeWidth="24" strokeLinejoin="round"/>
        <rect x="206" y="210" width="100" height="16" rx="8" fill="white"/>
        <path d="M136 260 L136 230 Q136 200 166 200 L346 200 Q376 200 376 230 L376 260" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="216" y="100" width="80" height="110" rx="6" fill="white" transform="rotate(-15 256 155)"/>
        <path d="M240 145 L253 158 L275 130" stroke="#4f46e5" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-15 256 145)"/>
      </svg>
    </div>
  )
}

