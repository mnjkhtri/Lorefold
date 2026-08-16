import type { Message, SourceDescriptor, Thread } from "../models/thread";
import type { MessageId, ParseDiagnostic } from "../models/patch";

export interface ReconstructionRecord {
  message: Message;
  rawBytes?: Uint8Array;
}

function compareMessages(left: Message, right: Message): number {
  if (left.timestamp.valid && right.timestamp.valid) {
    const timestampOrder = (left.timestamp.iso ?? "").localeCompare(right.timestamp.iso ?? "");
    if (timestampOrder !== 0) return timestampOrder;
  } else if (left.timestamp.valid !== right.timestamp.valid) {
    return left.timestamp.valid ? -1 : 1;
  }
  return left.sourceOrdinal - right.sourceOrdinal || left.id.localeCompare(right.id);
}

function bytesEqual(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function digest(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle !== undefined) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function candidateIds(message: Message): MessageId[] {
  const candidates = [
    ...(message.declaredParentMessageId === undefined ? [] : [message.declaredParentMessageId]),
    ...message.references.slice().reverse(),
  ];
  return [...new Set(candidates.filter((candidate) => candidate !== message.messageId))];
}

function cycleNodes(messages: Record<string, Message>): Message[][] {
  const found: Message[][] = [];
  const completed = new Set<string>();
  for (const start of Object.values(messages)) {
    if (completed.has(start.id)) continue;
    const path: Message[] = [];
    const positions = new Map<string, number>();
    let current: Message | undefined = start;
    while (current !== undefined && !completed.has(current.id)) {
      const position = positions.get(current.id);
      if (position !== undefined) {
        found.push(path.slice(position));
        break;
      }
      positions.set(current.id, path.length);
      path.push(current);
      current = current.parentId === undefined ? undefined : messages[current.parentId];
    }
    path.forEach((message) => completed.add(message.id));
  }
  return found;
}

function syntheticMessageId(record: ReconstructionRecord, index: number): Promise<string> {
  const bytes = record.rawBytes ?? new TextEncoder().encode(JSON.stringify(record.message));
  return digest(bytes).then((hash) => `synthetic:${hash}:${index}`);
}

export async function reconstructThread(
  records: readonly ReconstructionRecord[],
  source: SourceDescriptor,
): Promise<Thread> {
  const diagnostics: ParseDiagnostic[] = [];
  const normalized: Message[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const message = { ...record.message, references: [...record.message.references], diagnostics: [...record.message.diagnostics] };
    if (message.messageId === undefined) {
      message.id = await syntheticMessageId(record, message.sourceOrdinal);
    } else {
      message.id = message.messageId;
    }
    normalized.push(message);
  }

  const byId = new Map<string, Message>();
  const rawById = new Map<string, Uint8Array | undefined>();
  for (let index = 0; index < normalized.length; index += 1) {
    const message = normalized[index];
    if (message.messageId === undefined) {
      byId.set(message.id, message);
      rawById.set(message.id, records[index].rawBytes);
      continue;
    }
    const existing = byId.get(message.messageId);
    if (existing === undefined) {
      byId.set(message.messageId, message);
      rawById.set(message.messageId, records[index].rawBytes);
    } else if (!bytesEqual(rawById.get(message.messageId), records[index].rawBytes)) {
      diagnostics.push({
        code: "conflicting-duplicate-message-id",
        severity: "warning",
        message: `Conflicting records for ${message.messageId}; first source-order record retained.`,
        messageId: message.messageId,
        sourceOrdinal: message.sourceOrdinal,
      });
    }
  }

  const messages = Object.fromEntries([...byId.entries()].map(([id, message]) => [id, { ...message }]));
  const exactIds = new Set(Object.keys(messages));
  const aliasCounts = new Map<string, string[]>();
  for (const message of Object.values(messages)) {
    if (message.messageId === undefined) continue;
    const at = message.messageId.lastIndexOf("@");
    if (at < 1 || at === message.messageId.length - 1) continue;
    const alias = `${message.messageId.slice(0, at)}@${message.messageId.slice(at + 1).toLowerCase()}`;
    aliasCounts.set(alias, [...(aliasCounts.get(alias) ?? []), message.id]);
  }

  for (const message of Object.values(messages)) {
    const missingAncestorIds: MessageId[] = [];
    message.parentId = undefined;
    for (const candidate of candidateIds(message)) {
      let parent = exactIds.has(candidate) ? candidate : undefined;
      if (parent === undefined) {
        const at = candidate.lastIndexOf("@");
        const alias = at > 0 ? `${candidate.slice(0, at)}@${candidate.slice(at + 1).toLowerCase()}` : candidate;
        const matches = aliasCounts.get(alias) ?? [];
        parent = matches.length === 1 ? matches[0] : undefined;
      }
      if (parent !== undefined && parent !== message.id) {
        message.parentId = parent;
        break;
      }
      missingAncestorIds.push(candidate);
    }
    message.missingAncestorIds = missingAncestorIds;
  }

  for (const cycle of cycleNodes(messages)) {
    const detached = cycle.slice().sort(compareMessages)[0];
    detached.parentId = undefined;
    detached.diagnostics = [
      ...detached.diagnostics,
      {
        code: "cycle-repaired",
        severity: "warning",
        message: "Reply cycle repaired by detaching the earliest message.",
        messageId: detached.messageId,
        sourceOrdinal: detached.sourceOrdinal,
      },
    ];
  }

  const childrenByParent: Record<string, string[]> = {};
  for (const message of Object.values(messages)) {
    if (message.parentId !== undefined) {
      childrenByParent[message.parentId] ??= [];
      childrenByParent[message.parentId].push(message.id);
    }
  }
  for (const children of Object.values(childrenByParent)) {
    children.sort((left, right) => compareMessages(messages[left], messages[right]));
  }
  const rootIds = Object.values(messages)
    .filter((message) => message.parentId === undefined)
    .sort(compareMessages)
    .map((message) => message.id);
  const chronologicalIds = Object.values(messages).sort(compareMessages).map((message) => message.id);

  return {
    schemaVersion: 1,
    id: `thread:${source.contentDigest}`,
    source,
    subject: Object.values(messages)[0]?.subject ?? "",
    messages,
    rootIds,
    childrenByParent,
    chronologicalIds,
    patchSeries: [],
    diagnostics,
  };
}
