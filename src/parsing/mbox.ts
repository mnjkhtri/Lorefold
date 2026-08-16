import type { RawMessageRecord } from "../models/thread";

const WEEKDAYS = "(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)";
const ENVELOPE_PATTERN = new RegExp(
  `^From\\s+\\S+\\s+${WEEKDAYS}\\s+[A-Z][a-z]{2}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2}\\s+\\d{4}\\s*$`,
  "u",
);

function splitLines(text: string): string[] {
  return text.match(/[^\n]*(?:\n|$)/gu)?.filter((line) => line !== "") ?? [];
}

function lineText(line: string): string {
  return line.endsWith("\n") ? line.slice(0, -1).replace(/\r$/u, "") : line;
}

function unescapeMboxrdBody(lines: string[]): string[] {
  return lines.map((line) => {
    if (line.startsWith(">From ")) {
      return line.slice(1);
    }
    return line;
  });
}

function encodeRecord(lines: string[]): Uint8Array {
  return new TextEncoder().encode(unescapeMboxrdBody(lines).join(""));
}

export function splitMbox(input: Uint8Array): RawMessageRecord[] {
  if (input.byteLength === 0) {
    return [];
  }

  const text = new TextDecoder().decode(input);
  const lines = splitLines(text);
  const records: RawMessageRecord[] = [];
  let current: string[] | undefined;
  let sourceOrdinal = 0;

  for (const line of lines) {
    if (ENVELOPE_PATTERN.test(lineText(line))) {
      if (current !== undefined && current.length > 0) {
        records.push({ bytes: encodeRecord(current), sourceOrdinal });
        sourceOrdinal += 1;
      }
      current = [];
      continue;
    }

    if (current === undefined) {
      current = [];
    }
    current.push(line);
  }

  if (current !== undefined && current.length > 0) {
    records.push({ bytes: encodeRecord(current), sourceOrdinal });
  }

  return records;
}
