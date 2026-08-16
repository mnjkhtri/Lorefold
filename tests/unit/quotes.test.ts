import { describe, expect, it } from "vitest";

import { parseQuotes } from "../../src/parsing/quotes";

describe("parseQuotes", () => {
  it("recognizes nested and no-space quotations", () => {
    expect(parseQuotes("> one\n>> two\n>three")).toEqual([
      {
        kind: "quote",
        lines: [
          { depth: 1, text: "one" },
          { depth: 2, text: "two" },
          { depth: 1, text: "three" },
        ],
        lineCount: 3,
        maximumDepth: 2,
      },
    ]);
  });

  it("attaches attribution only when it precedes a quote", () => {
    expect(parseQuotes("Alice wrote:\n> quoted\n\nBob said:\nNew prose")).toEqual([
      {
        kind: "quote",
        attribution: "Alice wrote:",
        lines: [{ depth: 1, text: "quoted" }],
        lineCount: 1,
        maximumDepth: 1,
      },
      { kind: "paragraph", text: "Bob said:\nNew prose" },
    ]);
  });

  it("caps represented depth at 32", () => {
    const deeplyQuoted = `${">".repeat(40)}deep`;
    expect(parseQuotes(deeplyQuoted)[0]).toMatchObject({
      kind: "quote",
      maximumDepth: 32,
      lines: [{ depth: 32, text: "deep" }],
    });
  });

  it("keeps ordinary greater-than prose as prose", () => {
    expect(parseQuotes("a > b and c > d")).toEqual([
      { kind: "paragraph", text: "a > b and c > d" },
    ]);
  });
});
