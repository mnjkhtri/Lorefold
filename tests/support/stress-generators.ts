import type { RawThreadEnvelope } from "../../src/models/thread";

const textEncoder = new TextEncoder();

export function makeStressEnvelope(count = 500, depth = 100): RawThreadEnvelope {
  const records = Array.from({ length: count }, (_, index) => {
    const id = `stress-${index}@example.test`;
    const parentIndex = index > 0 && index <= depth ? index - 1 : undefined;
    const references = parentIndex === undefined ? "" : `References: <stress-${parentIndex}@example.test>\r\n`;
    const raw = [
      `From: Author ${index} <author-${index}@example.test>`,
      `Subject: Stress message ${index}`,
      `Message-ID: <${id}>`,
      `Date: Thu, 01 Jan 2026 00:00:${String(index % 60).padStart(2, "0")} +0000`,
      references.trimEnd(),
      "",
      `Generated message ${index}.`,
      "",
    ].filter((line) => line !== "").join("\r\n");
    return { sourceOrdinal: index, bytes: textEncoder.encode(`${raw}\r\n`) };
  });
  return {
    request: {
      source: { kind: "static-generated", contentDigest: "stress-fixture" },
    },
    records,
  };
}

export function makeLargePatch(lineCount = 10_000): string {
  const lines = Array.from({ length: lineCount }, (_, index) => `+generated line ${index}`);
  return [
    "diff --git a/generated.txt b/generated.txt",
    "--- a/generated.txt",
    "+++ b/generated.txt",
    `@@ -0,0 +1,${lineCount} @@`,
    ...lines,
  ].join("\n");
}
