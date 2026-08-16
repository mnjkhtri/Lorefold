import { describe, expect, it } from "vitest";

import { htmlToPlainText, selectBody } from "../../src/parsing/body";

describe("selectBody", () => {
  it("prefers non-empty plaintext over HTML", () => {
    expect(
      selectBody({
        headers: [],
        replyTo: [],
        to: [],
        cc: [],
        text: "Plain body",
        html: "<p>HTML body</p>",
        attachments: [],
      }),
    ).toEqual({ text: "Plain body", source: "plain" });
  });

  it("converts HTML structure to readable inert text", () => {
    expect(htmlToPlainText("<p>Hello<br>world</p><p><strong>Next</strong> line</p>")).toBe(
      "Hello\nworld\nNext line",
    );
  });

  it("removes active elements, remote images, and attributes", () => {
    const result = htmlToPlainText(
      '<script>alert("x")</script><svg><text>bad</text></svg>' +
        '<img src="https://evil.example/image.png" alt="remote">' +
        '<a href="https://evil.example">safe label</a>',
    );

    expect(result).toBe("safe label");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("https://");
  });

  it("returns an empty selection when no body exists", () => {
    expect(selectBody({ headers: [], replyTo: [], to: [], cc: [], attachments: [] })).toEqual({
      text: "",
      source: "empty",
    });
  });
});
