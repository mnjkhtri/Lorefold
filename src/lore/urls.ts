import type { MessageId } from "../models/patch";

const LORE_ORIGIN = "https://lore.kernel.org";
const MAX_MESSAGE_ID_LENGTH = 998;

export interface LoreReference {
  messageId: MessageId;
  canonicalUrl: string;
  mboxUrl: string;
}

export class LoreUrlError extends Error {
  public readonly code = "invalid-lore-reference";

  public constructor(message: string) {
    super(message);
    this.name = "LoreUrlError";
  }
}

function validateMessageId(value: string, allowSlash: boolean): MessageId {
  const messageId = value.startsWith("<") && value.endsWith(">")
    ? value.slice(1, -1)
    : value;
  const hasControlCharacter = Array.from(messageId).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x20 || codePoint === 0x7f);
  });

  if (
    messageId.length === 0 ||
    messageId.length > MAX_MESSAGE_ID_LENGTH ||
    hasControlCharacter ||
    (!allowSlash && messageId.includes("/")) ||
    messageId.includes("\\") ||
    messageId.includes("?") ||
    messageId.includes("#")
  ) {
    throw new LoreUrlError("Message-ID contains an invalid character or length.");
  }

  return messageId;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new LoreUrlError("Message-ID path encoding is malformed.");
  }
}

function referenceFor(messageId: MessageId): LoreReference {
  const encodedId = encodeURIComponent(messageId);
  return {
    messageId,
    canonicalUrl: `${LORE_ORIGIN}/all/${encodedId}/`,
    mboxUrl: `${LORE_ORIGIN}/all/${encodedId}/t.mbox.gz`,
  };
}

function parseLoreUrl(input: string): LoreReference {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new LoreUrlError("Input is not a valid URL or Message-ID.");
  }

  if (
    url.origin !== LORE_ORIGIN ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new LoreUrlError("URL must use the exact HTTPS Lore host.");
  }

  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  let encodedMessageId: string | undefined;

  if (segments.length === 2 && segments[0] === "r") {
    encodedMessageId = segments[1];
  } else if (segments.length === 2 && segments[0] === "all") {
    encodedMessageId = segments[1];
  } else if (segments.length === 2) {
    encodedMessageId = segments[1];
  }

  if (encodedMessageId === undefined) {
    throw new LoreUrlError("URL does not contain one supported Lore Message-ID segment.");
  }

  return referenceFor(validateMessageId(decodeSegment(encodedMessageId), true));
}

export function parseLoreReference(input: string): LoreReference {
  const value = input.trim();
  if (value === "") {
    throw new LoreUrlError("Input is empty.");
  }

  if (/^https?:\/\//iu.test(value)) {
    return parseLoreUrl(value);
  }

  if (value.includes("/") || value.includes("://")) {
    throw new LoreUrlError("Bare Message-ID must not contain a path.");
  }

  return referenceFor(validateMessageId(value, false));
}
