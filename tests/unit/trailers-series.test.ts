import { describe, expect, it } from "vitest";

import { parsePatchSeries, parseTerminalTrailers } from "../../src/parsing/trailers-series";

describe("parseTerminalTrailers", () => {
  it("parses terminal trailers and continuations in order", () => {
    expect(
      parseTerminalTrailers("Commit message\n\nSigned-off-by: Dev <dev@example.test>\nLink: https://example.test\n continuation"),
    ).toEqual({
      body: "Commit message",
      trailers: [
        { key: "Signed-off-by", value: "Dev <dev@example.test>", continuationLines: [] },
        { key: "Link", value: "https://example.test", continuationLines: [" continuation"] },
      ],
    });
  });

  it("does not classify a prose Cc line as a trailer", () => {
    expect(parseTerminalTrailers("Please Cc: the list").trailers).toEqual([]);
  });
});

describe("parsePatchSeries", () => {
  it("groups cover and numbered messages by version and stem", () => {
    const result = parsePatchSeries([
      { messageId: "m2", subject: "[PATCH v2 2/2] second", patchId: "p2" },
      { messageId: "cover", subject: "[PATCH v2 0/2] series" },
      { messageId: "m1", subject: "[PATCH v2 1/2] first", patchId: "p1" },
    ]);
    expect(result).toEqual([
      {
        id: "2:series",
        version: 2,
        total: 2,
        subjectStem: "series",
        coverMessageId: "cover",
        members: [
          { index: 1, messageId: "m1", patchId: "p1" },
          { index: 2, messageId: "m2", patchId: "p2" },
        ],
        incomplete: false,
      },
    ]);
  });

  it("marks incomplete series without inferring across versions", () => {
    const result = parsePatchSeries([
      { messageId: "v1", subject: "[PATCH 1/3] one" },
      { messageId: "v2", subject: "[PATCH v2 1/3] one" },
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((series) => series.incomplete)).toBe(true);
  });
});
