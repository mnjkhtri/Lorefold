import type { ParserLimits, ThreadRequest } from "../models/thread";
import {
  ParserCancelledError,
  isParserWorkerResponse,
  type ParseWorkerResult,
  type ParserWorkerResponse,
} from "./worker-protocol";

export interface ParserProgress {
  processed: number;
  total: number;
}

export interface ParserWorkerLike {
  onmessage: ((event: MessageEvent<ParserWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

export type ParserWorkerFactory = () => ParserWorkerLike;

const defaultWorkerFactory: ParserWorkerFactory = () =>
  new Worker(new URL("../workers/parser.worker.ts", import.meta.url), { type: "module" });

export function parserWorkerFactory(): ParserWorkerFactory {
  return defaultWorkerFactory;
}

export function parseInWorker(
  input: ArrayBuffer | Uint8Array,
  request: ThreadRequest,
  limits: ParserLimits,
  options: {
    workerFactory?: ParserWorkerFactory;
    onProgress?: (progress: ParserProgress) => void;
    signal?: AbortSignal;
    requestId?: string;
  } = {},
): Promise<ParseWorkerResult> {
  const worker = (options.workerFactory ?? defaultWorkerFactory)();
  const requestId = options.requestId ?? crypto.randomUUID();
  const bytes = input instanceof Uint8Array
    ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
    : input;

  return new Promise<ParseWorkerResult>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      options.signal?.removeEventListener("abort", cancel);
    };
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const cancel = (): void => {
      worker.postMessage({ type: "cancel", requestId });
    };

    worker.onmessage = (event) => {
      if (!isParserWorkerResponse(event.data)) return;
      const response = event.data;
      if (response.type === "progress") {
        options.onProgress?.({ processed: response.processed, total: response.total });
      } else if (response.type === "result" && response.result.requestId === requestId) {
        finish(() => resolve(response.result));
      } else if (response.type === "cancelled" && response.requestId === requestId) {
        finish(() => reject(new ParserCancelledError()));
      } else if (response.type === "error" && response.requestId === requestId) {
        finish(() => reject(new Error(`${response.code}: ${response.message}`)));
      }
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "Parser worker failed.")));
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    worker.postMessage(
      { type: "parse", requestId, bytes, request, limits },
      [bytes],
    );
  });
}
