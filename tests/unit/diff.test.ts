import { describe, expect, it } from "vitest";

import { parseDiff } from "../../src/parsing/diff";

describe("parseDiff", () => {
  it("parses hunks, numbered lines, and statistics", () => {
    const result = parseDiff(
      "diff --git a/a.txt b/a.txt\n" +
        "--- a/a.txt\n+++ b/a.txt\n" +
        "@@ -1,2 +1,2 @@\n-old\n+new\n context",
      { id: "patch-1", subject: "[PATCH] Change" },
    );

    expect(result.statistics).toEqual({ files: 1, additions: 1, deletions: 1 });
    expect(result.files[0]).toMatchObject({ displayPath: "a.txt", status: "modified" });
    expect(result.files[0].hunks[0].lines).toEqual([
      { kind: "deletion", text: "old", oldLine: 1 },
      { kind: "addition", text: "new", newLine: 1 },
      { kind: "context", text: "context", oldLine: 2, newLine: 2 },
    ]);
  });

  it("parses added, deleted, renamed, copied, and binary files", () => {
    const raw = [
      "diff --git a/new b/new",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new",
      "@@ -0,0 +1 @@",
      "+new",
      "diff --git a/old b/old",
      "deleted file mode 100644",
      "--- a/old",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-old",
      "diff --git a/from b/to",
      "similarity index 100%",
      "rename from from",
      "rename to to",
      "diff --git a/copy b/copy2",
      "similarity index 100%",
      "copy from copy",
      "copy to copy2",
      "diff --git a/image b/image",
      "GIT binary patch",
    ].join("\n");
    expect(parseDiff(raw).files.map((file) => file.status)).toEqual([
      "added",
      "deleted",
      "renamed",
      "copied",
      "binary",
    ]);
  });

  it("retains malformed patches with a diagnostic", () => {
    const result = parseDiff("This is not a diff", { id: "bad" });
    expect(result.rawText).toBe("This is not a diff");
    expect(result.files).toEqual([]);
    expect(result.diagnostics[0].code).toBe("malformed-diff");
  });
});
