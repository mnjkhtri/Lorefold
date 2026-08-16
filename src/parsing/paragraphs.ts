import type { ContentBlock } from "../models/content";

export function parseParagraphs(text: string): ContentBlock[] {
  if (text === "") {
    return [];
  }

  const paragraphs: ContentBlock[] = [];
  const lines = text.split(/\r?\n/u);
  let current: string[] = [];

  const flush = (): void => {
    if (current.length > 0) {
      paragraphs.push({ kind: "paragraph", text: current.join("\n") });
      current = [];
    }
  };

  for (const line of lines) {
    if (/^[ \t]*$/u.test(line)) {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();
  return paragraphs;
}
