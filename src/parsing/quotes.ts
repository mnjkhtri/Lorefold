import type { ContentBlock, QuoteLine } from "../models/content";

const MAX_QUOTE_DEPTH = 32;
const QUOTE_LINE_PATTERN = /^\s*(>+)(?: ?)(.*)$/u;
const ATTRIBUTION_PATTERN = /(?:wrote|said):\s*$/iu;

interface PendingParagraph {
  lines: string[];
}

function quoteLine(value: string): QuoteLine | undefined {
  const match = value.match(QUOTE_LINE_PATTERN);
  if (match === null) {
    return undefined;
  }
  return {
    depth: Math.min(match[1].length, MAX_QUOTE_DEPTH),
    text: match[2],
  };
}

function addParagraph(blocks: ContentBlock[], pending: PendingParagraph): void {
  if (pending.lines.length > 0) {
    blocks.push({ kind: "paragraph", text: pending.lines.join("\n") });
    pending.lines = [];
  }
}

export function parseQuotes(text: string): ContentBlock[] {
  if (text === "") {
    return [];
  }

  const blocks: ContentBlock[] = [];
  const pending: PendingParagraph = { lines: [] };
  let quoteLines: QuoteLine[] = [];
  let attribution: string | undefined;

  const flushQuote = (): void => {
    if (quoteLines.length === 0) return;
    blocks.push({
      kind: "quote",
      ...(attribution === undefined ? {} : { attribution }),
      lines: quoteLines,
      lineCount: quoteLines.length,
      maximumDepth: Math.max(...quoteLines.map((line) => line.depth)),
    });
    quoteLines = [];
    attribution = undefined;
  };

  const lines = text.split(/\r?\n/u);
  for (const line of lines) {
    const parsedQuote = quoteLine(line);
    if (parsedQuote !== undefined) {
      if (
        pending.lines.length === 1 &&
        ATTRIBUTION_PATTERN.test(pending.lines[0])
      ) {
        attribution = pending.lines[0];
        pending.lines = [];
      } else {
        addParagraph(blocks, pending);
      }
      quoteLines.push(parsedQuote);
      continue;
    }

    flushQuote();
    if (/^[ \t]*$/u.test(line)) {
      addParagraph(blocks, pending);
    } else {
      pending.lines.push(line);
    }
  }

  flushQuote();
  addParagraph(blocks, pending);
  return blocks;
}
