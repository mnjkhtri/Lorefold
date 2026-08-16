import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatchView } from "../../src/app/PatchView";
import type { Patch } from "../../src/models/patch";

const patch: Patch = {
  id: "patch-1",
  subject: "[PATCH] Example",
  commitMessage: [],
  files: [{
    displayPath: "src/example.ts",
    status: "modified",
    hunks: [{
      header: "@@ -1 +1 @@",
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      lines: [
        { kind: "deletion", text: "old", oldLine: 1 },
        { kind: "addition", text: "new", newLine: 1 },
      ],
    }],
    binary: false,
  }],
  trailers: [],
  rawText: "diff --git ...",
  statistics: { files: 1, additions: 1, deletions: 1 },
  diagnostics: [],
};

describe("PatchView", () => {
  it("renders structured file and hunk details safely", () => {
    const html = renderToStaticMarkup(<PatchView patch={patch} />);
    expect(html).toContain("src/example.ts (modified)");
    expect(html).toContain("@@ -1 +1 @@");
    expect(html).toContain("diff-line--addition");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
