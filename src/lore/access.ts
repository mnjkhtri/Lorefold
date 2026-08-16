import { parseLoreReference, type LoreReference } from "./urls";

export interface LocalImportWorkflow {
  reference: LoreReference;
  downloadUrl: string;
  instruction: string;
}

export class LoreAccessError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "LoreAccessError";
    this.code = code;
  }
}

export function createLocalImportWorkflow(input: string): LocalImportWorkflow {
  const reference = parseLoreReference(input);
  return {
    reference,
    downloadUrl: reference.mboxUrl,
    instruction: "Download this exact complete-thread archive, then choose it in Lorefold.",
  };
}

export interface DirectLoreOptions {
  enabled?: boolean;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchDirectLore(
  reference: LoreReference,
  signal: AbortSignal,
  options: DirectLoreOptions = {},
): Promise<Uint8Array> {
  if (options.enabled !== true) {
    throw new LoreAccessError(
      "direct-disabled",
      "Direct Lore loading is disabled until a real Pages-origin CORS test succeeds.",
    );
  }

  const response = await (options.fetchImpl ?? fetch)(reference.mboxUrl, { signal });
  if (!response.ok) {
    throw new LoreAccessError("http-error", `Lore returned HTTP ${response.status}.`);
  }
  if (response.type === "opaque") {
    throw new LoreAccessError("opaque-response", "Lore returned an unreadable opaque response.");
  }
  if (response.headers.get("access-control-allow-origin") === null) {
    throw new LoreAccessError("cors-rejected", "Lore did not grant browser CORS access.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > (options.maxBytes ?? 100 * 1024 * 1024)) {
    throw new LoreAccessError("size-limit", "Lore response exceeds the configured size limit.");
  }
  return bytes;
}
