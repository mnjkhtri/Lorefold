export const MAX_COMPRESSED_INPUT_BYTES = 100 * 1024 * 1024;
export const MAX_DECOMPRESSED_THREAD_BYTES = 256 * 1024 * 1024;
export const MAX_RAW_MESSAGE_BYTES = 32 * 1024 * 1024;
export const MAX_HEADER_BYTES = 256 * 1024;
export const MAX_MIME_NESTING_DEPTH = 30;

export const DEFAULT_PARSER_LIMITS = {
  maxInputBytes: MAX_COMPRESSED_INPUT_BYTES,
  maxRecords: 2_000,
  maxMimeDepth: MAX_MIME_NESTING_DEPTH,
  maxHeaderBytes: MAX_HEADER_BYTES,
  maxReferences: 100,
  maxBodyBytes: MAX_DECOMPRESSED_THREAD_BYTES,
};

export class ParseLimitError extends Error {
  public readonly code = "parse-limit-exceeded";

  public constructor(message: string) {
    super(message);
    this.name = "ParseLimitError";
  }
}
