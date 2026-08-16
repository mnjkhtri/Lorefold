import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GeneratedCatalog, GeneratedThreadDocument, GeneratedThreadRecord } from "../src/models/static-data";
import type { RawMessageRecord } from "../src/models/thread";
import { normalizeHeaders } from "../src/parsing/headers";
import { DEFAULT_PARSER_LIMITS } from "../src/parsing/limits";
import { parseMimeMessage } from "../src/parsing/mime";
import { parseThread } from "../src/parsing/thread-parser";

const USER_AGENT = "Lorefold static reader/0.1 (https://github.com/mnjkhtri/Lorefold)";
const MANIFEST_URL = "https://lore.kernel.org/manifest.js.gz";
const MAX_ACTIVE_LISTS = Number(process.env.LOREFOLD_MAX_LISTS ?? "8");
const MAX_MESSAGES = Number(process.env.LOREFOLD_MAX_MESSAGES ?? "10000");
const MAX_MESSAGES_PER_THREAD = Number(process.env.LOREFOLD_MAX_MESSAGES_PER_THREAD ?? "250");
const MAX_RAW_MESSAGE_BYTES = 4 * 1024 * 1024;
const FETCH_CONCURRENCY = 2;
const OBJECT_CONCURRENCY = 8;

interface ManifestEntry {
  modified: number;
}

interface Archive {
  id: string;
  epoch: number;
  modified: number;
  path: string;
}

interface ArchiveMessage {
  archiveId: string;
  commit: string;
  committedAt: string;
  bytes: Uint8Array;
}

interface InspectedMessage extends ArchiveMessage {
  id: string;
  parentId?: string;
  references: string[];
  subject: string;
  timestamp: string;
  archiveIds: Set<string>;
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

async function fetchManifest(): Promise<Record<string, ManifestEntry>> {
  const response = await fetch(MANIFEST_URL, {
    headers: { accept: "application/gzip", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Lore manifest returned ${response.status}`);
  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text) as Record<string, ManifestEntry>;
}

function archivesFromManifest(manifest: Record<string, ManifestEntry>): Archive[] {
  const latest = new Map<string, Archive>();
  for (const [path, metadata] of Object.entries(manifest)) {
    const match = path.match(/^\/([a-z0-9][a-z0-9+._-]*)\/git\/(\d+)\.git$/u);
    if (match === null || !Number.isFinite(metadata.modified)) continue;
    const id = match[1];
    const epoch = Number(match[2]);
    const archive: Archive = {
      id,
      epoch,
      modified: metadata.modified,
      path,
    };
    const current = latest.get(id);
    if (current === undefined || archive.epoch > current.epoch) latest.set(id, archive);
  }
  return [...latest.values()];
}

async function run(command: string, args: string[], options: { maxBytes?: number; timeoutMs?: number } = {}): Promise<Uint8Array> {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 30_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) child.kill("SIGTERM");
      else output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0 && size <= maxBytes) resolve(new Uint8Array(Buffer.concat(output)));
      else reject(new Error(`${command} failed (${signal ?? code}): ${Buffer.concat(errors).toString("utf8").trim()}`));
    });
  });
}

async function fetchArchiveMessages(archive: Archive, depth: number, workspace: string): Promise<ArchiveMessage[]> {
  const repository = join(workspace, `${archive.id}.git`);
  await run("git", ["clone", "--quiet", "--bare", `--depth=${depth}`, `https://lore.kernel.org${archive.path}`, repository], {
    timeoutMs: 45_000,
  });
  const log = new TextDecoder().decode(await run("git", ["--git-dir", repository, "log", `--max-count=${depth}`, "--format=%H%x09%ct"]));
  const commits = log.trim().split("\n").flatMap((line) => {
    const [commit, timestamp] = line.split("\t");
    return commit === undefined || timestamp === undefined ? [] : [{ commit, timestamp }];
  });
  return mapWithConcurrency(commits, OBJECT_CONCURRENCY, async ({ commit, timestamp }) => ({
    archiveId: archive.id,
    commit,
    committedAt: new Date(Number(timestamp) * 1000).toISOString(),
    bytes: await run("git", ["--git-dir", repository, "show", `${commit}:m`], {
      maxBytes: MAX_RAW_MESSAGE_BYTES,
      timeoutMs: 10_000,
    }),
  }));
}

async function inspectMessage(message: ArchiveMessage): Promise<InspectedMessage> {
  const mime = await parseMimeMessage(message.bytes, {
    maxRawBytes: MAX_RAW_MESSAGE_BYTES,
    maxHeaderBytes: DEFAULT_PARSER_LIMITS.maxHeaderBytes,
    maxNestingDepth: DEFAULT_PARSER_LIMITS.maxMimeDepth,
  });
  const headers = normalizeHeaders(mime, { maxReferences: DEFAULT_PARSER_LIMITS.maxReferences });
  return {
    ...message,
    id: headers.messageId ?? `commit:${message.commit}`,
    ...(headers.declaredParentMessageId === undefined ? {} : { parentId: headers.declaredParentMessageId }),
    references: headers.references,
    subject: headers.subject,
    timestamp: headers.timestamp.iso ?? message.committedAt,
    archiveIds: new Set([message.archiveId]),
  };
}

function resolveRoot(message: InspectedMessage, messages: Map<string, InspectedMessage>, seen = new Set<string>()): string {
  if (seen.has(message.id)) return message.id;
  seen.add(message.id);
  const candidate = message.references[0] ?? message.parentId;
  if (candidate === undefined) return message.id;
  const ancestor = messages.get(candidate);
  return ancestor === undefined ? candidate : resolveRoot(ancestor, messages, seen);
}

function classify(subject: string): Pick<GeneratedThreadRecord, "activityType" | "patchVersion"> {
  const upper = subject.toUpperCase();
  const version = upper.match(/\bV(\d+)\b/u)?.[1];
  return {
    activityType: upper.includes("RFC") ? "rfc" : upper.includes("PATCH") ? "patch" : "discussion",
    ...(version === undefined ? {} : { patchVersion: `v${version}` }),
  };
}

function threadTopics(thread: GeneratedThreadDocument["thread"]): string[] {
  return [...new Set(Object.values(thread.patches ?? {}).flatMap((patch) => patch.files.map((file) => file.displayPath.split("/")[0])))].slice(0, 6);
}

const manifest = await fetchManifest();
const archives = archivesFromManifest(manifest);
if (archives.length === 0) throw new Error("Lore manifest did not expose any public-inbox archives");
const activeArchives = archives.slice().sort((left, right) => right.modified - left.modified).slice(0, MAX_ACTIVE_LISTS);
const depth = Math.max(1, Math.ceil(MAX_MESSAGES / activeArchives.length));
const workspace = await mkdtemp(join(tmpdir(), "lorefold-ingest-"));
const warnings: string[] = [];

const archiveResults = await mapWithConcurrency(activeArchives, FETCH_CONCURRENCY, async (archive) => {
  try {
    return await fetchArchiveMessages(archive, depth, workspace);
  } catch (reason: unknown) {
    warnings.push(`${archive.id}: ${reason instanceof Error ? reason.message : "archive unavailable"}`);
    return [];
  }
});

const inspected = await mapWithConcurrency(archiveResults.flat(), OBJECT_CONCURRENCY, inspectMessage);
const byId = new Map<string, InspectedMessage>();
for (const message of inspected) {
  const existing = byId.get(message.id);
  if (existing === undefined) byId.set(message.id, message);
  else message.archiveIds.forEach((id) => existing.archiveIds.add(id));
}

const grouped = new Map<string, InspectedMessage[]>();
for (const message of byId.values()) {
  const root = resolveRoot(message, byId);
  grouped.set(root, [...(grouped.get(root) ?? []), message]);
}

const generatedAt = new Date().toISOString();
const summaries: GeneratedThreadRecord[] = [];
const documents: Array<{ key: string; document: GeneratedThreadDocument }> = [];
for (const [rootId, group] of grouped) {
  const ordered = group.slice().sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const bounded = ordered.length <= MAX_MESSAGES_PER_THREAD
    ? ordered
    : [ordered[0], ...ordered.slice(-(MAX_MESSAGES_PER_THREAD - 1))];
  const records: RawMessageRecord[] = bounded.map((message, sourceOrdinal) => ({ bytes: message.bytes, sourceOrdinal }));
  try {
    const canonicalUrl = `https://lore.kernel.org/r/${encodeURIComponent(rootId)}/`;
    const thread = await parseThread({
      request: {
        source: {
          kind: "static-generated",
          canonicalThreadUrl: canonicalUrl,
          fetchedAt: generatedAt,
          contentDigest: `lore-git:${rootId}`,
        },
      },
      records,
    }, { ...DEFAULT_PARSER_LIMITS, maxRecords: MAX_MESSAGES_PER_THREAD });
    const key = createHash("sha256").update(rootId).digest("hex").slice(0, 24);
    const channels = [...new Set(group.flatMap((message) => [...message.archiveIds]))].sort();
    const first = thread.messages[thread.chronologicalIds[0] ?? ""];
    const latest = thread.messages[thread.chronologicalIds.at(-1) ?? ""];
    const document: GeneratedThreadDocument = {
      schemaVersion: 1,
      generatedAt,
      id: key,
      canonicalUrl,
      channels,
      coverage: { kind: "bounded-window", maxMessages: MAX_MESSAGES },
      thread,
    };
    summaries.push({
      id: key,
      dataPath: `threads/${key}.json`,
      subject: thread.subject || group[0]?.subject || "(no subject)",
      updatedAt: latest?.timestamp.iso ?? ordered.at(-1)?.timestamp ?? generatedAt,
      canonicalUrl,
      channels,
      author: first?.author.name || "unknown author",
      latestParticipant: latest?.author.name || "unknown author",
      messageCount: thread.chronologicalIds.length,
      replyCount: Math.max(0, thread.chronologicalIds.length - 1),
      ...classify(thread.subject),
      topics: threadTopics(thread),
    });
    documents.push({ key, document });
  } catch (reason: unknown) {
    warnings.push(`thread ${rootId}: ${reason instanceof Error ? reason.message : "parse failed"}`);
  }
}

if (summaries.length === 0) throw new Error("no recent Lore threads were generated");
summaries.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
const catalog: GeneratedCatalog = {
  schemaVersion: 1,
  generatedAt,
  channels: archives.slice().sort((left, right) => left.id.localeCompare(right.id)).map((archive) => ({
    id: archive.id,
    threadCount: summaries.filter((thread) => thread.channels.includes(archive.id)).length,
  })),
  threads: summaries,
  ...(warnings.length === 0 ? {} : { warnings }),
};

const dataDirectory = "public/data";
const threadDirectory = join(dataDirectory, "threads");
await mkdir(threadDirectory, { recursive: true });
for (const filename of await readdir(threadDirectory)) {
  if (filename.endsWith(".json")) await unlink(join(threadDirectory, filename));
}
await Promise.all(documents.map(({ key, document }) => writeFile(join(threadDirectory, `${key}.json`), JSON.stringify(document))));
await writeFile(join(dataDirectory, "catalog.json"), JSON.stringify(catalog));
console.log(`generated ${summaries.length} threads from ${inspected.length} recent messages across ${activeArchives.length} active archives`);
