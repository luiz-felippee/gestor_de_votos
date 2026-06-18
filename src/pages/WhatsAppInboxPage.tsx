import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { MensagemWhatsApp } from '../lib/types'
import { Send, UserCircle, CheckCheck } from 'lucide-react'

export function WhatsAppInboxPage() {
  const [chats, setChats] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [messages, setMessages] = useState<MensagemWhatsApp[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarChats()
    
    const socket = getSocket()
    socket.on('whatsapp:mensagem', (msg: MensagemWhatsApp) => {
      // Atualiza a lista de chats (move pra cima)
      setChats(prev => {
        const idx = prev.findIndex(c => c.numero === msg.numero)
        const updated = [...prev]
        if (idx >= 0) {
          const chat = updated.splice(idx, 1)[0]
          chat.ultima_mensagem = msg.texto
          chat.data = msg.created_at
          if (!msg.is_from_me && msg.numero !== activeChat) chat.nao_lidas += 1
          updated.unshift(chat)
        } else {
          updated.unshift({
            numero: msg.numero,
            ultima_mensagem: msg.texto,
            data: msg.created_at,
            nao_lidas: msg.is_from_me ? 0 : 1
          })
        }
        return updated
      })

      // Adiciona na tela se for o chat ativo
      setActiveChat(currentActive => {
        if (currentActive === msg.numero) {
          setMessages(prev => [...prev, msg])
        }
        return currentActive
      })
    })

    return () => {
      socket.off('whatsapp:mensagem')
    }
  }, [])

  useEffect(() => {
    if (activeChat) {
      carregarHistorico(activeChat)
      // Zera não lidas
      setChats(prev => prev.map(c => c.numero === activeChat ? { ...c, nao_lidas: 0 } : c))
    }
  }, [activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function carregarChats() {
    try {
      setLoading(true)
      const res = await api.fetchWhatsAppChats()
      setChats(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function carregarHistorico(numero: string) {
    try {
      const res = await api.fetchWhatsAppChatHistory(numero)
      setMessages(res)
    } catch (e) {
      console.error(e)
    }
  }

  async function enviar() {
    if (!newMessage.trim() || !activeChat) return
    const txt = newMessage.trim()
    setNewMessage('')
    try {
      // Dispara o WhatsApp (outbound). A mensagem volta via Socket.io
      // (evento whatsapp:mensagem) e o backend já grava no histórico.
      await api.sendWhatsApp(activeChat, txt)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar de Chats */}
      <div className="w-80 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Conversas</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-slate-500">Carregando...</div>}
          {!loading && chats.length === 0 && <div className="p-4 text-center text-sm text-slate-500">Nenhuma conversa encontrada.</div>}
          {chats.map(chat => (
            <div 
              key={chat.numero} 
              onClick={() => setActiveChat(chat.numero)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition flex items-center gap-3 dark:border-slate-800/50 ${activeChat === chat.numero ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <UserCircle className="w-10 h-10 text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    +{chat.numero}
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(chat.data).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500 truncate dark:text-slate-400">
                    {chat.ultima_mensagem}
                  </p>
                  {chat.nao_lidas > 0 && (
                    <span className="ml-2 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {chat.nao_lidas}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 z-10">
              <UserCircle className="w-10 h-10 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">+{activeChat}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
              <div className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 mix-blend-overlay"></div>
              {messages.map(msg => (
                <div key={msg.id} className={`flex relative z-10 ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${msg.is_from_me ? 'bg-brand-500 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.texto}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${msg.is_from_me ? 'text-brand-100' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.is_from_me && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enviar()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button 
                  onClick={enviar}
                  disabled={!newMessage.trim()}
                  className="bg-brand-500 text-white rounded-full p-2.5 hover:bg-brand-600 disabled:opacity-50 transition"
                >
                  <Send className="w-5 h-5 -ml-0.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Send className="w-16 h-16 mb-4 opacity-20" />
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  )
}
