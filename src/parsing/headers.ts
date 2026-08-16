import type { Author, MailingList, ParsedTimestamp } from "../models/content";
import type { MessageId, ParseDiagnostic } from "../models/patch";
import type { DecodedMimeMessage, MimeAddress, MimeHeader } from "./mime";

const DEFAULT_MAX_REFERENCES = 100;
const MESSAGE_ID_PATTERN = /<([^<>\s]+)>/gu;

export interface NormalizedHeaders {
  rawHeaders: MimeHeader[];
  author: Author;
  timestamp: ParsedTimestamp;
  subject: string;
  messageId?: MessageId;
  declaredParentMessageId?: MessageId;
  references: MessageId[];
  mailingLists: MailingList[];
  diagnostics: ParseDiagnostic[];
}

function firstAddress(address: MimeAddress | undefined): Author {
  if (address === undefined) {
    return { name: "" };
  }
  if (address.address !== undefined) {
    return { name: address.name, address: address.address };
  }
  const groupMember = address.group?.[0];
  return groupMember === undefined ? { name: address.name } : firstAddress(groupMember);
}

function normalizeMessageId(value: string | undefined): MessageId | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  const bracketed = trimmed.match(/^<([^<>\s]+)>$/u);
  const result = bracketed?.[1] ?? trimmed;
  return result === "" || /[\s<>]/u.test(result) ? undefined : result;
}

function parseReferences(value: string | undefined): MessageId[] {
  if (value === undefined) {
    return [];
  }

  const bracketed = [...value.matchAll(MESSAGE_ID_PATTERN)].map((match) => match[1]);
  if (bracketed.length > 0) {
    return bracketed.flatMap((id) => {
      const normalized = normalizeMessageId(id);
      return normalized === undefined ? [] : [normalized];
    });
  }

  return value.split(/\s+/u).flatMap((token) => {
    const normalized = normalizeMessageId(token);
    return normalized === undefined ? [] : [normalized];
  });
}

function headerValue(headers: MimeHeader[], key: string): string | undefined {
  return headers.find((header) => header.key === key)?.value;
}

function parseTimestamp(raw: string | undefined, diagnostics: ParseDiagnostic[]): ParsedTimestamp {
  if (raw === undefined) {
    return { valid: false };
  }

  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    diagnostics.push({
      code: "invalid-date",
      severity: "warning",
      message: "Date header could not be parsed.",
    });
    return { raw, valid: false };
  }

  return { raw, iso: new Date(timestamp).toISOString(), valid: true };
}

function parseMailingLists(headers: MimeHeader[]): MailingList[] {
  const lists: MailingList[] = [];
  for (const header of headers.filter((item) => item.key === "list-id")) {
    const match = header.value.match(/^(?:"([^"]+)"\s*)?<([^<>]+)>$/u);
    if (match === null) {
      lists.push({ id: header.value.trim(), displayName: header.value.trim() });
      continue;
    }
    lists.push({ id: match[2], displayName: match[1] ?? match[2] });
  }

  const listPost = headerValue(headers, "list-post")?.match(/mailto:([^>\s]+)/iu)?.[1];
  if (listPost !== undefined && lists.length > 0) {
    lists[0] = { ...lists[0], address: listPost };
  }
  return lists;
}

export function normalizeHeaders(
  message: DecodedMimeMessage,
  options: { maxReferences?: number; sourceOrdinal?: number } = {},
): NormalizedHeaders {
  const diagnostics: ParseDiagnostic[] = [];
  const maxReferences = options.maxReferences ?? DEFAULT_MAX_REFERENCES;
  const references = parseReferences(message.references);
  if (references.length > maxReferences) {
    diagnostics.push({
      code: "references-truncated",
      severity: "warning",
      message: `References exceeded the ${maxReferences} item limit and were truncated.`,
      sourceOrdinal: options.sourceOrdinal,
    });
  }

  return {
    rawHeaders: message.headers.map((header) => ({ ...header })),
    author: firstAddress(message.from),
    timestamp: parseTimestamp(message.date, diagnostics),
    subject: message.subject ?? "",
    messageId: normalizeMessageId(message.messageId),
    declaredParentMessageId: normalizeMessageId(message.inReplyTo),
    references: references.slice(0, maxReferences),
    mailingLists: parseMailingLists(message.headers),
    diagnostics,
  };
}
