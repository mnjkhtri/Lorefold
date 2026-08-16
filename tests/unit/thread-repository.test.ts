import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import type { StoredThread } from "../../src/models/storage";
import { IndexedDbThreadRepository } from "../../src/storage/thread-repository";

function record(id: string, saved = false, lastOpenedAt = id, sizeBytes = 1): StoredThread {
  return {
    thread: {
      schemaVersion: 1,
      id,
      source: { kind: "local-file", contentDigest: `digest:${id}` },
      subject: id,
      messages: {},
      rootIds: [],
      childrenByParent: {},
      chronologicalIds: [],
      patchSeries: [],
      diagnostics: [],
    },
    saved,
    createdAt: lastOpenedAt,
    updatedAt: lastOpenedAt,
    lastOpenedAt,
    sizeBytes,
  };
}

describe("IndexedDbThreadRepository", () => {
  it("round-trips, pins, and deletes a stored thread", async () => {
    const name = "lorefold-roundtrip";
    const repository = new IndexedDbThreadRepository(name);
    await repository.put(record("thread-1"));
    expect((await repository.get("thread-1"))?.thread.subject).toBe("thread-1");
    await repository.setSaved("thread-1", true);
    expect((await repository.get("thread-1"))?.saved).toBe(true);
    await repository.delete("thread-1");
    expect(await repository.get("thread-1")).toBeUndefined();
    await repository.close();
    await IndexedDbThreadRepository.deleteDatabase(name);
  });

  it("evicts oldest unsaved records while retaining saved records", async () => {
    const name = "lorefold-eviction";
    const repository = new IndexedDbThreadRepository(name);
    for (let index = 0; index < 51; index += 1) {
      await repository.put(record(`thread-${index}`, false, String(index).padStart(2, "0")));
    }
    await repository.put(record("pinned", true, "99"));
    expect(await repository.get("thread-0")).toBeUndefined();
    expect(await repository.get("thread-50")).toBeDefined();
    expect(await repository.get("pinned")).toBeDefined();
    await repository.close();
    await IndexedDbThreadRepository.deleteDatabase(name);
  });

  it("evicts by bytes for unsaved records", async () => {
    const name = "lorefold-bytes";
    const repository = new IndexedDbThreadRepository(name);
    await repository.put(record("old", false, "01", 90));
    await repository.put(record("new", false, "02", 20));
    await repository.evictUnsaved();
    expect(await repository.get("old")).toBeDefined();
    await repository.put(record("large", false, "03", 100 * 1024 * 1024));
    expect(await repository.get("old")).toBeUndefined();
    await repository.close();
    await IndexedDbThreadRepository.deleteDatabase(name);
  });
});
