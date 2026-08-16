import { describe, expect, it } from "vitest";

import { resultToThread } from "../../src/app/result-to-thread";
import type { ParseWorkerResult } from "../../src/parsing/worker-protocol";

Object.defineProperty(globalThis, "crypto", {
  value: { subtle: { digest: async () => new ArrayBuffer(32) } },
  configurable: true,
});

describe("resultToThread", () => {
  it("creates a persistable thread snapshot from worker output", async () => {
    const result: ParseWorkerResult = {
      requestId: "r",
      request: { source: { kind: "local-file", contentDigest: "digest" } },
      records: [{
        sourceOrdinal: 0,
        mime: { headers: [], replyTo: [], to: [], cc: [], attachments: [] },
        headers: {
          rawHeaders: [],
          author: { name: "Developer" },
          timestamp: { valid: false },
          subject: "Saved subject",
          references: [],
          mailingLists: [],
          diagnostics: [],
        },
        body: { text: "Saved text", source: "plain" },
        rawText: "Subject: Saved subject\n\nSaved text",
      }],
    };
    const thread = await resultToThread(result);
    expect(thread.subject).toBe("Saved subject");
    expect(Object.values(thread.messages)[0].blocks).toEqual([{ kind: "paragraph", text: "Saved text" }]);
  });
});
