import { describe, expect, it } from "vitest";

import { detectPatches } from "../../src/parsing/patch-detection";

const patch =
  "diff --git a/src/example.ts b/src/example.ts\n" +
  "--- a/src/example.ts\n" +
  "+++ b/src/example.ts\n" +
  "@@ -1,1 +1,1 @@\n" +
  "-old\n" +
  "+new";

describe("detectPatches", () => {
  it("extracts a coherent git patch after prose", () => {
    const result = detectPatches(`Commit explanation\n\n${patch}`);
    expect(result.preamble).toBe("Commit explanation");
    expect(result.patches).toEqual([{ rawText: patch, source: "body" }]);
  });

  it("detects a patch supplied as an attachment", () => {
    expect(detectPatches("Review attached.", [{ text: patch, source: "attachment" }]).patches).toEqual([
      { rawText: patch, source: "attachment" },
    ]);
  });

  it("keeps a multi-file patch series in one review unit", () => {
    const secondFile = "diff --git a/src/other.ts b/src/other.ts\n--- a/src/other.ts\n+++ b/src/other.ts\n@@ -1,1 +1,1 @@\n-old\n+new";
    expect(detectPatches(`${patch}\n${secondFile}`).patches).toHaveLength(1);
  });

  it("rejects quoted and incomplete diff-looking prose", () => {
    expect(detectPatches("> diff --git a/a b/a\n> --- a/a\n> +++ b/a\n> @@ -1 +1 @@")).toEqual({
      preamble: "> diff --git a/a b/a\n> --- a/a\n> +++ b/a\n> @@ -1 +1 @@",
      patches: [],
    });
    expect(detectPatches("--- a/file\n+++ b/file\nThis is prose").patches).toEqual([]);
  });
});
