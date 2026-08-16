import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FileNavigator } from "../../src/app/FileNavigator";
import { SeriesSummary } from "../../src/app/SeriesSummary";

describe("series and file navigation", () => {
  it("makes incomplete series position explicit", () => {
    const html = renderToStaticMarkup(
      <SeriesSummary
        series={{
          id: "2:example",
          version: 2,
          total: 3,
          subjectStem: "example",
          members: [{ index: 1, messageId: "m1" }],
          incomplete: true,
        }}
      />,
    );
    expect(html).toContain("1 of 3 patches (incomplete)");
    expect(html).toContain("Patch 1");
  });

  it("links every file and marks the active file", () => {
    const html = renderToStaticMarkup(
      <FileNavigator
        activePath="src/a.ts"
        files={[
          { displayPath: "src/a.ts", status: "modified", hunks: [], binary: false },
          { displayPath: "image.bin", status: "binary", hunks: [], binary: true },
        ]}
      />,
    );
    expect(html).toContain("src/a.ts");
    expect(html).toContain("(modified)");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("image.bin");
    expect(html).toContain("(binary)");
  });
});
