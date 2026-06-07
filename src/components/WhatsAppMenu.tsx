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
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaText, setMediaText] = useState('')
  const [sending, setSending] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Gera preview quando arquivo muda
  useEffect(() => {
    if (!mediaFile) { setMediaPreview(null); return }
    if (mediaFile.type.startsWith('image/') || mediaFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(mediaFile)
      setMediaPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setMediaPreview(null)
  }, [mediaFile])

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

  const handleSendText = async (text: string) => {
    setOpen(false)
    setSending(true)
    
    try {
      const res = await fetch(`${api.base}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gv_token')}`
        },
        body: JSON.stringify({ numero: phoneString, texto: text })
      })

      if (!res.ok) {
        const url = `https://wa.me/55${phoneString}?text=${encodeURIComponent(text)}`
        window.open(url, '_blank')
      }
    } catch {
      const url = `https://wa.me/55${phoneString}?text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    } finally {
      setSending(false)
    }
    
    if (!eleitor.whatsapp_enviado) {
      try { await api.marcarWhatsAppEnviado(eleitor.id, true) } catch { /* */ }
    }
  }

  const handleSendMedia = async () => {
    if (!mediaFile) return
    setSending(true)

    try {
      const formData = new FormData()
      formData.append('arquivo', mediaFile)
      formData.append('numero', phoneString)
      formData.append('tipo', mediaType)
      if (mediaText) formData.append('texto', mediaText)

      const res = await fetch(`${api.base}/api/whatsapp/send-media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gv_token')}`
        },
        body: formData
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        alert(data.error || 'Erro ao enviar mídia.')
      } else {
        setMediaModalOpen(false)
        setMediaFile(null)
        setMediaText('')
      }
    } catch {
      alert('Erro de rede ao enviar mídia.')
    } finally {
      setSending(false)
    }

    if (!eleitor.whatsapp_enviado) {
      try { await api.marcarWhatsAppEnviado(eleitor.id, true) } catch { /* */ }
    }
  }

  const handleFileSelect = (file: File) => {
    setMediaFile(file)
    if (file.type.startsWith('image/')) setMediaType('image')
    else if (file.type.startsWith('video/')) setMediaType('video')
    else if (file.type.startsWith('audio/')) setMediaType('audio')
  }

  const acceptMap = {
    image: 'image/*',
    video: 'video/*',
    audio: 'audio/*',
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
                onClick={() => handleSendText(tpl.text)}
                disabled={sending}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                {tpl.label}
              </button>
            ))}
            
            <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); setMediaModalOpen(true); setMediaFile(null); setMediaText(''); }}
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

      {/* MODAL DE MÍDIA — UPLOAD DE ARQUIVO */}
      {mediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
             {/* Header */}
             <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Enviar Mídia</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">para {eleitor.nome.split(' ')[0]}</p>
                  </div>
                </div>
                <button onClick={() => setMediaModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-300/80 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>

             <div className="p-5 space-y-4">
                {/* Seletor de tipo */}
                <div className="flex gap-2">
                   {(['image', 'video', 'audio'] as const).map(t => (
                     <button 
                       key={t}
                       onClick={() => { setMediaType(t); setMediaFile(null); }}
                       className={`flex-1 py-2 text-xs font-bold uppercase rounded-xl border-2 transition-all duration-200 ${mediaType === t 
                         ? 'bg-green-50 border-green-500 text-green-700 shadow-sm shadow-green-200/50 dark:bg-green-900/30 dark:text-green-400 dark:border-green-500 dark:shadow-green-900/30' 
                         : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-600'}`}
                     >
                       {t === 'image' ? '📸 Foto' : t === 'video' ? '🎥 Vídeo' : '🎤 Áudio'}
                     </button>
                   ))}
                </div>

                {/* Zona de upload */}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept={acceptMap[mediaType]}
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]) }}
                />

                {!mediaFile ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault()
                      setDragOver(false)
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0])
                    }}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                      dragOver 
                        ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 scale-[1.02]' 
                        : 'border-slate-300 hover:border-green-400 hover:bg-green-50/30 dark:border-slate-700 dark:hover:border-green-600 dark:hover:bg-green-900/10'
                    }`}
                  >
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Clique para escolher ou arraste aqui
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {mediaType === 'image' ? 'JPG, PNG, WebP' : mediaType === 'video' ? 'MP4, MOV, AVI' : 'MP3, OGG, M4A'} — máx. 64 MB
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                    {/* Preview */}
                    {mediaPreview && mediaType === 'image' && (
                      <div className="relative">
                        <img src={mediaPreview} alt="Preview" className="w-full h-40 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                    )}
                    {mediaPreview && mediaType === 'video' && (
                      <video src={mediaPreview} className="w-full h-40 object-cover" controls />
                    )}
                    {mediaType === 'audio' && (
                      <div className="p-4 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                          </div>
                          <span className="text-sm font-medium">Áudio selecionado</span>
                        </div>
                      </div>
                    )}
                    {/* Info do arquivo */}
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{mediaFile.name}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(mediaFile.size)}</p>
                      </div>
                      <button 
                        onClick={() => { setMediaFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="ml-2 text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Trocar
                      </button>
                    </div>
                  </div>
                )}

                {/* Legenda */}
                {mediaType !== 'audio' && (
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Legenda (opcional)</span>
                    <textarea 
                      value={mediaText} 
                      onChange={e => setMediaText(e.target.value)} 
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-green-500 transition" 
                      rows={2} 
                      placeholder="Escreva uma mensagem..." 
                    />
                  </label>
                )}

                {/* Botão de envio */}
                <button 
                  onClick={handleSendMedia}
                  disabled={!mediaFile || sending}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                      Disparar Mídia
                    </>
                  )}
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  )
}
