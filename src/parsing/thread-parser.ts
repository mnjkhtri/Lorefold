import type { ContentBlock } from "../models/content";
import type { Message, Thread } from "../models/thread";
import type { Patch } from "../models/patch";
import { normalizeHeaders } from "./headers";
import { selectBody } from "./body";
import { parseMimeMessage } from "./mime";
import { detectPatches } from "./patch-detection";
import { parseDiff } from "./diff";
import { parseQuotes } from "./quotes";
import { parseSignatureAndCode } from "./signature-code";
import { parsePatchSeries } from "./trailers-series";
import { reconstructThread, type ReconstructionRecord } from "./reconstruction";
import type { ParserLimits, RawThreadEnvelope } from "../models/thread";

export class ThreadParseError extends Error {
  public readonly code = "thread-parse-error";

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ThreadParseError";
  }
}

function contentBlocks(text: string): ContentBlock[] {
  return parseQuotes(text).flatMap((block) => {
    if (block.kind !== "paragraph") return [block];
    return parseSignatureAndCode(block.text);
  });
}

export async function parseThread(
  input: RawThreadEnvelope,
  limits: ParserLimits,
): Promise<Thread> {
  if (input.records.length > limits.maxRecords) {
    throw new ThreadParseError("Thread contains too many messages.");
  }

  const reconstructionRecords: ReconstructionRecord[] = [];
  const patches = new Map<string, Patch>();

  try {
    for (const record of input.records) {
      const mime = await parseMimeMessage(record.bytes, {
        maxRawBytes: limits.maxBodyBytes,
        maxHeaderBytes: limits.maxHeaderBytes,
        maxNestingDepth: limits.maxMimeDepth,
      });
      const headers = normalizeHeaders(mime, {
        maxReferences: limits.maxReferences,
        sourceOrdinal: record.sourceOrdinal,
      });
      const body = selectBody(mime);
      const detected = detectPatches(body.text);
      const messageId = headers.messageId;
      const patchIds: string[] = [];
      for (let index = 0; index < detected.patches.length; index += 1) {
        const patchId = `patch:${messageId ?? "ordinal"}:${record.sourceOrdinal}:${index}`;
        patchIds.push(patchId);
        patches.set(
          patchId,
          parseDiff(detected.patches[index].rawText, {
            id: patchId,
            messageId,
            subject: headers.subject,
          }),
        );
      }

      const message: Message = {
        id: messageId ?? `pending:${record.sourceOrdinal}`,
        ...(messageId === undefined ? {} : { messageId }),
        references: headers.references,
        missingAncestorIds: [],
        author: headers.author,
        ...(headers.sender === undefined ? {} : { sender: headers.sender }),
        replyTo: headers.replyTo,
        to: headers.to,
        cc: headers.cc,
        timestamp: headers.timestamp,
        subject: headers.subject,
        mailingLists: headers.mailingLists,
        blocks: [...contentBlocks(detected.preamble), ...patchIds.map((patchId) => ({ kind: "patch" as const, patchId }))],
        patchIds,
        attachmentMetadata: mime.attachments.map((attachment) => ({
          ...(attachment.filename === undefined ? {} : { filename: attachment.filename }),
          contentType: attachment.mimeType,
          disposition: attachment.disposition,
          contentOmitted: true,
        })),
        sourceOrdinal: record.sourceOrdinal,
        diagnostics: headers.diagnostics,
      };
      if (headers.declaredParentMessageId !== undefined) {
        message.declaredParentMessageId = headers.declaredParentMessageId;
      }
      reconstructionRecords.push({ message, rawBytes: record.bytes });
    }

    const thread = await reconstructThread(reconstructionRecords, input.request.source);
    const series = parsePatchSeries(
      Object.values(thread.messages).map((message) => ({
        messageId: message.messageId ?? message.id,
        subject: message.subject,
        patchId: message.patchIds[0],
      })),
    );
    const selected = input.request.requestedMessageId === undefined
      ? undefined
      : Object.values(thread.messages).find((message) => message.messageId === input.request.requestedMessageId);
    if (input.request.requestedMessageId !== undefined && selected === undefined) {
      throw new ThreadParseError(`Requested Message-ID ${input.request.requestedMessageId} was not found in the imported archive.`);
    }
    return {
      ...thread,
      ...(selected === undefined ? {} : { selectedMessageId: selected.id }),
      patches: Object.fromEntries(patches),
      patchSeries: series,
    };
  } catch (error) {
    if (error instanceof ThreadParseError) throw error;
    throw new ThreadParseError("Thread could not be parsed.", { cause: error });
  }
}
