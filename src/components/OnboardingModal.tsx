import { useState } from 'react'
import { UserPlus, Share2, BarChart3, X, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface OnboardingModalProps {
  onClose: () => void
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const steps = [
    {
      title: '1. Cadastrar Liderança (Cabos)',
      description: 'O primeiro passo para o sucesso é cadastrar os cabos eleitorais e lideranças de rua que vão te ajudar a coletar intenções de votos.',
      icon: <UserPlus className="h-10 w-10 text-brand-500" />,
      actionText: 'Ir para Lideranças',
      action: () => {
        onClose()
        navigate('/cabos')
      }
    },
    {
      title: '2. Compartilhar Link de Cadastro',
      description: 'Cada cabo eleitoral possui um link de cadastro exclusivo. Eles podem compartilhar esse link pelo WhatsApp para os eleitores se cadastrarem sozinhos.',
      icon: <Share2 className="h-10 w-10 text-amber-500" />,
      actionText: 'Ver Cabos e Links',
      action: () => {
        onClose()
        navigate('/cabos')
      }
    },
    {
      title: '3. Acompanhar em Tempo Real',
      description: 'À medida que os eleitores se cadastram, os dados chegam instantaneamente na Planilha de Votação e geram os gráficos de desempenho.',
      icon: <BarChart3 className="h-10 w-10 text-emerald-500" />,
      actionText: 'Começar a Explorar',
      action: onClose
    }
  ]

  const currentStepData = steps[step - 1]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-slide-up flex flex-col">
        
        {/* Background glow decorator */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Fechar onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="rounded-lg bg-brand-50 dark:bg-brand-900/30 p-2">
            <Sparkles className="h-6 w-6 text-brand-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Primeiros Passos</h3>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bem-vindo ao Gestor de Votos!</h2>
          </div>
        </div>

        <div className="min-h-[180px] flex flex-col justify-center bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex-shrink-0 bg-white dark:bg-slate-900 p-2.5 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-800">
              {currentStepData.icon}
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">{currentStepData.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {currentStepData.description}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i + 1)}
                className={`h-2 rounded-full transition-all ${
                  step === i + 1 ? 'w-6 bg-brand-500' : 'w-2 bg-slate-200 dark:bg-slate-800'
                }`}
                aria-label={`Ir para passo ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Voltar
              </button>
            )}
            
            <button
              onClick={() => {
                if (step < steps.length) {
                  setStep(s => s + 1)
                } else {
                  currentStepData.action()
                }
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm"
            >
              {step === steps.length ? currentStepData.actionText : 'Avançar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
