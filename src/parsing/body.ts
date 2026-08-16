import type { DecodedMimeMessage } from "./mime";

export interface SelectedBody {
  text: string;
  source: "plain" | "html" | "empty";
}

const BLOCK_TAG_PATTERN = /^(?:address|article|aside|blockquote|div|dl|dt|dd|fieldset|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul)$/iu;
const REMOVE_TAG_PATTERN = /^(?:audio|base|canvas|embed|form|iframe|img|link|math|meta|object|script|style|svg|template|video)$/iu;

function fallbackHtmlToText(html: string): string {
  const withoutDangerousElements = html
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<(script|style|svg|math|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\/\1>/giu, "")
    .replace(/<(br|hr)\s*\/?>/giu, "\n")
    .replace(/<\/(?:address|article|aside|blockquote|div|dl|dt|dd|fieldset|footer|form|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tr|ul)>/giu, "\n")
    .replace(/<[^>]*>/gu, "");

  return decodeEntities(withoutDangerousElements).replace(/[ \t]+\n/gu, "\n").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/gu, "'");
}

export function htmlToPlainText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return fallbackHtmlToText(html);
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of [...document.querySelectorAll("*")]) {
    if (REMOVE_TAG_PATTERN.test(element.tagName)) {
      element.remove();
      continue;
    }
    if (BLOCK_TAG_PATTERN.test(element.tagName)) {
      element.before("\n");
      element.after("\n");
    }
  }

  return (document.body.textContent ?? "").replace(/[ \t]+\n/gu, "\n").trim();
}

export function selectBody(message: DecodedMimeMessage): SelectedBody {
  if (message.text !== undefined && message.text.trim() !== "") {
    return { text: message.text, source: "plain" };
  }
  if (message.html !== undefined && message.html.trim() !== "") {
    return { text: htmlToPlainText(message.html), source: "html" };
  }
  return { text: "", source: "empty" };
}
