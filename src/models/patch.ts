import type { ContentBlock } from "./content";

export type PatchId = string;
export type MessageId = string;

export interface Trailer {
  key: string;
  value: string;
  continuationLines: string[];
}

export interface Patch {
  id: PatchId;
  messageId?: MessageId;
  subject: string;
  commitMessage: ContentBlock[];
  files: DiffFile[];
  trailers: Trailer[];
  rawText: string;
  statistics: {
    files: number;
    additions: number;
    deletions: number;
  };
  diagnostics: ParseDiagnostic[];
}

export interface DiffFile {
  oldPath?: string;
  newPath?: string;
  displayPath: string;
  status:
    | "added"
    | "deleted"
    | "modified"
    | "renamed"
    | "copied"
    | "binary"
    | "unknown";
  oldMode?: string;
  newMode?: string;
  similarity?: number;
  hunks: DiffHunk[];
  binary: boolean;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffLine {
  kind: "addition" | "deletion" | "context" | "metadata";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface ParseDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  messageId?: MessageId;
  sourceOrdinal?: number;
}

export interface PatchSeries {
  id: string;
  version: number;
  total: number;
  subjectStem: string;
  coverMessageId?: MessageId;
  members: Array<{
    index: number;
    messageId: MessageId;
    patchId?: PatchId;
  }>;
  incomplete: boolean;
}
