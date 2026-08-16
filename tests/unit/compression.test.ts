import { describe, expect, it } from "vitest";

import { CompressionError, decodeBounded } from "../../src/parsing/compression";
import { ParseLimitError } from "../../src/parsing/limits";

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("decodeBounded", () => {
  it("returns plain bytes unchanged", async () => {
    await expect(decodeBounded(new TextEncoder().encode("plain"))).resolves.toEqual(
      new TextEncoder().encode("plain"),
    );
  });

  it("accepts empty input", async () => {
    await expect(decodeBounded(new Uint8Array())).resolves.toEqual(new Uint8Array());
  });

  it("decompresses valid gzip", async () => {
    await expect(decodeBounded(await gzip("hello gzip"))).resolves.toEqual(
      new TextEncoder().encode("hello gzip"),
    );
  });

  it("rejects corrupt gzip", async () => {
    await expect(decodeBounded(new Uint8Array([0x1f, 0x8b, 0x00]))).rejects.toBeInstanceOf(
      CompressionError,
    );
  });

  it("rejects oversized plain input", async () => {
    await expect(
      decodeBounded(new Uint8Array(5), { maxDecompressedBytes: 4 }),
    ).rejects.toBeInstanceOf(ParseLimitError);
  });

  it("rejects oversized decompressed input", async () => {
    await expect(
      decodeBounded(await gzip("hello"), { maxDecompressedBytes: 4 }),
    ).rejects.toBeInstanceOf(ParseLimitError);
  });
});
