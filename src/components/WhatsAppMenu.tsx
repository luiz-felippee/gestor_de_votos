import { useState, useRef, useEffect } from 'react'
import type { EleitorComCabo } from '../lib/types'
import { api } from '../lib/api'

interface Props {
  eleitor: EleitorComCabo
}

export function WhatsAppMenu({ eleitor }: Props) {
  const [open, setOpen] = useState(false)
  const [mediaModalOpen, setMediaModalOpen] = useState(false)
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaText, setMediaText] = useState('')
  const [sending, setSending] = useState(false)
  
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!eleitor.telefone) return null

  const phoneString = eleitor.telefone.replace(/\D/g, '')

  const templates = [
    {
      label: '👋 Boas-vindas',
      text: `Olá ${eleitor.nome.split(' ')[0]}, tudo bem? Muito obrigado por confirmar seu apoio ao nosso projeto! Qualquer dúvida estamos à disposição.`,
    },
    {
      label: '📍 Local de Votação',
      text: `Olá ${eleitor.nome.split(' ')[0]}, passando para confirmar que seu local de votação é a escola ${eleitor.local_votacao} (Zona: ${eleitor.zona}, Seção: ${eleitor.secao}).`,
    },
    {
      label: '📅 Convite de Caminhada',
      text: `Olá ${eleitor.nome.split(' ')[0]}, teremos uma caminhada no seu bairro (${eleitor.bairro}) em breve. Gostaria de te convidar para participar com a gente!`,
    },
  ]

  const handleSend = async (text: string, tipo: string = 'text', url_midia?: string) => {
    setOpen(false)
    setSending(true)
    
    try {
      // Tenta enviar via servidor
      const res = await fetch(`${api.base}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gv_token')}`
        },
        body: JSON.stringify({ numero: phoneString, texto: text, tipo, url_midia })
      })

      if (!res.ok && tipo === 'text') {
        // Fallback: se não tiver robô e for texto, abre no celular da pessoa
        const url = `https://wa.me/55${phoneString}?text=${encodeURIComponent(text)}`
        window.open(url, '_blank')
      } else if (!res.ok) {
         alert("Erro ao enviar mídia. Verifique as configurações do robô.")
      }
    } catch (e) {
      if (tipo === 'text') {
        const url = `https://wa.me/55${phoneString}?text=${encodeURIComponent(text)}`
        window.open(url, '_blank')
      } else {
        alert("Erro de rede ao enviar mídia.")
      }
    } finally {
      setSending(false)
      setMediaModalOpen(false)
    }
    
    // Marca no banco de dados
    if (!eleitor.whatsapp_enviado) {
      try {
        await api.marcarWhatsAppEnviado(eleitor.id, true)
      } catch (e) {
        console.error("Erro ao marcar whatsapp como enviado:", e)
      }
    }
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition active:scale-95 ${
            eleitor.whatsapp_enviado 
              ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400' 
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
          title="Opções de WhatsApp"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {eleitor.whatsapp_enviado ? 'Contatado' : 'Contatar'}
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-800 dark:ring-slate-700">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Mensagens Prontas
            </div>
            {templates.map((tpl, i) => (
              <button
                key={i}
                onClick={() => handleSend(tpl.text)}
                disabled={sending}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                {tpl.label}
              </button>
            ))}
            
            <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); setMediaModalOpen(true); }}
                className="w-full text-left px-4 py-2 text-sm text-brand-600 font-medium hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30 transition-colors"
              >
                📸 Enviar Foto/Vídeo/Áudio
              </button>
            </div>

            {eleitor.whatsapp_enviado && (
              <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                <button
                  onClick={async () => {
                    setOpen(false)
                    await api.marcarWhatsAppEnviado(eleitor.id, false)
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-900/30 transition-colors"
                >
                  Desmarcar "Contatado"
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE MÍDIA */}
      {mediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Enviar Mídia para {eleitor.nome.split(' ')[0]}</h3>
                <button onClick={() => setMediaModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             <div className="p-5 space-y-4">
                <div className="flex gap-2">
                   {['image', 'video', 'audio'].map(t => (
                     <button 
                       key={t}
                       onClick={() => setMediaType(t as any)}
                       className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg border ${mediaType === t ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}
                     >
                       {t === 'image' ? '📸 Foto' : t === 'video' ? '🎥 Vídeo' : '🎤 Áudio'}
                     </button>
                   ))}
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL Pública do Arquivo</span>
                  <input type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="https://..." />
                </label>

                {mediaType !== 'audio' && (
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mensagem (Legenda)</span>
                    <textarea value={mediaText} onChange={e => setMediaText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" rows={2} placeholder="Opcional..." />
                  </label>
                )}

                <button 
                  onClick={() => handleSend(mediaText, mediaType, mediaUrl)}
                  disabled={!mediaUrl || sending}
                  className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {sending ? 'Enviando...' : 'Disparar Mídia Agora'}
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  )
}
