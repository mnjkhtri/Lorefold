import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import type { ParseWorkerResult } from "../parsing/worker-protocol";
import { resultToThread } from "./result-to-thread";
import { IndexedDbThreadRepository } from "../storage/thread-repository";
import type { Thread } from "../models/thread";
import type { StoredThread } from "../models/storage";
import { RichContentBlocks } from "./RichContentBlocks";
import { SafeTextDialog } from "./SafeTextDialog";
import { PatchView } from "./PatchView";
import { ThreadOverview } from "./ThreadOverview";
import { safeLoreMessageHref } from "../security/safe-links";

function isParseResult(value: unknown): value is ParseWorkerResult {
  return typeof value === "object" && value !== null && "records" in value && Array.isArray(value.records);
}

export function ThreadPage() {
  const location = useLocation();
  const { key } = useParams<{ key: string }>();
  const result = isParseResult(location.state) ? location.state : undefined;
  const savedThread = typeof location.state === "object" && location.state !== null && "thread" in location.state
    ? (location.state as { thread?: Thread }).thread
    : undefined;
  const routeRawRecords = typeof location.state === "object" && location.state !== null && "rawRecords" in location.state
    ? (location.state as { rawRecords?: Uint8Array[] }).rawRecords
    : undefined;
  const [stored, setStored] = useState<StoredThread | undefined>();
  const [saveStatus, setSaveStatus] = useState<string | undefined>();

  useEffect(() => {
    if (result !== undefined || savedThread !== undefined || key === undefined) return undefined;
    const repository = new IndexedDbThreadRepository();
    void repository.get(decodeURIComponent(key)).then(setStored).catch(() => undefined);
    return () => { void repository.close(); };
  }, [key, result, savedThread]);

  const localThread = savedThread ?? stored?.thread;
  const parsedThread = result?.thread;
  const readerThread = localThread ?? parsedThread;
  const rawRecords = routeRawRecords ?? stored?.rawRecords;

  const save = async (): Promise<void> => {
    const thread = readerThread ?? (result === undefined ? undefined : await resultToThread(result));
    if (thread === undefined) return;
    const now = new Date().toISOString();
    const repository = new IndexedDbThreadRepository();
    await repository.put({
      thread,
      rawRecords: result?.records.map((record) => new TextEncoder().encode(record.rawText)),
      saved: true,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    });
    await repository.close();
    setSaveStatus("Saved locally");
  };

  return (
    <section className="welcome-panel" aria-labelledby="thread-title">
      <p><Link to="/">Open another archive</Link></p>
      <h1 id="thread-title">Parsed thread</h1>
      {localThread !== undefined && <p className="offline-notice" role="status">This reader is available offline. Network actions are unavailable.</p>}
      {(result !== undefined || readerThread !== undefined) && (
        <p><button type="button" onClick={() => void save()}>Save thread</button>{saveStatus}</p>
      )}
      {readerThread === undefined ? <p>This thread is not available in this browser session.</p> : (
        <>
          <p aria-live="polite">{result === undefined ? "Saved thread reopened locally." : `${result.records.length} message records imported from the local file.`}</p>
          <ThreadOverview
            messages={Object.fromEntries(Object.values(readerThread.messages).map((message) => [message.id, {
              id: message.id,
              author: message.author.name || "Unknown author",
              subject: message.subject,
              ...(message.parentId === undefined ? {} : { parentId: message.parentId }),
            }]))}
            rootIds={readerThread.rootIds}
            childrenByParent={readerThread.childrenByParent}
          />
          <div className="thread-messages">
            {readerThread.chronologicalIds.map((messageId) => {
              const message = readerThread.messages[messageId];
              if (message === undefined) return null;
              const raw = rawRecords?.[message.sourceOrdinal] ?? result?.records[message.sourceOrdinal]?.rawText;
              return (
                <SavedMessageArticle
                  key={message.id}
                  message={message}
                  rawText={raw instanceof Uint8Array ? new TextDecoder().decode(raw) : raw}
                  patches={readerThread.patches}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function SavedMessageArticle({
  message,
  rawText,
  patches,
}: {
  message: Thread["messages"][string];
  rawText?: string;
  patches?: Thread["patches"];
}) {
  const author = message.author.address === undefined
    ? message.author.name || "Unknown author"
    : `${message.author.name} <${message.author.address}>`;
  return (
    <article className="message-article" id={`message-${encodeURIComponent(message.id)}`}>
      <header>
        <p className="message-article__author">{author}</p>
        <h2>{message.subject || "(no subject)"}</h2>
        <p className="message-article__date">
          {message.timestamp.valid ? message.timestamp.iso : message.timestamp.raw ?? "Unknown date"}
        </p>
        {message.messageId !== undefined && (
          <p className="message-article__source">
            <a href={safeLoreMessageHref(message.messageId)} rel="noopener noreferrer">Canonical Lore message</a>
          </p>
        )}
      </header>
      <RichContentBlocks blocks={message.blocks} />
      {message.patchIds.map((patchId) => {
        const patch = patches?.[patchId];
        return patch === undefined ? null : <PatchView key={patch.id} patch={patch} />;
      })}
      <footer className="message-article__actions">
        <SafeTextDialog
          label="Metadata"
          title="Message metadata"
          text={`Message-ID: ${message.messageId ?? "unavailable"}\nSubject: ${message.subject}`}
          emptyMessage="No metadata was retained."
        />
        <SafeTextDialog
          label="Raw message"
          title="Raw message"
          text={rawText ?? "Raw message unavailable in this saved copy."}
          emptyMessage="Raw message unavailable."
        />
      </footer>
    </article>
  );
}
