import { io, type Socket } from 'socket.io-client'
import { api } from './api'

let socket: Socket | null = null

/** Conexão Socket.io compartilhada para receber eventos de tempo real. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(api.base, { autoConnect: true, transports: ['websocket'] })
  }
  return socket
}
