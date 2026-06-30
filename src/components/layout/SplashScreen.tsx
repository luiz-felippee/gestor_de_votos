import { Logo } from '../Logo'

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-brand-900 transition-opacity duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-slate-900 to-indigo-950 opacity-90" />
      
      {/* Padrão decorativo */}
      <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-pattern-splash" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 32V.5H32" fill="none" stroke="currentColor" strokeOpacity="0.2"></path>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-splash)"></rect>
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-6 animate-pulse-slow">
        <Logo className="h-24 w-auto drop-shadow-2xl" iconClassName="h-24 w-24 text-white" />
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="text-white/90 text-lg font-medium tracking-wide animate-pulse">
            Carregando sua campanha...
          </p>
        </div>
      </div>
    </div>
  )
}
