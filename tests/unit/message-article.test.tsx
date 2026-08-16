import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MessageArticle } from "../../src/app/MessageArticle";
import type { ParsedWorkerRecord } from "../../src/parsing/worker-protocol";

const record: ParsedWorkerRecord = {
  sourceOrdinal: 0,
  mime: {
    headers: [],
    replyTo: [],
    to: [],
    cc: [],
    attachments: [],
  },
  headers: {
    rawHeaders: [],
    author: { name: "Developer", address: "dev@example.test" },
    timestamp: { valid: true, iso: "2026-01-01T00:00:00.000Z" },
    subject: "A safe message",
    references: [],
    mailingLists: [],
    diagnostics: [],
  },
  body: { text: "Hello\n\nWorld", source: "plain" },
  rawText: "Subject: A safe message\n\nHello\n\nWorld",
};

describe("MessageArticle", () => {
  it("renders message text without HTML execution", () => {
    const html = renderToStaticMarkup(<MessageArticle record={record} />);
    expect(html).toContain("A safe message");
    expect(html).toContain("Hello");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
