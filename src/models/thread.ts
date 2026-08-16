import type {
  AttachmentMetadata,
  Author,
  ContentBlock,
  MailingList,
  ParsedTimestamp,
} from "./content";
import type { MessageId, ParseDiagnostic, Patch, PatchId, PatchSeries } from "./patch";

export type MessageKey = string;
export type ThreadKey = string;

export interface SourceDescriptor {
  kind: "lore-direct" | "local-file" | "static-generated";
  requestedLoreUrl?: string;
  canonicalThreadUrl?: string;
  importedFilename?: string;
  fetchedAt?: string;
  contentDigest: string;
}

export interface Message {
  id: MessageKey;
  messageId?: MessageId;
  parentId?: MessageKey;
  declaredParentMessageId?: MessageId;
  references: MessageId[];
  missingAncestorIds: MessageId[];
  author: Author;
  timestamp: ParsedTimestamp;
  subject: string;
  mailingLists: MailingList[];
  blocks: ContentBlock[];
  patchIds: PatchId[];
  attachmentMetadata: AttachmentMetadata[];
  rawStorageKey?: string;
  sourceOrdinal: number;
  diagnostics: ParseDiagnostic[];
}

export interface Thread {
  schemaVersion: number;
  id: ThreadKey;
  source: SourceDescriptor;
  selectedMessageId?: MessageId;
  subject: string;
  messages: Record<MessageKey, Message>;
  rootIds: MessageKey[];
  childrenByParent: Record<MessageKey, MessageKey[]>;
  chronologicalIds: MessageKey[];
  patches?: Record<PatchId, Patch>;
  patchSeries: PatchSeries[];
  diagnostics: ParseDiagnostic[];
}

export interface ThreadRequest {
  source: SourceDescriptor;
  requestedMessageId?: MessageId;
}

export interface RawMessageRecord {
  bytes: Uint8Array;
  sourceOrdinal: number;
}

export interface RawThreadEnvelope {
  request: ThreadRequest;
  records: RawMessageRecord[];
}

export interface ParserLimits {
  maxInputBytes: number;
  maxRecords: number;
  maxMimeDepth: number;
  maxHeaderBytes: number;
  maxReferences: number;
  maxBodyBytes: number;
}

export interface ThreadSource {
  loadThread(
    request: ThreadRequest,
    signal: AbortSignal,
  ): Promise<RawThreadEnvelope>;
}

export interface ThreadParser {
  parse(input: RawThreadEnvelope, limits: ParserLimits): Promise<Thread>;
}

export type { MessageId, ParseDiagnostic, PatchId, PatchSeries } from "./patch";
