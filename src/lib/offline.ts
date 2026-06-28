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
  
  return newItem;
}

export async function getOfflineQueue(): Promise<EleitorOffline[]> {
  const queue = await get<EleitorOffline[]>(OFFLINE_QUEUE_KEY);
  return queue || [];
}

export async function clearOfflineQueue(): Promise<void> {
  await set(OFFLINE_QUEUE_KEY, []);
}
