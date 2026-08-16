import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";

import { DEFAULT_PARSER_LIMITS } from "../src/parsing/limits";
import { splitMbox } from "../src/parsing/mbox";
import { parseThread } from "../src/parsing/thread-parser";

const USER_AGENT = "Lorefold static catalog/0.1 (https://github.com/mnjkhtri/Lorefold)";
const MAX_LISTS = Number(process.env.LOREFOLD_MAX_LISTS ?? "12");
const MAX_THREADS_PER_LIST = Number(process.env.LOREFOLD_MAX_THREADS_PER_LIST ?? "2");
const MAX_COMPRESSED_THREAD_BYTES = 10 * 1024 * 1024;

interface GeneratedThread {
  id: string;
  subject: string;
  updatedAt: string;
  canonicalUrl: string;
  channel: string;
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
for (const list of lists) {
  const feed = new TextDecoder().decode(await fetchBytes(`https://lore.kernel.org/${encodeURIComponent(list.id)}/new.atom`));
  const seen = new Set<string>();
  for (const entry of entries(feed)) {
    if (threads.filter((item) => item.channel === list.id).length >= MAX_THREADS_PER_LIST) break;
    const canonicalUrl = entry.url.replace(/\/$/u, "");
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);
    const compressed = await fetchBytes(`${canonicalUrl}/t.mbox.gz`);
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
    const subject = entry.subject || thread.subject;
    const first = thread.messages[thread.chronologicalIds[0] ?? ""];
    const latest = thread.messages[thread.chronologicalIds.at(-1) ?? ""];
    const classification = classify(subject, list.id);
    threads.push({
      id: thread.id,
      subject,
      updatedAt: entry.updatedAt,
      canonicalUrl,
      channel: list.id,
      author: authorName(first),
      latestParticipant: authorName(latest),
      messageCount: thread.chronologicalIds.length,
      replyCount: Math.max(0, thread.chronologicalIds.length - 1),
      ...classification,
      thread,
      rawRecords: records.map((record) => Buffer.from(record.bytes).toString("base64")),
    });
  }
}

if (threads.length === 0) throw new Error("no static threads were generated");
await mkdir("public/data", { recursive: true });
await writeFile("public/data/lkml.json", JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  channels: lists.map((list) => ({
    id: list.id,
    label: list.label,
    threadCount: threads.filter((thread) => thread.channel === list.id).length,
  })),
  threads,
}, null, 2));
console.log(`generated ${threads.length} threads across ${lists.length} discovered lists`);
