import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "../../src/parsing/headers";
import type { DecodedMimeMessage } from "../../src/parsing/mime";

const baseMessage: DecodedMimeMessage = {
  headers: [
    {
      key: "list-id",
      originalKey: "List-Id",
      value: '"Linux FSDevel" <linux-fsdevel.example.test>',
    },
    {
      key: "list-post",
      originalKey: "List-Post",
      value: "<mailto:linux-fsdevel@example.test>",
    },
  ],
  from: { name: "A Developer", address: "dev@example.test" },
  replyTo: [],
  to: [],
  cc: [],
  subject: "[PATCH] Example",
  messageId: "<child@example.test>",
  inReplyTo: "<parent@example.test>",
  references: "<root@example.test> <parent@example.test>",
  date: "Thu, 01 Jan 2026 00:00:00 +0000",
  attachments: [],
};

describe("normalizeHeaders", () => {
  it("normalizes identity, timestamp, parent, references, and list metadata", () => {
    const result = normalizeHeaders(baseMessage);

    expect(result.author).toEqual({ name: "A Developer", address: "dev@example.test" });
    expect(result.messageId).toBe("child@example.test");
    expect(result.declaredParentMessageId).toBe("parent@example.test");
    expect(result.references).toEqual(["root@example.test", "parent@example.test"]);
    expect(result.timestamp).toEqual({
      raw: "Thu, 01 Jan 2026 00:00:00 +0000",
      iso: "2026-01-01T00:00:00.000Z",
      valid: true,
    });
    expect(result.mailingLists).toEqual([
      {
        id: "linux-fsdevel.example.test",
        displayName: "Linux FSDevel",
        address: "linux-fsdevel@example.test",
      },
    ]);
    expect(result.rawHeaders[0].originalKey).toBe("List-Id");
  });

  it("preserves recipient metadata for the reader", () => {
    const result = normalizeHeaders({
      ...baseMessage,
      sender: { name: "Sender", address: "sender@example.test" },
      replyTo: [{ name: "Replies", address: "replies@example.test" }],
      to: [{ name: "To person", address: "to@example.test" }],
      cc: [{ name: "", address: "cc@example.test" }],
    });

    expect(result.sender).toEqual({ name: "Sender", address: "sender@example.test" });
    expect(result.replyTo).toEqual([{ name: "Replies", address: "replies@example.test" }]);
    expect(result.to).toEqual([{ name: "To person", address: "to@example.test" }]);
    expect(result.cc).toEqual([{ name: "", address: "cc@example.test" }]);
  });

  it("emits diagnostics and bounds malformed values", () => {
    const result = normalizeHeaders(
      {
        ...baseMessage,
        date: "not a date",
        references: Array.from({ length: 3 }, (_, index) => `<id-${index}@example.test>`).join(" "),
      },
      { maxReferences: 2, sourceOrdinal: 7 },
    );

    expect(result.timestamp.valid).toBe(false);
    expect(result.references).toHaveLength(2);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-date" }),
        expect.objectContaining({ code: "references-truncated", sourceOrdinal: 7 }),
      ]),
    );
  });
});
