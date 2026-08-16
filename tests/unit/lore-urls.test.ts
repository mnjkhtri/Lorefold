import { describe, expect, it } from "vitest";

import { LoreUrlError, parseLoreReference } from "../../src/lore/urls";

describe("parseLoreReference", () => {
  it.each([
    "<abc123@example.test>",
    "abc123@example.test",
    "https://lore.kernel.org/all/abc123%40example.test/",
    "https://lore.kernel.org/r/abc123%40example.test",
    "https://lore.kernel.org/linux-fsdevel/abc123%40example.test/",
  ])("accepts %s", (input) => {
    expect(parseLoreReference(input).messageId).toBe("abc123@example.test");
  });

  it("decodes one path segment once and canonicalizes reserved characters", () => {
    const result = parseLoreReference(
      "https://lore.kernel.org/all/part%2Btwo%40example.test/",
    );

    expect(result.messageId).toBe("part+two@example.test");
    expect(result.canonicalUrl).toBe(
      "https://lore.kernel.org/all/part%2Btwo%40example.test/",
    );
    expect(result.mboxUrl).toBe(
      "https://lore.kernel.org/all/part%2Btwo%40example.test/t.mbox.gz",
    );
  });

  it("keeps an encoded slash inside the single encoded segment", () => {
    expect(
      parseLoreReference("https://lore.kernel.org/all/left%2Fright%40example.test/").messageId,
    ).toBe("left/right@example.test");
  });

  it.each([
    "http://lore.kernel.org/all/id@example.test/",
    "https://evil.example/all/id@example.test/",
    "https://lore.kernel.org.evil.example/all/id@example.test/",
    "https://user@lore.kernel.org/all/id@example.test/",
    "https://lore.kernel.org/all/id@example.test/extra/segment",
    "https://lore.kernel.org/all/%zz/",
    "",
    "not a message id",
  ])("rejects unsafe input %s", (input) => {
    expect(() => parseLoreReference(input)).toThrow(LoreUrlError);
  });
});
