import type { PatchSeries, Trailer } from "../models/patch";

const TRAILER_PATTERN = /^([A-Za-z][A-Za-z0-9-]{0,63}):[ \t]+(.+)$/u;
const SERIES_PATTERN = /^\[(?:(?:RFC|RESEND)[ \t]+)?PATCH(?:[ \t]+v(\d+))?[ \t]+(\d+)\/(\d+)\][ \t]*(.*)$/iu;
const COVER_PATTERN = /^\[(?:(?:RFC|RESEND)[ \t]+)?PATCH(?:[ \t]+v(\d+))?[ \t]+0\/(\d+)\][ \t]*(.*)$/iu;

export interface TrailerParseResult {
  body: string;
  trailers: Trailer[];
}

export interface SeriesMessage {
  messageId: string;
  subject: string;
  patchId?: string;
}

export function parseTerminalTrailers(text: string): TrailerParseResult {
  const lines = text.split(/\r?\n/u);
  let end = lines.length;
  while (end > 0 && /^[ \t]*$/u.test(lines[end - 1])) end -= 1;

  const reversed: Trailer[] = [];
  let index = end;
  while (index > 0) {
    const continuationLines: string[] = [];
    while (index > 0 && /^[ \t]+\S/u.test(lines[index - 1])) {
      continuationLines.unshift(lines[index - 1]);
      index -= 1;
    }
    if (index === 0) break;
    const match = lines[index - 1].match(TRAILER_PATTERN);
    if (match === null || match[1].toLowerCase() === "cc") break;
    reversed.push({ key: match[1], value: match[2], continuationLines });
    index -= 1;
  }

  const trailers = reversed.reverse();
  const bodyEnd = trailers.length === 0 ? lines.length : index;
  return { body: lines.slice(0, bodyEnd).join("\n").replace(/[\r\n]+$/u, ""), trailers };
}

function seriesKey(version: number, stem: string): string {
  return `${version}:${stem.toLowerCase()}`;
}

export function parsePatchSeries(messages: readonly SeriesMessage[]): PatchSeries[] {
  const groups = new Map<string, {
    version: number;
    total: number;
    stem: string;
    members: SeriesMessage[];
    cover?: SeriesMessage;
  }>();

  for (const message of messages) {
    const cover = message.subject.match(COVER_PATTERN);
    const numbered = message.subject.match(SERIES_PATTERN);
    const match = cover ?? numbered;
    if (match === null) continue;
    const version = Number(match[1] ?? "1");
    const total = Number(cover === null ? match[3] : match[2]);
    const stem = (cover === null ? match[4] : match[3]).trim();
    const key = `${version}/${total}`;
    const group = groups.get(key) ?? { version, total, stem, members: [] };
    group.total = Math.max(group.total, total);
    if (cover !== null) {
      group.cover = message;
      group.stem = stem;
    } else {
      group.members.push(message);
      if (group.stem === "") group.stem = stem;
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const members = group.members
      .map((message) => {
        const match = message.subject.match(SERIES_PATTERN);
        return {
          index: Number(match?.[2] ?? 0),
          messageId: message.messageId,
          ...(message.patchId === undefined ? {} : { patchId: message.patchId }),
        };
      })
      .sort((left, right) => left.index - right.index || left.messageId.localeCompare(right.messageId));
    return {
      id: seriesKey(group.version, group.stem),
      version: group.version,
      total: group.total,
      subjectStem: group.stem,
      ...(group.cover === undefined ? {} : { coverMessageId: group.cover.messageId }),
      members,
      incomplete: new Set(members.map((member) => member.index)).size !== group.total ||
        members.some((member) => member.index < 1 || member.index > group.total),
    };
  });
}
