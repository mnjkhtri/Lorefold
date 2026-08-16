import { mkdir, writeFile } from "node:fs/promises";

import { DEFAULT_PARSER_LIMITS } from "../src/parsing/limits";
import { decodeBounded } from "../src/parsing/compression";
import { splitMbox } from "../src/parsing/mbox";
import { parseThread } from "../src/parsing/thread-parser";

const USER_AGENT = "Lorefold static catalog/0.1 (https://github.com/mnjkhtri/Lorefold)";
const MAX_LISTS = Number(process.env.LOREFOLD_MAX_LISTS ?? "12");
const MAX_THREADS_PER_LIST = Number(process.env.LOREFOLD_MAX_THREADS_PER_LIST ?? "2");
const MAX_COMPRESSED_THREAD_BYTES = 1 * 1024 * 1024;
const MAX_GENERATED_RECORDS = Number(process.env.LOREFOLD_MAX_GENERATED_RECORDS ?? "250");
const MAX_GENERATED_MESSAGES = Number(process.env.LOREFOLD_MAX_GENERATED_MESSAGES ?? "1000");
const FETCH_CONCURRENCY = 4;

interface GeneratedThread {
  id: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  channels: string[];
  author: string;
  latestParticipant: string;
  messageCount: number;
  replyCount: number;
  activityType: "patch" | "rfc" | "discussion";
  patchVersion?: string;
  topics: string[];
  thread: Awaited<ReturnType<typeof parseThread>>;
  rawRecords: string[];
}

interface DiscoveredList {
  id: string;
  label: string;
}

function authorName(message: Awaited<ReturnType<typeof parseThread>>["messages"][string] | undefined): string {
  return message?.author.name || "unknown author";
}

function classify(subject: string, channel: string): { activityType: GeneratedThread["activityType"], patchVersion?: string, topics: string[] } {
  const upper = subject.toUpperCase();
  const topics = [...new Set(`${channel} ${subject}`.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/gu) ?? [])]
    .filter((topic) => !["the", "and", "for", "from", "with", "this", "that", "patch", "re", "resend"].includes(topic))
    .slice(0, 4);
  const version = upper.match(/\bV(\d+)\b/u)?.[1];
  return {
    activityType: upper.includes("RFC") ? "rfc" : upper.includes("PATCH") ? "patch" : "discussion",
    ...(version === undefined ? {} : { patchVersion: `v${version}` }),
    topics: [...topics],
  };
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

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
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

function discoveredLists(index: string): DiscoveredList[] {
  const seen = new Set<string>();
  return [...index.matchAll(/<a\s+href="([^"]+)">([^<]+)<\/a>/gu)].flatMap((match) => {
    const id = match[1]?.trim();
    const label = xmlText(match[2] ?? id ?? "");
    if (id === undefined || label === "" || id === "all" || id.includes("/") || id.startsWith("+")) return [];
    if (!/^[a-z0-9][a-z0-9+._-]*$/u.test(id) || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label }];
  });
}

const index = new TextDecoder().decode(await fetchBytes("https://lore.kernel.org/"));
const lists = discoveredLists(index).slice(0, MAX_LISTS);
const threads: GeneratedThread[] = [];
const threadByUrl = new Map<string, GeneratedThread>();
const threadById = new Map<string, GeneratedThread>();
const warnings: string[] = [];
let generatedMessageCount = 0;
const listEntries = await mapWithConcurrency(lists, FETCH_CONCURRENCY, async (list) => {
  try {
    const feed = new TextDecoder().decode(await fetchBytes(`https://lore.kernel.org/${encodeURIComponent(list.id)}/new.atom`));
    const seen = new Set<string>();
    return entries(feed).filter((entry) => {
      const canonicalUrl = entry.url.replace(/\/$/u, "");
      if (seen.has(canonicalUrl)) return false;
      seen.add(canonicalUrl);
      return true;
    }).slice(0, MAX_THREADS_PER_LIST).map((entry) => ({ list, entry }));
  } catch (reason: unknown) {
    warnings.push(`${list.id}: feed unavailable (${reason instanceof Error ? reason.message : "unavailable"})`);
    return [];
  }
});

const fetchedThreads = await mapWithConcurrency(listEntries.flat(), FETCH_CONCURRENCY, async ({ list, entry }) => {
  const canonicalUrl = entry.url.replace(/\/$/u, "");
  try {
    const compressed = await fetchBytes(`${canonicalUrl}/t.mbox.gz`);
    const decoded = await decodeBounded(compressed, {
      maxCompressedBytes: MAX_COMPRESSED_THREAD_BYTES,
      maxDecompressedBytes: 32 * 1024 * 1024,
    });
    const records = splitMbox(decoded);
    if (records.length > MAX_GENERATED_RECORDS) throw new Error(`thread contains ${records.length} messages`);
    return { list, entry, canonicalUrl, records };
  } catch (reason: unknown) {
    warnings.push(`${list.id}: thread skipped (${reason instanceof Error ? reason.message : "unavailable"})`);
    return undefined;
  }
});

for (const fetched of fetchedThreads) {
  if (fetched === undefined || fetched.records.length === 0) continue;
  const { list, entry, canonicalUrl, records } = fetched;
  if (generatedMessageCount + records.length > MAX_GENERATED_MESSAGES) continue;
  const existing = threadByUrl.get(canonicalUrl);
  if (existing !== undefined) {
    if (!existing.channels.includes(list.id)) existing.channels.push(list.id);
    continue;
  }
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
    const subject = entry.subject || thread.subject;
    const existingThread = threadById.get(thread.id);
    if (existingThread !== undefined) {
      if (!existingThread.channels.includes(list.id)) existingThread.channels.push(list.id);
      threadByUrl.set(canonicalUrl, existingThread);
      continue;
    }
    const first = thread.messages[thread.chronologicalIds[0] ?? ""];
    const latest = thread.messages[thread.chronologicalIds.at(-1) ?? ""];
    const classification = classify(subject, list.id);
    const generated: GeneratedThread = {
      id: thread.id,
      subject,
      updatedAt: entry.updatedAt,
      canonicalUrl,
      channels: [list.id],
      author: authorName(first),
      latestParticipant: authorName(latest),
      messageCount: thread.chronologicalIds.length,
      replyCount: Math.max(0, thread.chronologicalIds.length - 1),
      ...classification,
      thread,
      rawRecords: records.map((record) => Buffer.from(record.bytes).toString("base64")),
    };
    threads.push(generated);
    generatedMessageCount += records.length;
    threadByUrl.set(canonicalUrl, generated);
    threadById.set(thread.id, generated);
}

if (threads.length === 0) throw new Error("no static threads were generated");
await mkdir("public/data", { recursive: true });
await writeFile("public/data/lkml.json", JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  channels: lists.map((list) => ({
    id: list.id,
    label: list.label,
    threadCount: threads.filter((thread) => thread.channels.includes(list.id)).length,
  })),
  threads,
  ...(warnings.length === 0 ? {} : { warnings }),
}, null, 2));
console.log(`generated ${threads.length} threads across ${lists.length} discovered lists`);
