import { normalizeHeaders } from "./headers";
import { selectBody } from "./body";
import { parseMimeMessage } from "./mime";
import { splitMbox } from "./mbox";
import { decodeBounded } from "./compression";
import {
  ParserCancelledError,
  type ParseWorkerResult,
  type ParserWorkerRequest,
  type ParserWorkerResponse,
} from "./worker-protocol";
import { projectParsedRecords } from "./parsed-thread";

export type WorkerEmitter = (response: ParserWorkerResponse) => void;

export async function runParseRequest(
  request: Extract<ParserWorkerRequest, { type: "parse" }>,
  emit: WorkerEmitter,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  try {
    const bytes = await decodeBounded(request.bytes, {
      maxCompressedBytes: request.limits.maxInputBytes,
      maxDecompressedBytes: request.limits.maxBodyBytes,
    });
    if (isCancelled()) {
      throw new ParserCancelledError();
    }

    const records = splitMbox(bytes);
    if (records.length > request.limits.maxRecords) {
      throw new Error("Message count exceeds the configured limit.");
    }

    const parsedRecords = [];
    for (const record of records) {
      if (isCancelled()) {
        throw new ParserCancelledError();
      }
      const mime = await parseMimeMessage(record.bytes, {
        maxHeaderBytes: request.limits.maxHeaderBytes,
        maxNestingDepth: request.limits.maxMimeDepth,
      });
      const headers = normalizeHeaders(mime, {
        maxReferences: request.limits.maxReferences,
        sourceOrdinal: record.sourceOrdinal,
      });
      parsedRecords.push({
        sourceOrdinal: record.sourceOrdinal,
        mime,
        headers,
        body: selectBody(mime),
        rawText: new TextDecoder().decode(record.bytes),
      });
      if (
        parsedRecords.length % 20 === 0 ||
        parsedRecords.length === records.length
      ) {
        emit({
          type: "progress",
          requestId: request.requestId,
          processed: parsedRecords.length,
          total: records.length,
        });
      }
    }

    const result: ParseWorkerResult = {
      requestId: request.requestId,
      request: request.request,
      records: parsedRecords,
      thread: await projectParsedRecords(parsedRecords, request.request),
    };
    emit({ type: "result", result });
  } catch (error) {
    if (error instanceof ParserCancelledError) {
      emit({ type: "cancelled", requestId: request.requestId });
      return;
    }
    const typedError = error instanceof Error ? error : new Error("Parser failed.");
    emit({
      type: "error",
      requestId: request.requestId,
      code: "code" in typedError && typeof typedError.code === "string"
        ? typedError.code
        : "parser-error",
      message: typedError.message,
    });
  }
}
