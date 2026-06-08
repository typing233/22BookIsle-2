import { v4 as uuidv4 } from 'uuid';

interface QueueItem {
  id: string;
  bookId: number;
  position: string;
  percentage: number;
  version: number;
  deviceId: string;
  finished: boolean;
  timestamp: string;
  retryCount: number;
}

const DB_NAME = 'bookisle_sync';
const STORE_NAME = 'progress_queue';
const DEVICE_KEY = 'bookisle_device_id';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllItems(): Promise<QueueItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addItem(item: QueueItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeItem(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const VERSION_KEY = 'bookisle_progress_versions';

function getVersions(): Record<number, number> {
  const raw = localStorage.getItem(VERSION_KEY);
  return raw ? JSON.parse(raw) : {};
}

function setVersion(bookId: number, version: number): void {
  const versions = getVersions();
  versions[bookId] = version;
  localStorage.setItem(VERSION_KEY, JSON.stringify(versions));
}

function getNextVersion(bookId: number): number {
  const versions = getVersions();
  const current = versions[bookId] || 0;
  return current + 1;
}

export const syncQueue = {
  getDeviceId,
  getAllItems,
  addItem,
  removeItem,
  clearAll,
  getVersions,
  setVersion,
  getNextVersion,

  async enqueue(bookId: number, position: string, percentage: number, finished = false): Promise<QueueItem> {
    const version = getNextVersion(bookId);
    setVersion(bookId, version);

    const item: QueueItem = {
      id: uuidv4(),
      bookId,
      position,
      percentage,
      version,
      deviceId: getDeviceId(),
      finished,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    await addItem(item);
    return item;
  },

  async flush(apiCall: (items: any[]) => Promise<any>): Promise<{ synced: number; conflicts: any[] }> {
    const items = await getAllItems();
    if (items.length === 0) return { synced: 0, conflicts: [] };

    const batchItems = items.slice(0, 50).map((item) => ({
      book_id: item.bookId,
      position: item.position,
      percentage: item.percentage,
      version: item.version,
      device_id: item.deviceId,
      finished: item.finished,
      last_read_at: item.timestamp,
      idempotency_key: item.id,
    }));

    try {
      const response = await apiCall(batchItems);
      const results = response.results || [];
      const conflicts: any[] = [];
      let synced = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = items[i];

        if (result.accepted) {
          await removeItem(item.id);
          setVersion(item.bookId, result.version);
          synced++;
        } else if (result.conflict) {
          await removeItem(item.id);
          setVersion(item.bookId, result.server_version);
          conflicts.push(result);
        }
      }

      return { synced, conflicts };
    } catch {
      return { synced: 0, conflicts: [] };
    }
  },

  async getPendingCount(): Promise<number> {
    const items = await getAllItems();
    return items.length;
  },
};
