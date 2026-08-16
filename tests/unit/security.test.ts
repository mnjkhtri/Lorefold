import { describe, expect, it } from "vitest";

import { displayText } from "../../src/security/display-text";
import { safeLoreMessageHref } from "../../src/security/safe-links";

describe("security boundaries", () => {
  it("removes bidi controls from visible text", () => {
    expect(displayText("safe\u202Eevil\u202C text")).toBe("safeevil text");
  });

  it("encodes canonical Message-ID links", () => {
    expect(safeLoreMessageHref("message@example.test")).toBe(
      "https://lore.kernel.org/all/message%40example.test/",
    );
  });
});
