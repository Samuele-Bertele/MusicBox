export const STORES = [
  'playlists',
  'playlist_tracks',
  'liked_tracks',
  'followed_artists',
  'saved_albums',
  'listening_history',
  'search_history',
  'kv',
] as const;

export type StoreName = (typeof STORES)[number];

export interface KeyValueBackend {
  open(): Promise<void>;
  all<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  putMany(store: StoreName, rows: Array<[string, unknown]>): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

/** In-memory backend: used in tests, SSR and private-mode fallbacks. */
export class MemoryBackend implements KeyValueBackend {
  private data = new Map<StoreName, Map<string, unknown>>();

  async open() {
    for (const s of STORES) if (!this.data.has(s)) this.data.set(s, new Map());
  }
  private bucket(store: StoreName) {
    let b = this.data.get(store);
    if (!b) {
      b = new Map();
      this.data.set(store, b);
    }
    return b;
  }
  async all<T>(store: StoreName) {
    return [...this.bucket(store).values()] as T[];
  }
  async get<T>(store: StoreName, key: string) {
    return this.bucket(store).get(key) as T | undefined;
  }
  async put(store: StoreName, key: string, value: unknown) {
    this.bucket(store).set(key, value);
  }
  async putMany(store: StoreName, rows: Array<[string, unknown]>) {
    for (const [k, v] of rows) this.bucket(store).set(k, v);
  }
  async del(store: StoreName, key: string) {
    this.bucket(store).delete(key);
  }
  async clear(store: StoreName) {
    this.bucket(store).clear();
  }
}

const DB_NAME = 'musicbox';
const DB_VERSION = 1;

/** IndexedDB backend — the default on device. No dependency, no quota cost. */
export class IdbBackend implements KeyValueBackend {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private tx(store: StoreName, mode: IDBTransactionMode) {
    if (!this.db) throw new Error('idb_not_open');
    return this.db.transaction(store, mode).objectStore(store);
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  all<T>(store: StoreName) {
    return this.wrap(this.tx(store, 'readonly').getAll() as IDBRequest<T[]>);
  }
  async get<T>(store: StoreName, key: string) {
    return (await this.wrap(this.tx(store, 'readonly').get(key))) as T | undefined;
  }
  async put(store: StoreName, key: string, value: unknown) {
    await this.wrap(this.tx(store, 'readwrite').put(value, key));
  }
  async putMany(store: StoreName, rows: Array<[string, unknown]>) {
    if (!this.db) throw new Error('idb_not_open');
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const [k, v] of rows) os.put(v, k);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async del(store: StoreName, key: string) {
    await this.wrap(this.tx(store, 'readwrite').delete(key));
  }
  async clear(store: StoreName) {
    await this.wrap(this.tx(store, 'readwrite').clear());
  }
}

export async function createBackend(): Promise<KeyValueBackend> {
  if (typeof indexedDB !== 'undefined') {
    try {
      const idb = new IdbBackend();
      await idb.open();
      return idb;
    } catch {
      /* private browsing / disabled storage */
    }
  }
  const mem = new MemoryBackend();
  await mem.open();
  return mem;
}
