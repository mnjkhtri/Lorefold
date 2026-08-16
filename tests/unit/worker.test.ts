import { describe, expect, it } from "vitest";

import { runParseRequest } from "../../src/parsing/worker-runner";
import { ParserCancelledError, type ParserWorkerResponse } from "../../src/parsing/worker-protocol";

const limits = {
  maxInputBytes: 1024 * 1024,
  maxRecords: 100,
  maxMimeDepth: 30,
  maxHeaderBytes: 256 * 1024,
  maxReferences: 100,
  maxBodyBytes: 1024 * 1024,
};

const request = (body: string, requestId = "request-1") => ({
  type: "parse" as const,
  requestId,
  bytes: new TextEncoder().encode(
    `From sender@example.test Thu Jan 1 00:00:00 2026\nSubject: Test\n\n${body}`,
  ).buffer,
  request: {
    source: { kind: "local-file" as const, contentDigest: "sha256:test" },
  },
  limits,
});

describe("parser worker protocol", () => {
  it("returns ordered metadata and final progress", async () => {
    const responses: ParserWorkerResponse[] = [];
    await runParseRequest(request("hello"), (response) => responses.push(response));

    expect(responses.at(-1)?.type).toBe("result");
    expect(responses.find((response) => response.type === "progress")).toEqual({
      type: "progress",
      requestId: "request-1",
      processed: 1,
      total: 1,
    });
    const result = responses.at(-1);
    if (result?.type !== "result") throw new Error("Expected worker result");
    expect(result.result.records[0].headers.subject).toBe("Test");
    expect(result.result.records[0].mime.attachments[0]).toBeUndefined();
  });

  it("emits progress at every twentieth record", async () => {
    const mbox = Array.from({ length: 21 }, (_, index) =>
      `From sender@example.test Thu Jan 1 00:00:00 2026\nSubject: ${index}\n\nBody\n`,
    ).join("");
    const responses: ParserWorkerResponse[] = [];
    await runParseRequest(
      { ...request(""), bytes: new TextEncoder().encode(mbox).buffer },
      (response) => responses.push(response),
    );

    expect(responses.filter((response) => response.type === "progress")).toEqual([
      { type: "progress", requestId: "request-1", processed: 20, total: 21 },
      { type: "progress", requestId: "request-1", processed: 21, total: 21 },
    ]);
  });

  it("cancels before MIME work continues", async () => {
    const responses: ParserWorkerResponse[] = [];
    await runParseRequest(request("hello"), (response) => responses.push(response), () => true);
    expect(responses).toEqual([{ type: "cancelled", requestId: "request-1" }]);
    expect(new ParserCancelledError().code).toBe("parser-cancelled");
  });
});
