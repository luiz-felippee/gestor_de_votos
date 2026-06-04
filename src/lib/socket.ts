import { io, type Socket } from 'socket.io-client'
import { API_BASE } from './api'

let socket: Socket | null = null

/** Conexão Socket.io compartilhada para receber eventos de tempo real. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, { autoConnect: true, transports: ['websocket'] })
  }
  return socket
}
