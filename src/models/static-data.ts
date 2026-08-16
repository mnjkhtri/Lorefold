import type { Thread } from "./thread";

export interface GeneratedThreadRecord {
  id: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  thread: Thread;
  rawRecords: string[];
}

export interface GeneratedCatalog {
  schemaVersion: number;
  generatedAt: string;
  list: string;
  threads: GeneratedThreadRecord[];
}
