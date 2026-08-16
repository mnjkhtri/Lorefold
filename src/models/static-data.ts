import type { Thread } from "./thread";

export interface GeneratedThreadRecord {
  id: string;
  dataPath: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  channels: string[];
  author: string;
  latestParticipant: string;
  messageCount: number;
  replyCount: number;
  activityType: "patch" | "rfc" | "discussion";
  patchVersion?: string;
  topics: string[];
}

export interface GeneratedChannel {
  id: string;
  threadCount: number;
}

export interface GeneratedCatalog {
  schemaVersion: number;
  generatedAt: string;
  channels: GeneratedChannel[];
  threads: GeneratedThreadRecord[];
  warnings?: string[];
}

export interface GeneratedThreadDocument {
  schemaVersion: 1;
  generatedAt: string;
  id: string;
  canonicalUrl: string;
  channels: string[];
  coverage?: {
    kind: "bounded-window";
    maxMessages: number;
  };
  thread: Thread;
}
