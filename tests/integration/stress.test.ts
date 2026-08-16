import { describe, expect, it } from "vitest";

import { parseDiff } from "../../src/parsing/diff";
import { parseThread } from "../../src/parsing/thread-parser";
import { makeLargePatch, makeStressEnvelope } from "../support/stress-generators";

const limits = {
  maxInputBytes: 64 * 1024 * 1024,
  maxRecords: 600,
  maxMimeDepth: 30,
  maxHeaderBytes: 256 * 1024,
  maxReferences: 100,
  maxBodyBytes: 2 * 1024 * 1024,
};

describe("documented stress profile", () => {
  it("parses 500 messages and reconstructs a depth-100 chain", async () => {
    const started = performance.now();
    const thread = await parseThread(makeStressEnvelope(), limits);
    const elapsed = performance.now() - started;
    let depth = 0;
    let current = thread.messages["stress-100@example.test"];
    while (current?.parentId !== undefined) {
      depth += 1;
      current = thread.messages[current.parentId];
    }

    expect(Object.keys(thread.messages)).toHaveLength(500);
    expect(depth).toBe(100);
    // Section 16's one-second initial-work budget on the documented local profile.
    expect(elapsed).toBeLessThan(1000);
  });

  it("parses a 10,000-line patch without unbounded DOM-oriented structures", () => {
    const started = performance.now();
    const patch = parseDiff(makeLargePatch(), { id: "stress-patch" });
    const elapsed = performance.now() - started;
    expect(patch.statistics).toEqual({ files: 1, additions: 10_000, deletions: 0 });
    expect(patch.files[0]?.hunks[0]?.lines).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(150);
  });
});
