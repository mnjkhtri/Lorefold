import type { Thread } from "./thread";

export interface GeneratedThreadRecord {
  id: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  channel: string;
  author: string;
  latestParticipant: string;
  messageCount: number;
  replyCount: number;
  activityType: "patch" | "rfc" | "discussion";
  patchVersion?: string;
  topics: string[];
  thread: Thread;
  rawRecords: string[];
}

export interface GeneratedChannel {
  id: string;
  label: string;
  threadCount: number;
}

export interface GeneratedCatalog {
  schemaVersion: number;
  generatedAt: string;
  channels: GeneratedChannel[];
  threads: GeneratedThreadRecord[];
}
