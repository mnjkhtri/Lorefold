import PostalMime, {
  type Address,
  type Attachment,
  type Header,
} from "postal-mime";

import { MAX_HEADER_BYTES, MAX_MIME_NESTING_DEPTH, MAX_RAW_MESSAGE_BYTES } from "./limits";

export interface MimeAddress {
  name: string;
  address?: string;
  group?: MimeAddress[];
}

export interface MimeHeader {
  key: string;
  originalKey: string;
  value: string;
}

export interface MimeAttachmentMetadata {
  filename?: string;
  mimeType: string;
  disposition: "attachment" | "inline" | "unknown";
  related: boolean;
  description?: string;
  contentId?: string;
  rfc822DepthExceeded: boolean;
}

export interface DecodedMimeMessage {
  headers: MimeHeader[];
  subject?: string;
  from?: MimeAddress;
  sender?: MimeAddress;
  replyTo: MimeAddress[];
  to: MimeAddress[];
  cc: MimeAddress[];
  date?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  text?: string;
  html?: string;
  attachments: MimeAttachmentMetadata[];
}

export class MimeParseError extends Error {
  public readonly code = "mime-parse-error";

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MimeParseError";
  }
}

function normalizeAddress(address: Address): MimeAddress {
  if ("address" in address) {
    return { name: address.name, address: address.address };
  }

  return {
    name: address.name,
    group: address.group.map(normalizeAddress),
  };
}

function normalizeAttachment(attachment: Attachment): MimeAttachmentMetadata {
  return {
    ...(attachment.filename === null ? {} : { filename: attachment.filename }),
    mimeType: attachment.mimeType,
    disposition: attachment.disposition ?? "unknown",
    related: attachment.related ?? false,
    ...(attachment.description === undefined ? {} : { description: attachment.description }),
    ...(attachment.contentId === undefined ? {} : { contentId: attachment.contentId }),
    rfc822DepthExceeded: attachment.rfc822DepthExceeded ?? false,
  };
}

function normalizeHeaders(headers: Header[]): MimeHeader[] {
  return headers.map(({ key, originalKey, value }) => ({ key, originalKey, value }));
}

function normalizeAddresses(addresses: Address[] | undefined): MimeAddress[] {
  return addresses?.map(normalizeAddress) ?? [];
}

export async function parseMimeMessage(
  raw: Uint8Array,
  options: {
    maxRawBytes?: number;
    maxHeaderBytes?: number;
    maxNestingDepth?: number;
  } = {},
): Promise<DecodedMimeMessage> {
  const maxRawBytes = options.maxRawBytes ?? MAX_RAW_MESSAGE_BYTES;
  if (raw.byteLength > maxRawBytes) {
    throw new MimeParseError("Raw message exceeds the configured limit.");
  }

  try {
    const email = await PostalMime.parse(raw, {
      maxHeadersSize: options.maxHeaderBytes ?? MAX_HEADER_BYTES,
      maxNestingDepth: options.maxNestingDepth ?? MAX_MIME_NESTING_DEPTH,
      attachmentEncoding: "arraybuffer",
    });

    return {
      headers: normalizeHeaders(email.headers),
      ...(email.subject === undefined ? {} : { subject: email.subject }),
      ...(email.from === undefined ? {} : { from: normalizeAddress(email.from) }),
      ...(email.sender === undefined ? {} : { sender: normalizeAddress(email.sender) }),
      replyTo: normalizeAddresses(email.replyTo),
      to: normalizeAddresses(email.to),
      cc: normalizeAddresses(email.cc),
      ...(email.date === undefined ? {} : { date: email.date }),
      ...(email.messageId === undefined ? {} : { messageId: email.messageId }),
      ...(email.inReplyTo === undefined ? {} : { inReplyTo: email.inReplyTo }),
      ...(email.references === undefined ? {} : { references: email.references }),
      ...(email.text === undefined ? {} : { text: email.text }),
      ...(email.html === undefined ? {} : { html: email.html }),
      attachments: email.attachments.map(normalizeAttachment),
    };
  } catch (error) {
    if (error instanceof MimeParseError) {
      throw error;
    }
    throw new MimeParseError("RFC822/MIME message could not be parsed.", { cause: error });
  }
}
