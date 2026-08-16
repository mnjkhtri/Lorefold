import { describe, expect, it } from "vitest";

import { parseThread } from "../../src/parsing/thread-parser";
import type { RawThreadEnvelope } from "../../src/models/thread";

const limits = {
  maxInputBytes: 1024 * 1024,
  maxRecords: 100,
  maxMimeDepth: 30,
  maxHeaderBytes: 256 * 1024,
  maxReferences: 100,
  maxBodyBytes: 1024 * 1024,
};

describe("parseThread", () => {
  it("assembles RFC822 records into a normalized thread with content and patch", async () => {
    const raw = (value: string): Uint8Array => new TextEncoder().encode(value);
    const input: RawThreadEnvelope = {
      request: {
        source: { kind: "static-generated", contentDigest: "sha256:test" },
      },
      records: [
        {
          sourceOrdinal: 0,
          bytes: raw(
            "From: Root <root@example.test>\r\n" +
              "Subject: [PATCH 1/1] Example\r\n" +
              "Message-ID: <root@example.test>\r\n" +
              "Date: Thu, 01 Jan 2026 00:00:00 +0000\r\n\r\n" +
              "Please review.\r\n\r\n" +
              "diff --git a/a.txt b/a.txt\r\n--- a/a.txt\r\n+++ b/a.txt\r\n" +
              "@@ -1 +1 @@\r\n-old\r\n+new\r\n",
          ),
        },
      ],
    };

    const result = await parseThread(input, limits);
    expect(result.rootIds).toEqual(["root@example.test"]);
    expect(result.messages["root@example.test"].patchIds).toHaveLength(1);
    expect(result.messages["root@example.test"].blocks).toEqual(
      expect.arrayContaining([{ kind: "paragraph", text: "Please review." }]),
    );
    expect(result.patchSeries[0]).toMatchObject({ total: 1, incomplete: false });
  });

  it("validates a requested Message-ID against imported records", async () => {
    const result = await parseThread({
      request: {
        requestedMessageId: "root@example.test",
        source: { kind: "static-generated", contentDigest: "sha256:test" },
      },
      records: [{
        sourceOrdinal: 0,
        bytes: new TextEncoder().encode("From: Root <root@example.test>\r\nMessage-ID: <root@example.test>\r\n\r\nBody"),
      }],
    }, limits);
    expect(result.selectedMessageId).toBe("root@example.test");
    await expect(parseThread({
      request: {
        requestedMessageId: "missing@example.test",
        source: { kind: "static-generated", contentDigest: "sha256:test" },
      },
      records: [{
        sourceOrdinal: 0,
        bytes: new TextEncoder().encode("From: Root <root@example.test>\r\nMessage-ID: <root@example.test>\r\n\r\nBody"),
      }],
    }, limits)).rejects.toThrow("was not found");
  });
});
