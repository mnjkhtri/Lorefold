import type { ContentBlock } from "../models/content";
import type { Thread, ThreadRequest } from "../models/thread";
import type { Patch } from "../models/patch";
import { detectPatches } from "./patch-detection";
import { parseDiff } from "./diff";
import { parseQuotes } from "./quotes";
import { parseSignatureAndCode } from "./signature-code";
import { parsePatchSeries } from "./trailers-series";
import { reconstructThread, type ReconstructionRecord } from "./reconstruction";
import type { ParsedWorkerRecord } from "./worker-protocol";

function contentBlocks(text: string): ContentBlock[] {
  return parseQuotes(text).flatMap((block) => {
    if (block.kind !== "paragraph") return [block];
    return parseSignatureAndCode(block.text);
  });
}

export async function projectParsedRecords(
  records: readonly ParsedWorkerRecord[],
  request: ThreadRequest,
): Promise<Thread> {
  const reconstructionRecords: ReconstructionRecord[] = [];
  const patches = new Map<string, Patch>();

  for (const record of records) {
    const messageId = record.headers.messageId;
    const detected = detectPatches(record.body.text);
    const patchIds: string[] = [];
    for (let index = 0; index < detected.patches.length; index += 1) {
      const patchId = `patch:${messageId ?? "ordinal"}:${record.sourceOrdinal}:${index}`;
      patchIds.push(patchId);
      patches.set(patchId, parseDiff(detected.patches[index].rawText, {
        id: patchId,
        messageId,
        subject: record.headers.subject,
      }));
    }

    const message = {
      id: messageId ?? `pending:${record.sourceOrdinal}`,
      ...(messageId === undefined ? {} : { messageId }),
      ...(record.headers.declaredParentMessageId === undefined
        ? {}
        : { declaredParentMessageId: record.headers.declaredParentMessageId }),
      references: record.headers.references,
      missingAncestorIds: [],
      author: record.headers.author,
      timestamp: record.headers.timestamp,
      subject: record.headers.subject,
      mailingLists: record.headers.mailingLists,
      blocks: [
        ...contentBlocks(detected.preamble),
        ...patchIds.map((patchId) => ({ kind: "patch" as const, patchId })),
      ],
      patchIds,
      attachmentMetadata: record.mime.attachments.map((attachment) => ({
        ...(attachment.filename === undefined ? {} : { filename: attachment.filename }),
        contentType: attachment.mimeType,
        disposition: attachment.disposition,
        contentOmitted: true,
      })),
      sourceOrdinal: record.sourceOrdinal,
      diagnostics: record.headers.diagnostics,
    };
    reconstructionRecords.push({
      message,
      rawBytes: new TextEncoder().encode(record.rawText),
    });
  }

  const thread = await reconstructThread(reconstructionRecords, request.source);
  const patchSeries = parsePatchSeries(Object.values(thread.messages).map((message) => ({
    messageId: message.messageId ?? message.id,
    subject: message.subject,
    patchId: message.patchIds[0],
  })));
  const selected = request.requestedMessageId === undefined
    ? undefined
    : Object.values(thread.messages).find((message) => message.messageId === request.requestedMessageId);
  if (request.requestedMessageId !== undefined && selected === undefined) {
    throw new Error(`Requested Message-ID ${request.requestedMessageId} was not found in the imported archive.`);
  }
  return {
    ...thread,
    ...(selected === undefined ? {} : { selectedMessageId: selected.id }),
    patches: Object.fromEntries(patches),
    patchSeries,
  };
}
