import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichContentBlocks } from "../../src/app/RichContentBlocks";

describe("RichContentBlocks", () => {
  it("collapses quotes and signatures by default while preserving code", () => {
    const html = renderToStaticMarkup(
      <RichContentBlocks
        blocks={[
          { kind: "paragraph", text: "New text" },
          { kind: "quote", lines: [{ depth: 2, text: "old text" }], lineCount: 1, maximumDepth: 2 },
          { kind: "code", text: "const x = 1;" },
          { kind: "signature", text: "-- \nName", lineCount: 2 },
        ]}
      />,
    );
    expect(html).toContain("New text");
    expect(html).toContain("const x = 1;");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Quoted context (1 lines, depth 2)");
  });
});
