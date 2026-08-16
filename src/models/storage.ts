import type { Thread, ThreadKey } from "./thread";

export interface StoredThread {
  thread: Thread;
  rawRecords?: Uint8Array[];
  saved: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  sizeBytes?: number;
}

export interface ThreadRepository {
  get(id: ThreadKey): Promise<StoredThread | undefined>;
  put(record: StoredThread): Promise<void>;
  setSaved(id: ThreadKey, saved: boolean): Promise<void>;
  delete(id: ThreadKey): Promise<void>;
  evictUnsaved(): Promise<void>;
}
