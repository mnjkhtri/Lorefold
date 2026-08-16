import { describe, expect, it } from "vitest";

import { MimeParseError, parseMimeMessage } from "../../src/parsing/mime";

describe("parseMimeMessage", () => {
  it("parses plain text headers and body", async () => {
    const result = await parseMimeMessage(
      new TextEncoder().encode(
        "From: Example <example@example.test>\r\n" +
          "To: reader@example.test\r\n" +
          "Subject: Plain message\r\n" +
          "Message-ID: <plain@example.test>\r\n" +
          "Date: Thu, 01 Jan 2026 00:00:00 +0000\r\n\r\n" +
          "Hello, reader.\r\n",
      ),
    );

    expect(result.subject).toBe("Plain message");
    expect(result.messageId).toBe("<plain@example.test>");
    expect(result.from?.address).toBe("example@example.test");
    expect(result.text).toContain("Hello, reader.");
  });

  it("decodes multipart alternatives and omits attachment content", async () => {
    const result = await parseMimeMessage(
      new TextEncoder().encode(
        "From: Example <example@example.test>\r\n" +
          "Subject: Multipart\r\n" +
          "Content-Type: multipart/mixed; boundary=part\r\n\r\n" +
          "--part\r\n" +
          "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
          "Plain body\r\n" +
          "--part\r\n" +
          "Content-Type: application/octet-stream\r\n" +
          "Content-Disposition: attachment; filename=secret.bin\r\n" +
          "Content-Transfer-Encoding: base64\r\n\r\n" +
          "c2VjcmV0\r\n" +
          "--part--\r\n",
      ),
    );

    expect(result.text).toContain("Plain body");
    expect(result.attachments).toEqual([
      expect.objectContaining({
        filename: "secret.bin",
        mimeType: "application/octet-stream",
        disposition: "attachment",
      }),
    ]);
    expect(result.attachments[0]).not.toHaveProperty("content");
  });

  it("decodes quoted-printable Unicode text", async () => {
    const result = await parseMimeMessage(
      new TextEncoder().encode(
        "Subject: =?UTF-8?Q?caf=C3=A9?=\r\n" +
          "Content-Type: text/plain; charset=utf-8\r\n" +
          "Content-Transfer-Encoding: quoted-printable\r\n\r\n" +
          "Ol=C3=A1, mundo!\r\n",
      ),
    );

    expect(result.subject).toBe("café");
    expect(result.text).toContain("Olá, mundo!");
  });

  it("returns recoverable output for a malformed message", async () => {
    const result = await parseMimeMessage(
      new TextEncoder().encode("Subject: damaged\r\n\r\nBody without a final newline"),
    );
    expect(result.subject).toBe("damaged");
    expect(result.text).toContain("Body without a final newline");
  });

  it("rejects an oversized raw message before parsing", async () => {
    await expect(
      parseMimeMessage(new Uint8Array(5), { maxRawBytes: 4 }),
    ).rejects.toBeInstanceOf(MimeParseError);
  });
});
