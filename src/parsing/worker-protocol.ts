import type { DecodedMimeMessage } from "./mime";
import type { NormalizedHeaders } from "./headers";
import type { SelectedBody } from "./body";
import type { ParserLimits, Thread, ThreadRequest } from "../models/thread";

export interface ParsedWorkerRecord {
  sourceOrdinal: number;
  mime: DecodedMimeMessage;
  headers: NormalizedHeaders;
  body: SelectedBody;
  rawText: string;
}

export interface ParseWorkerResult {
  requestId: string;
  request: ThreadRequest;
  records: ParsedWorkerRecord[];
  thread?: Thread;
}

export type ParserWorkerRequest =
  | {
      type: "parse";
      requestId: string;
      bytes: ArrayBuffer;
      request: ThreadRequest;
      limits: ParserLimits;
    }
  | { type: "cancel"; requestId: string };

export type ParserWorkerResponse =
  | {
      type: "progress";
      requestId: string;
      processed: number;
      total: number;
    }
  | { type: "result"; result: ParseWorkerResult }
  | { type: "cancelled"; requestId: string }
  | {
      type: "error";
      requestId: string;
      code: string;
      message: string;
    };

export class ParserCancelledError extends Error {
  public readonly code = "parser-cancelled";

  public constructor() {
    super("Parser operation was cancelled.");
    this.name = "ParserCancelledError";
  }
}

export function isParserWorkerResponse(value: unknown): value is ParserWorkerResponse {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === "progress" || type === "result" || type === "cancelled" || type === "error";
}
