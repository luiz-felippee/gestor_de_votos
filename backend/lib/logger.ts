export interface LogPayload {
  message: string
  level?: 'info' | 'warn' | 'error'
  meta?: Record<string, any>
  error?: Error | any
}

function log({ message, level = 'info', meta = {}, error }: LogPayload) {
  const payload: Record<string, any> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }

  if (error) {
    payload.error = {
      message: error.message || String(error),
      stack: error.stack,
    }
  }

  console.log(JSON.stringify(payload))
}

export const logger = {
  info: (message: string, meta?: Record<string, any>) => log({ message, level: 'info', meta }),
  warn: (message: string, meta?: Record<string, any>) => log({ message, level: 'warn', meta }),
  error: (message: string, error?: any, meta?: Record<string, any>) => log({ message, level: 'error', error, meta }),
}
