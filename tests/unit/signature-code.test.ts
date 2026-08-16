import { describe, expect, it } from "vitest";

import { parseSignatureAndCode } from "../../src/parsing/signature-code";

describe("parseSignatureAndCode", () => {
  it("recognizes the authoritative signature delimiter", () => {
    expect(parseSignatureAndCode("Message\n\n-- \nAuthor\nTeam")).toEqual([
      { kind: "paragraph", text: "Message" },
      { kind: "signature", text: "Author\nTeam", lineCount: 2 },
    ]);
  });

  it("preserves indented code and fenced language hints", () => {
    expect(parseSignatureAndCode("Before\n\n    const x = 1;\n\n```ts\nlet y = 2;\n```")).toEqual([
      { kind: "paragraph", text: "Before" },
      { kind: "code", text: "    const x = 1;" },
      { kind: "code", text: "let y = 2;", languageHint: "ts" },
    ]);
  });

  it("recognizes traceback lines without swallowing ordinary prose", () => {
    expect(
      parseSignatureAndCode("A normal sentence\nTraceback (most recent call last):\n  at main()"),
    ).toEqual([
      { kind: "paragraph", text: "A normal sentence" },
      { kind: "code", text: "Traceback (most recent call last):\n  at main()" },
    ]);
  });

  it("does not treat lightly indented prose as code", () => {
    expect(parseSignatureAndCode("  This is still prose.")).toEqual([
      { kind: "paragraph", text: "  This is still prose." },
    ]);
  });
});
