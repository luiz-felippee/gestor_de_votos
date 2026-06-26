import { io, type Socket } from 'socket.io-client'
import { API_BASE, getToken } from './api'

let socket: Socket | null = null

/** Conexão Socket.io compartilhada para receber eventos de tempo real. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      autoConnect: true,
      transports: ['websocket'],
      // Envia o token no handshake para o servidor colocar o socket na
      // "sala" da campanha (eventos isolados em tempo real).
      // Função: relê o token a cada (re)conexão.
      auth: (cb) => cb({ token: getToken() ?? '' }),
    })
  }
  return socket
}
