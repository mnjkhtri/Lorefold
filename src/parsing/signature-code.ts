import type { ContentBlock } from "../models/content";

const TRACE_LINE_PATTERN = /^(?:Traceback \(most recent call last\):|\s+at\s+\S+|[A-Za-z_][\w.]+:\s+.+)$/u;
const FENCE_PATTERN = /^\s*```([^`]*)\s*$/u;

function isIndentedCode(line: string): boolean {
  return /^\t| {4}/u.test(line);
}

function isTraceLine(line: string): boolean {
  return TRACE_LINE_PATTERN.test(line);
}

export function parseSignatureAndCode(text: string): ContentBlock[] {
  if (text === "") return [];

  const blocks: ContentBlock[] = [];
  let prose: string[] = [];
  let code: string[] = [];
  let codeLanguage: string | undefined;
  let inFence = false;

  const flushProse = (): void => {
    if (prose.length > 0) {
      blocks.push({ kind: "paragraph", text: prose.join("\n") });
      prose = [];
    }
  };
  const flushCode = (): void => {
    if (code.length > 0) {
      blocks.push({
        kind: "code",
        text: code.join("\n"),
        ...(codeLanguage === undefined ? {} : { languageHint: codeLanguage }),
      });
      code = [];
      codeLanguage = undefined;
    }
  };

  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!inFence && line === "-- ") {
      flushCode();
      flushProse();
      const signatureLines = lines.slice(index + 1);
      if (signatureLines.length > 0) {
        blocks.push({
          kind: "signature",
          text: signatureLines.join("\n"),
          lineCount: signatureLines.length,
        });
      }
      break;
    }

    const fence = line.match(FENCE_PATTERN);
    if (fence !== null) {
      if (inFence) {
        inFence = false;
        flushCode();
      } else {
        flushProse();
        inFence = true;
        codeLanguage = fence[1] === "" ? undefined : fence[1];
      }
      continue;
    }

    if (inFence || isIndentedCode(line) || isTraceLine(line)) {
      flushProse();
      code.push(line);
    } else if (/^[ \t]*$/u.test(line)) {
      flushCode();
      flushProse();
    } else {
      flushCode();
      prose.push(line);
    }
  }

  flushCode();
  flushProse();
  return blocks;
}
