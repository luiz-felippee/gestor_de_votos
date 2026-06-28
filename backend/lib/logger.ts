import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { enviarEmail, templateErroCritico } from './email';

// Garante que a pasta de logs existe
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configuração do formato comum JSON
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Garante que a stacktrace seja serializada
  winston.format.json()
);

// Cria o transportador de Rotação Diária para logs gerais (Mantém 14 dias)
const dailyRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'gv-backend-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

// Cria o transportador separado apenas para erros graves (Para facilitar auditoria rápida)
const errorRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'gv-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Retém erros por mais tempo (30 dias)
  level: 'error',
});

// Instância principal do Winston
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    dailyRotateTransport,
    errorRotateTransport,
  ],
});

// Se não estivermos em produção, imprime no console de forma bonita e colorida
if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let output = `${timestamp} [${level}]: ${message}`;
          
          const m = meta as Record<string, any>;
          if (m && Object.keys(m).length) {
            // Remove error do meta para não duplicar se já foi formatado
            const metaCopy = { ...m };
            if (metaCopy.error && metaCopy.error.stack) delete metaCopy.error;

            if (Object.keys(metaCopy).length > 0) {
              output += `\n  ${JSON.stringify(metaCopy, null, 2)}`;
            }
          }
          if (m.error && m.error.stack) {
            output += `\n  Stack: ${m.error.stack}`;
          }
          return output;
        })
      ),
    })
  );
} else {
  // Em produção, também manda pro stdout, mas em formato JSON para o Datadog/PM2 pegar
  winstonLogger.add(new winston.transports.Console());
}

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos de cooldown para não floodar a caixa de e-mail

export const logger = {
  info: (message: string, meta?: Record<string, any>) => winstonLogger.info(message, { ...meta }),
  warn: (message: string, meta?: Record<string, any>) => winstonLogger.warn(message, { ...meta }),
  error: (message: string, error?: any, meta?: Record<string, any>) => {
    // Tratamento especial para garantir que o erro seja serializado
    winstonLogger.error(message, {
      ...meta,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });

    // Dispara alerta por e-mail para o administrador (Fail-Safe Ativo)
    if (process.env.ADMIN_ALERT_EMAIL) {
      const now = Date.now();
      if (now - lastAlertTime > ALERT_COOLDOWN_MS) {
        lastAlertTime = now;
        
        const stackTrace = error instanceof Error ? error.stack : (error ? String(error) : '');
        
        enviarEmail({
          to: process.env.ADMIN_ALERT_EMAIL,
          subject: '🚨 URGENTE: Erro no Servidor (Gestor de Votos)',
          html: templateErroCritico(message, stackTrace)
        }).catch(err => {
          // Fallback silencioso se o envio falhar (ex: sem api key) para não travar a aplicação
          console.error('[LOGGER] Falha ao enviar e-mail de alerta de erro crítico.', err.message);
        });
      }
    }
  },
};
