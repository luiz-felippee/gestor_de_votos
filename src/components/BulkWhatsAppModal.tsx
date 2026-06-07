import { useState, useRef, useEffect } from 'react'
import type { EleitorComCabo } from '../lib/types'
import { api } from '../lib/api'

interface Props {
  eleitores: EleitorComCabo[]
  onClose: () => void
  onSuccess: () => void
}

export function BulkWhatsAppModal({ eleitores, onClose, onSuccess }: Props) {
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: eleitores.length, success: 0, failed: 0 })
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-detect type
  useEffect(() => {
    if (!mediaFile) { setMediaPreview(null); return }
    if (mediaFile.type.startsWith('image/')) {
      setMediaType('image')
      const url = URL.createObjectURL(mediaFile)
      setMediaPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    if (mediaFile.type.startsWith('video/')) setMediaType('video')
    if (mediaFile.type.startsWith('audio/')) setMediaType('audio')
    setMediaPreview(null)
  }, [mediaFile])

  const handleSendBulk = async () => {
    if (mediaType !== 'text' && !mediaFile) return
    if (mediaType === 'text' && !text.trim()) return

    setSending(true)
    setProgress({ current: 0, total: eleitores.length, success: 0, failed: 0 })

    for (let i = 0; i < eleitores.length; i++) {
      const eleitor = eleitores[i]
      setProgress(p => ({ ...p, current: i + 1 }))

      if (!eleitor.telefone) {
        setProgress(p => ({ ...p, failed: p.failed + 1 }))
        continue
      }

      const phoneString = eleitor.telefone.replace(/\D/g, '')

      // Delay de 2.5s entre mensagens para evitar banimento do WhatsApp (apenas se não for o primeiro)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }

      // Prepara o texto personalizado substituindo {nome}
      const personalizedText = text.replace('{nome}', eleitor.nome.split(' ')[0])

      try {
        let res;
        if (mediaType === 'text') {
          res = await fetch(`${api.base}/api/whatsapp/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('gv_token')}`
            },
            body: JSON.stringify({ numero: phoneString, texto: personalizedText })
          })
        } else if (mediaFile) {
          const formData = new FormData()
          formData.append('arquivo', mediaFile)
          formData.append('numero', phoneString)
          if (personalizedText) formData.append('legenda', personalizedText)
          formData.append('tipo', mediaType)

          res = await fetch(`${api.base}/api/whatsapp/send-media`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('gv_token')}`
            },
            body: formData
          })
        }

        if (res && res.ok) {
          setProgress(p => ({ ...p, success: p.success + 1 }))
          if (!eleitor.whatsapp_enviado) {
            try { await api.marcarWhatsAppEnviado(eleitor.id, true) } catch { /* */ }
          }
        } else {
          setProgress(p => ({ ...p, failed: p.failed + 1 }))
        }
      } catch {
        setProgress(p => ({ ...p, failed: p.failed + 1 }))
      }
    }

    setSending(false)
    setTimeout(() => {
      onSuccess()
      onClose()
    }, 1500)
  }

  // Drag and Drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false) }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setMediaFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Disparo em Massa</h3>
            <p className="text-sm font-medium text-brand-100">
              Enviando para {eleitores.length} eleitores selecionados
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {sending ? (
            <div className="py-8 text-center animate-fade-in">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-900/30">
                <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-white">Enviando mensagens...</h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Aguarde. Há um delay de 2.5s entre os envios para proteger seu número.
              </p>
              
              <div className="mt-8 px-4">
                <div className="mb-2 flex justify-between text-sm font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Progresso</span>
                  <span className="text-brand-600">{progress.current} / {progress.total}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                
                <div className="mt-6 flex justify-center gap-6 text-sm">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-green-500">{progress.success}</span>
                    <span className="font-semibold text-slate-500">Enviados</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-red-500">{progress.failed}</span>
                    <span className="font-semibold text-slate-500">Falhas</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Alerta de Segurança */}
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <strong className="block font-bold">Evite banimentos!</strong>
                  Evite enviar centenas de mensagens de uma vez. O sistema fará pausas automáticas, mas não exagere se seu chip for novo.
                </div>
              </div>

              {/* Tipo de Envio */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                  O que você quer enviar?
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(['text', 'image', 'video', 'audio'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setMediaType(t); setMediaFile(null) }}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                        mediaType === t
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/20 dark:text-brand-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {t === 'text' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>}
                      {t === 'image' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      {t === 'video' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                      {t === 'audio' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                      <span className="capitalize">{t === 'text' ? 'Texto' : t === 'image' ? 'Foto' : t === 'video' ? 'Vídeo' : 'Áudio'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Área */}
              {mediaType !== 'text' && (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Arquivo de {mediaType === 'image' ? 'Foto' : mediaType === 'video' ? 'Vídeo' : 'Áudio'}
                  </label>
                  {!mediaFile ? (
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors ${
                        dragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => { if (e.target.files?.[0]) setMediaFile(e.target.files[0]) }} 
                        className="hidden" 
                        accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : 'audio/*'} 
                      />
                      <div className="rounded-full bg-white p-3 shadow-sm dark:bg-slate-900">
                        <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Clique para escolher ou arraste o arquivo aqui
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/50 dark:bg-brand-900/20">
                      {mediaPreview && mediaType === 'image' && (
                        <img src={mediaPreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover shadow-sm" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-bold text-brand-900 dark:text-brand-100">{mediaFile.name}</p>
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-400">
                          {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button onClick={() => setMediaFile(null)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-50 dark:bg-slate-800 dark:text-red-400">
                        Trocar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem/Legenda */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                  {mediaType === 'text' ? 'Mensagem' : 'Legenda (opcional)'}
                </label>
                <textarea
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  rows={4}
                  placeholder={`Use {nome} para inserir o primeiro nome da pessoa.\nEx: Olá {nome}, tudo bem?`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!sending && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSendBulk}
              disabled={mediaType !== 'text' ? !mediaFile : !text.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Iniciar Disparo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
