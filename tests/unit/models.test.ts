import { describe, expect, it } from "vitest";

import type { ContentBlock } from "../../src/models/content";
import type { Thread } from "../../src/models/thread";

function renderBlock(block: ContentBlock): string {
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "quote":
      return block.lines.map((line) => line.text).join("\n");
    case "code":
      return block.text;
    case "patch":
      return block.patchId;
    case "signature":
      return block.text;
    default:
      return assertNever(block);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled content block: ${String(value)}`);
}

describe("core models", () => {
  it("structured-clones a complete serializable thread", () => {
    const blocks: ContentBlock[] = [
      { kind: "paragraph", text: "New text" },
      {
        kind: "quote",
        lines: [{ depth: 1, text: "Quoted text" }],
        lineCount: 1,
        maximumDepth: 1,
      },
      { kind: "code", text: "const value = 1;", languageHint: "ts" },
      { kind: "patch", patchId: "patch-1" },
      { kind: "signature", text: "-- \nAuthor", lineCount: 2 },
    ];
    const thread: Thread = {
      schemaVersion: 1,
      id: "thread-1",
      source: { kind: "local-file", contentDigest: "sha256:fixture" },
      subject: "A test thread",
      messages: {
        "message-1": {
          id: "message-1",
          messageId: "<message-1@example.test>",
          references: [],
          missingAncestorIds: [],
          author: { name: "Example" },
          timestamp: { valid: true, iso: "2026-01-01T00:00:00.000Z" },
          subject: "A test thread",
          mailingLists: [],
          blocks,
          patchIds: ["patch-1"],
          attachmentMetadata: [],
          sourceOrdinal: 0,
          diagnostics: [],
        },
      },
      rootIds: ["message-1"],
      childrenByParent: {},
      chronologicalIds: ["message-1"],
      patchSeries: [],
      diagnostics: [],
    };

    const copy = structuredClone(thread);
    expect(copy).toEqual(thread);
    expect(blocks.map(renderBlock)).toEqual([
      "New text",
      "Quoted text",
      "const value = 1;",
      "patch-1",
      "-- \nAuthor",
    ]);
  });
});
