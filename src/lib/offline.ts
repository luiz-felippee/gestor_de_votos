import { get, set } from 'idb-keyval';

const OFFLINE_QUEUE_KEY = 'eleitores_offline_queue';

export interface EleitorOffline {
  tempId: string;
  data: any;
  timestamp: number;
}

export async function saveToOfflineQueue(eleitorData: any): Promise<EleitorOffline> {
  const queue = await getOfflineQueue();

  const newItem: EleitorOffline = {
    tempId: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    data: eleitorData,
    timestamp: Date.now()
  };

  queue.push(newItem);
  await set(OFFLINE_QUEUE_KEY, queue);

  // Avisa quem mostra o contador de pendentes (antes cada chamador tinha que
  // lembrar de disparar o evento — o de api.ts esquecia e o badge não atualizava).
  window.dispatchEvent(new Event('gv_queue_updated'));

  return newItem;
}

export async function getOfflineQueue(): Promise<EleitorOffline[]> {
  const queue = await get<EleitorOffline[]>(OFFLINE_QUEUE_KEY);
  return queue || [];
}

// Remove APENAS os itens sincronizados (por tempId), nunca a fila inteira.
// Se um cadastro entrar na fila enquanto a sincronização está em andamento,
// um "clear" apagaria esse item sem ele nunca ter sido enviado — eleitor perdido.
export async function removeFromOfflineQueue(tempIds: string[]): Promise<number> {
  const enviados = new Set(tempIds);
  const atual = await getOfflineQueue();
  const restante = atual.filter((item) => !enviados.has(item.tempId));
  await set(OFFLINE_QUEUE_KEY, restante);
  window.dispatchEvent(new Event('gv_queue_updated'));
  return restante.length;
}
