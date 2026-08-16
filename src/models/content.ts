export interface Author {
  name: string;
  address?: string;
}

export interface MailingList {
  id: string;
  displayName: string;
  address?: string;
  loreArchiveUrl?: string;
}

export interface ParsedTimestamp {
  raw?: string;
  iso?: string;
  valid: boolean;
}

export interface QuoteLine {
  depth: number;
  text: string;
}

export interface AttachmentMetadata {
  filename?: string;
  contentType?: string;
  size?: number;
  disposition: "inline" | "attachment" | "unknown";
  contentOmitted: boolean;
}

export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | {
      kind: "quote";
      attribution?: string;
      lines: QuoteLine[];
      lineCount: number;
      maximumDepth: number;
    }
  | { kind: "code"; text: string; languageHint?: string }
  | { kind: "patch"; patchId: string }
  | { kind: "signature"; text: string; lineCount: number };
