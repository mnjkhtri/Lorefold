export interface PatchCandidate {
  text: string;
  source: "body" | "attachment";
}

export interface DetectedPatch {
  rawText: string;
  source: PatchCandidate["source"];
}

export interface PatchDetectionResult {
  preamble: string;
  patches: DetectedPatch[];
}

const GIT_DIFF_PATTERN = /^diff --git \S+ \S+$/u;
const OLD_FILE_PATTERN = /^--- (?:a\/|\/dev\/null)/u;
const NEW_FILE_PATTERN = /^\+\+\+ (?:b\/|\/dev\/null)/u;
const HUNK_PATTERN = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/u;
const BINARY_PATTERN = /^(?:Binary files .* differ|GIT binary patch)$/u;

function hasCoherentSyntax(lines: string[]): boolean {
  const hasGitHeader = lines.some((line) => GIT_DIFF_PATTERN.test(line));
  const hasUnifiedHeaders = lines.some((line) => OLD_FILE_PATTERN.test(line)) &&
    lines.some((line) => NEW_FILE_PATTERN.test(line));
  const hasHunkOrBinary = lines.some((line) => HUNK_PATTERN.test(line) || BINARY_PATTERN.test(line));
  return (hasGitHeader || hasUnifiedHeaders) && hasHunkOrBinary;
}

function bodyPatch(candidate: PatchCandidate): DetectedPatch[] {
  const lines = candidate.text.split(/\r?\n/u);
  const gitStarts = lines.flatMap((line, index) =>
    GIT_DIFF_PATTERN.test(line) ? [index] : [],
  );
  const starts = gitStarts.length > 0
    ? gitStarts
    : lines.flatMap((line, index) => OLD_FILE_PATTERN.test(line) ? [index] : []);
  const patches: DetectedPatch[] = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1] ?? lines.length;
    const region = lines.slice(start, end);
    if (hasCoherentSyntax(region)) {
      patches.push({ rawText: region.join("\n"), source: candidate.source });
    }
  }
  return patches;
}

export function detectPatches(
  body: string,
  attachments: readonly PatchCandidate[] = [],
): PatchDetectionResult {
  const bodyCandidate: PatchCandidate = { text: body, source: "body" };
  const bodyPatches = bodyPatch(bodyCandidate);
  const firstBodyStart = bodyPatches.length === 0
    ? -1
    : body.indexOf(bodyPatches[0].rawText.split("\n")[0]);

  return {
    preamble: firstBodyStart < 0 ? body : body.slice(0, firstBodyStart).trimEnd(),
    patches: [...bodyPatches, ...attachments.flatMap(bodyPatch)],
  };
}
