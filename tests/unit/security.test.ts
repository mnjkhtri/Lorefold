import { describe, expect, it } from "vitest";

import { displayText } from "../../src/security/display-text";
import { safeExternalHref, safeLoreMessageHref } from "../../src/security/safe-links";

describe("security boundaries", () => {
  it("allows only the exact Lore mbox host and path", () => {
    expect(safeExternalHref("https://lore.kernel.org/all/%3Cmsg%40example%3E/t.mbox.gz"))
      .toBe("https://lore.kernel.org/all/%3Cmsg%40example%3E/t.mbox.gz");
    expect(safeExternalHref("http://lore.kernel.org/all/msg/t.mbox.gz")).toBeUndefined();
    expect(safeExternalHref("https://evil.example/all/msg/t.mbox.gz")).toBeUndefined();
    expect(safeExternalHref("https://lore.kernel.org/all/msg/t.mbox.gz?next=https://evil.example"))
      .toBeUndefined();
    expect(safeExternalHref("https://lore.kernel.org/all/msg/raw")).toBeUndefined();
  });

  it("removes bidi controls from visible text", () => {
    expect(displayText("safe\u202Eevil\u202C text")).toBe("safeevil text");
  });

  it("encodes canonical Message-ID links", () => {
    expect(safeLoreMessageHref("message@example.test")).toBe(
      "https://lore.kernel.org/all/message%40example.test/",
    );
  });
});
