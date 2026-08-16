import type { DiffFile, DiffHunk, Patch } from "../models/patch";

const HUNK_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

interface FileRegion {
  lines: string[];
}

function pathFromHeader(line: string, prefix: string): string | undefined {
  const value = line.slice(prefix.length).split("\t", 1)[0];
  if (value === "/dev/null") return undefined;
  return value.startsWith(prefix === "--- " ? "a/" : "b/") ? value.slice(2) : value;
}

function splitFileRegions(lines: string[]): FileRegion[] {
  const starts = lines.flatMap((line, index) => line.startsWith("diff --git ") ? [index] : []);
  if (starts.length === 0) return [{ lines }];
  return starts.map((start, index) => ({ lines: lines.slice(start, starts[index + 1] ?? lines.length) }));
}

function parseHunkLines(lines: string[], hunk: DiffHunk): void {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  for (const line of lines) {
    if (line.startsWith("\\")) {
      hunk.lines.push({ kind: "metadata", text: line });
      continue;
    }
    const marker = line[0];
    const content = line.slice(1);
    if (marker === "+") {
      hunk.lines.push({ kind: "addition", text: content, newLine });
      newLine += 1;
    } else if (marker === "-") {
      hunk.lines.push({ kind: "deletion", text: content, oldLine });
      oldLine += 1;
    } else if (marker === " ") {
      hunk.lines.push({ kind: "context", text: content, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else {
      hunk.lines.push({ kind: "metadata", text: line });
    }
  }
}

function parseHunks(lines: string[]): DiffHunk[] {
  const starts = lines.flatMap((line, index) => HUNK_PATTERN.test(line) ? [index] : []);
  return starts.map((start, index) => {
    const match = lines[start].match(HUNK_PATTERN);
    if (match === null) throw new Error("Internal hunk match failure.");
    const hunk: DiffHunk = {
      header: lines[start],
      oldStart: Number(match[1]),
      oldCount: Number(match[2] ?? "1"),
      newStart: Number(match[3]),
      newCount: Number(match[4] ?? "1"),
      lines: [],
    };
    parseHunkLines(lines.slice(start + 1, starts[index + 1] ?? lines.length), hunk);
    return hunk;
  });
}

function parseFile(region: FileRegion): DiffFile {
  const oldHeader = region.lines.find((line) => line.startsWith("--- "));
  const newHeader = region.lines.find((line) => line.startsWith("+++ "));
  const oldPath = oldHeader === undefined ? undefined : pathFromHeader(oldHeader, "--- ");
  const newPath = newHeader === undefined ? undefined : pathFromHeader(newHeader, "+++ ");
  const renameFrom = region.lines.find((line) => line.startsWith("rename from "))?.slice(12);
  const renameTo = region.lines.find((line) => line.startsWith("rename to "))?.slice(10);
  const copyFrom = region.lines.find((line) => line.startsWith("copy from "))?.slice(10);
  const copyTo = region.lines.find((line) => line.startsWith("copy to "))?.slice(8);
  const binary = region.lines.some((line) => line.startsWith("Binary files ") || line === "GIT binary patch");
  const hunks = parseHunks(region.lines);
  const similarityValue = region.lines.find((line) => line.startsWith("similarity index "))?.match(/(\d+)%/u)?.[1];
  const status: DiffFile["status"] = binary
    ? "binary"
    : renameFrom !== undefined || renameTo !== undefined
      ? "renamed"
      : copyFrom !== undefined || copyTo !== undefined
        ? "copied"
        : oldPath === undefined
          ? "added"
          : newPath === undefined
            ? "deleted"
            : "modified";

  return {
    oldPath: renameFrom ?? copyFrom ?? oldPath,
    newPath: renameTo ?? copyTo ?? newPath,
    displayPath: newPath ?? oldPath ?? renameTo ?? renameFrom ?? copyTo ?? copyFrom ?? "(unknown file)",
    status,
    ...(region.lines.find((line) => line.startsWith("old mode "))?.slice(9) === undefined
      ? {}
      : { oldMode: region.lines.find((line) => line.startsWith("old mode "))?.slice(9) }),
    ...(region.lines.find((line) => line.startsWith("new mode "))?.slice(9) === undefined
      ? {}
      : { newMode: region.lines.find((line) => line.startsWith("new mode "))?.slice(9) }),
    ...(similarityValue === undefined ? {} : { similarity: Number(similarityValue) }),
    hunks,
    binary,
  };
}

export function parseDiff(
  rawText: string,
  options: { id: string; messageId?: string; subject?: string } = { id: "patch" },
): Patch {
  const lines = rawText.split(/\r?\n/u);
  const regions = splitFileRegions(lines);
  const diagnostics = [];
  const files = regions
    .map(parseFile)
    .filter((file) => file.hunks.length > 0 || file.binary || file.oldPath !== undefined || file.newPath !== undefined);
  if (files.length === 0) {
    diagnostics.push({
      code: "malformed-diff",
      severity: "warning" as const,
      message: "Patch contains no recognizable file or hunk structure; raw text was retained.",
    });
  }

  const additions = files.flatMap((file) => file.hunks).flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "addition").length;
  const deletions = files.flatMap((file) => file.hunks).flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "deletion").length;

  return {
    id: options.id,
    ...(options.messageId === undefined ? {} : { messageId: options.messageId }),
    subject: options.subject ?? "",
    commitMessage: [],
    files,
    trailers: [],
    rawText,
    statistics: { files: files.length, additions, deletions },
    diagnostics,
  };
}
