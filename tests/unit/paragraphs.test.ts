import { describe, expect, it } from "vitest";

import { parseParagraphs } from "../../src/parsing/paragraphs";

describe("parseParagraphs", () => {
  it("creates ordered blocks separated by blank lines", () => {
    expect(parseParagraphs("First line\ncontinues\n\nSecond paragraph")).toEqual([
      { kind: "paragraph", text: "First line\ncontinues" },
      { kind: "paragraph", text: "Second paragraph" },
    ]);
  });

  it("preserves Unicode, indentation, and code characters", () => {
    expect(parseParagraphs("  café →\nconst value = a < b && c > d;")).toEqual([
      { kind: "paragraph", text: "  café →\nconst value = a < b && c > d;" },
    ]);
  });

  it("ignores empty and whitespace-only input", () => {
    expect(parseParagraphs("")).toEqual([]);
    expect(parseParagraphs(" \n\t\n")).toEqual([]);
  });
});
