import { describe, expect, it } from "vitest";

import { reconstructThread, type ReconstructionRecord } from "../../src/parsing/reconstruction";
import type { Message } from "../../src/models/thread";

const source = { kind: "static-generated" as const, contentDigest: "sha256:thread" };

function message(id: string, date: string, parent?: string, ordinal = 0, subject = "Thread"): Message {
  return {
    id,
    messageId: id,
    ...(parent === undefined ? {} : { declaredParentMessageId: parent }),
    references: parent === undefined ? [] : [parent],
    missingAncestorIds: [],
    author: { name: id },
    timestamp: { valid: true, iso: date },
    subject,
    mailingLists: [],
    blocks: [],
    patchIds: [],
    attachmentMetadata: [],
    sourceOrdinal: ordinal,
    diagnostics: [],
  };
}

const records = (...messages: Message[]): ReconstructionRecord[] => messages.map((item) => ({ message: item }));

describe("reconstructThread", () => {
  it("is stable when input order is shuffled", async () => {
    const first = message("<first>", "2026-01-01T00:00:00.000Z");
    const second = message("<second>", "2026-01-01T00:01:00.000Z", "<first>");
    const a = await reconstructThread(records(second, first), source);
    const b = await reconstructThread(records(first, second), source);
    expect(a.rootIds).toEqual(b.rootIds);
    expect(a.childrenByParent).toEqual(b.childrenByParent);
    expect(a.chronologicalIds).toEqual(b.chronologicalIds);
  });

  it("retains missing parents as roots with missing ancestor diagnostics", async () => {
    const result = await reconstructThread(records(message("child", "2026-01-01T00:00:00.000Z", "missing")), source);
    expect(result.rootIds).toEqual(["child"]);
    expect(result.messages.child.missingAncestorIds).toEqual(["missing"]);
  });

  it("keeps the first conflicting duplicate and diagnoses it", async () => {
    const result = await reconstructThread(
      records(message("same", "2026-01-01T00:00:00.000Z", undefined, 0), message("same", "2026-01-02T00:00:00.000Z", undefined, 1)),
      source,
    );
    expect(Object.keys(result.messages)).toEqual(["same"]);
    expect(result.diagnostics[0].code).toBe("conflicting-duplicate-message-id");
  });

  it("repairs cycles by detaching the earliest message", async () => {
    const result = await reconstructThread(
      records(
        message("a", "2026-01-01T00:00:00.000Z", "b"),
        message("b", "2026-01-02T00:00:00.000Z", "a"),
      ),
      source,
    );
    expect(result.messages.a.parentId).toBeUndefined();
    expect(result.messages.a.diagnostics[0].code).toBe("cycle-repaired");
    expect(result.rootIds).toEqual(["a"]);
  });
});
