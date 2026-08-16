import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";

import { DEFAULT_PARSER_LIMITS } from "../src/parsing/limits";
import { splitMbox } from "../src/parsing/mbox";
import { parseThread } from "../src/parsing/thread-parser";

const FEED_URL = "https://lore.kernel.org/linux-kernel/new.atom";
const USER_AGENT = "Lorefold static catalog/0.1 (https://github.com/mnjkhtri/Lorefold)";
const MAX_THREADS = 8;
const MAX_COMPRESSED_THREAD_BYTES = 10 * 1024 * 1024;

interface GeneratedThread {
  id: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  thread: Awaited<ReturnType<typeof parseThread>>;
  rawRecords: string[];
}

function xmlText(value: string): string {
  return value
    .replace(/<[^>]+>/gu, "")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .trim();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { accept: "application/atom+xml, application/gzip", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`upstream returned ${response.status} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_COMPRESSED_THREAD_BYTES) throw new Error(`thread exceeds size limit: ${url}`);
  return bytes;
}

function entries(feed: string): Array<{ url: string; subject: string; updatedAt: string }> {
  return [...feed.matchAll(/<entry\b[\s\S]*?<\/entry>/gu)].flatMap((match) => {
    const entry = match[0];
    const url = entry.match(/<link\s+href="([^"]+)"/u)?.[1];
    if (url === undefined) return [];
    return [{
      url,
      subject: xmlText(entry.match(/<title>([\s\S]*?)<\/title>/u)?.[1] ?? "(no subject)"),
      updatedAt: entry.match(/<updated>([^<]+)<\/updated>/u)?.[1] ?? "",
    }];
  });
}

const feed = new TextDecoder().decode(await fetchBytes(FEED_URL));
const seen = new Set<string>();
const threads: GeneratedThread[] = [];
for (const entry of entries(feed)) {
  if (threads.length >= MAX_THREADS) break;
  const canonicalUrl = entry.url.replace(/\/$/u, "");
  if (seen.has(canonicalUrl)) continue;
  seen.add(canonicalUrl);
  const archiveUrl = `${canonicalUrl}/t.mbox.gz`;
  const compressed = await fetchBytes(archiveUrl);
  const records = splitMbox(new Uint8Array(gunzipSync(compressed)));
  if (records.length === 0) continue;
  const thread = await parseThread({
    request: {
      source: {
        kind: "static-generated",
        canonicalThreadUrl: canonicalUrl,
        fetchedAt: new Date().toISOString(),
        contentDigest: `generated:${canonicalUrl}`,
      },
    },
    records,
  }, DEFAULT_PARSER_LIMITS);
  threads.push({
    id: thread.id,
    subject: entry.subject || thread.subject,
    updatedAt: entry.updatedAt,
    canonicalUrl,
    thread,
    rawRecords: records.map((record) => Buffer.from(record.bytes).toString("base64")),
  });
}

if (threads.length === 0) throw new Error("no static threads were generated");
await mkdir("public/data", { recursive: true });
await writeFile("public/data/lkml.json", JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  list: "linux-kernel",
  threads,
}, null, 2));
console.log(`generated ${threads.length} linux-kernel threads`);
