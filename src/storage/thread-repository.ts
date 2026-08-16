import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { StoredThread } from "../models/storage";
import type { ThreadKey } from "../models/thread";

const DATABASE_VERSION = 1;
const THREAD_STORE = "threads";
export const MAX_UNSAVED_THREADS = 50;
export const MAX_UNSAVED_BYTES = 100 * 1024 * 1024;

interface LorefoldDatabase extends DBSchema {
  threads: {
    key: string;
    value: StoredThread;
    indexes: {
      saved: number;
      lastOpenedAt: string;
    };
  };
}

export class StorageQuotaError extends Error {
  public readonly code = "storage-quota-exceeded";

  public constructor() {
    super("Browser storage quota was exceeded.");
    this.name = "StorageQuotaError";
  }
}

export class IndexedDbThreadRepository {
  private readonly databasePromise: Promise<IDBPDatabase<LorefoldDatabase>>;

  public constructor(databaseName = "lorefold") {
    this.databasePromise = openDB<LorefoldDatabase>(databaseName, DATABASE_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(THREAD_STORE)) {
          const store = database.createObjectStore(THREAD_STORE, { keyPath: "thread.id" });
          store.createIndex("saved", "saved");
          store.createIndex("lastOpenedAt", "lastOpenedAt");
        }
      },
    });
  }

  public async get(id: ThreadKey): Promise<StoredThread | undefined> {
    return (await this.databasePromise).get(THREAD_STORE, id);
  }

  public async list(): Promise<StoredThread[]> {
    const records = await (await this.databasePromise).getAll(THREAD_STORE);
    return records.sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  }

  public async put(record: StoredThread): Promise<void> {
    try {
      const database = await this.databasePromise;
      await database.put(THREAD_STORE, {
        ...record,
        sizeBytes: record.sizeBytes ?? JSON.stringify(record.thread).length,
      });
      await this.evictUnsaved();
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        throw new StorageQuotaError();
      }
      throw error;
    }
  }

  public async setSaved(id: ThreadKey, saved: boolean): Promise<void> {
    const database = await this.databasePromise;
    const record = await database.get(THREAD_STORE, id);
    if (record === undefined) return;
    await database.put(THREAD_STORE, { ...record, saved, updatedAt: new Date().toISOString() });
  }

  public async delete(id: ThreadKey): Promise<void> {
    await (await this.databasePromise).delete(THREAD_STORE, id);
  }

  public async evictUnsaved(): Promise<void> {
    const database = await this.databasePromise;
    const records = await database.getAll(THREAD_STORE);
    const unsaved = records.filter((record) => !record.saved);
    let totalBytes = unsaved.reduce((total, record) => total + (record.sizeBytes ?? 0), 0);
    unsaved.sort((left, right) => left.lastOpenedAt.localeCompare(right.lastOpenedAt));
    while (unsaved.length > MAX_UNSAVED_THREADS || totalBytes > MAX_UNSAVED_BYTES) {
      const oldest = unsaved.shift();
      if (oldest === undefined) break;
      totalBytes -= oldest.sizeBytes ?? 0;
      await database.delete(THREAD_STORE, oldest.thread.id);
    }
  }

  public async close(): Promise<void> {
    (await this.databasePromise).close();
  }

  public static async deleteDatabase(databaseName = "lorefold"): Promise<void> {
    await deleteDB(databaseName);
  }
}
