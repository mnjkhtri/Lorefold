import {
  MAX_COMPRESSED_INPUT_BYTES,
  MAX_DECOMPRESSED_THREAD_BYTES,
  ParseLimitError,
} from "./limits";

const GZIP_MAGIC = [0x1f, 0x8b];

export class CompressionError extends Error {
  public readonly code = "compression-error";

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CompressionError";
  }
}

export type BinaryInput = ArrayBuffer | Uint8Array | Blob;

async function toBytes(input: BinaryInput): Promise<Uint8Array> {
  if (input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }

  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

function enforceSize(size: number, limit: number, label: string): void {
  if (size > limit) {
    throw new ParseLimitError(`${label} exceeds the configured limit.`);
  }
}

async function decompressGzip(bytes: Uint8Array, maxOutputBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new CompressionError("Gzip decompression is unavailable in this environment.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let outputBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      outputBytes += result.value.byteLength;
      if (outputBytes > maxOutputBytes) {
        await reader.cancel();
        throw new ParseLimitError("Decompressed input exceeds the configured limit.");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof ParseLimitError) {
      throw error;
    }
    throw new CompressionError("Gzip input is corrupt or cannot be decompressed.", {
      cause: error,
    });
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(outputBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function decodeBounded(
  input: BinaryInput,
  options: {
    maxCompressedBytes?: number;
    maxDecompressedBytes?: number;
  } = {},
): Promise<Uint8Array> {
  const bytes = await toBytes(input);
  const maxCompressedBytes = options.maxCompressedBytes ?? MAX_COMPRESSED_INPUT_BYTES;
  const maxDecompressedBytes = options.maxDecompressedBytes ?? MAX_DECOMPRESSED_THREAD_BYTES;
  enforceSize(bytes.byteLength, maxCompressedBytes, "Compressed input");

  if (!isGzip(bytes)) {
    enforceSize(bytes.byteLength, maxDecompressedBytes, "Input");
    return bytes.slice();
  }

  return decompressGzip(bytes, maxDecompressedBytes);
}
