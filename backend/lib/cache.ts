import NodeCache from 'node-cache';
import { logger } from './logger';

// Instância padrão do cache: 5 minutos de vida para os itens por padrão
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const cache = {
  get: <T>(key: string): T | undefined => {
    return myCache.get<T>(key);
  },
  
  set: <T>(key: string, value: T, ttlSeconds: number = 300): boolean => {
    return myCache.set(key, value, ttlSeconds);
  },
  
  // Apaga as chaves que comecem com determinado prefixo (ex: campanha_id)
  invalidateByPrefix: (prefix: string) => {
    const keys = myCache.keys();
    const keysToDelete = keys.filter(k => k.startsWith(prefix));
    if (keysToDelete.length > 0) {
      myCache.del(keysToDelete);
      logger.info(`Cache invalidado para prefixo: ${prefix}`, { keysDeleted: keysToDelete.length });
    }
  },

  // Apaga cache inteiro (usado quando não temos um contexto de campanha)
  flush: () => {
    myCache.flushAll();
    logger.info('Cache global esvaziado.');
  }
};
