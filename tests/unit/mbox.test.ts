import { describe, expect, it } from "vitest";

import { splitMbox } from "../../src/parsing/mbox";

const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const decoded = (value: Uint8Array): string => new TextDecoder().decode(value);

describe("splitMbox", () => {
  it("splits valid LF records and preserves body From lines", () => {
    const records = splitMbox(
      text(
        "From one@example.test Thu Jan 1 00:00:00 2026\n" +
          "Subject: One\n\n" +
          "From inside the message\n" +
          "From two@example.test Fri Jan 2 00:00:00 2026\n" +
          "Subject: Two\n\nBody\n",
      ),
    );

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.sourceOrdinal)).toEqual([0, 1]);
    expect(decoded(records[0].bytes)).toContain("From inside the message");
    expect(decoded(records[1].bytes)).toContain("Subject: Two");
  });

  it("supports CRLF and one mboxrd unescape", () => {
    const records = splitMbox(
      text(
        "From one@example.test Thu Jan 1 00:00:00 2026\r\n" +
          "Subject: One\r\n\r\n" +
          ">From quoted once\r\n" +
          ">>From quoted twice\r\n",
      ),
    );

    expect(decoded(records[0].bytes)).toContain("From quoted once\r\n");
    expect(decoded(records[0].bytes)).toContain(">From quoted twice\r\n");
  });

  it("does not split malformed envelope-looking body lines", () => {
    const records = splitMbox(
      text("From not-an-envelope\nSubject: One\n\nFrom someone\n"),
    );

    expect(records).toHaveLength(1);
    expect(decoded(records[0].bytes)).toContain("From not-an-envelope");
  });

  it("returns no records for empty input", () => {
    expect(splitMbox(new Uint8Array())).toEqual([]);
  });
});
