import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import type { ParseWorkerResult } from "../parsing/worker-protocol";
import { IndexedDbThreadRepository } from "../storage/thread-repository";
import type { Thread } from "../models/thread";
import type { StoredThread } from "../models/storage";
import { RichContentBlocks } from "./RichContentBlocks";
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
  const [stored, setStored] = useState<StoredThread | undefined>();

  useEffect(() => {
    if (result !== undefined || savedThread !== undefined || key === undefined) return undefined;
    const repository = new IndexedDbThreadRepository();
    void repository.get(decodeURIComponent(key)).then(setStored).catch(() => undefined);
    return () => { void repository.close(); };
  }, [key, result, savedThread]);

  const localThread = savedThread ?? stored?.thread;
  const isOfflineCopy = stored !== undefined || savedThread?.source.kind === "local-file";
  const parsedThread = result?.thread;
  const readerThread = localThread ?? parsedThread;

  return (
    <section className="welcome-panel thread-reader" aria-labelledby="thread-title">
      <p><Link to="/">← activity</Link></p>
      <div className="thread-title-row">
        <h1 id="thread-title">{readerThread?.subject || "discussion"}</h1>
        {readerThread !== undefined && <span className="thread-type">{threadType(readerThread.subject)}</span>}
      </div>
      {isOfflineCopy && <p className="offline-notice" role="status">saved locally · available offline · network actions are unavailable</p>}
      {readerThread === undefined ? <p>This thread is not available in this browser session.</p> : (
        <>
          <dl className="thread-facts">
            <div><dt>author</dt><dd>{readerThread.messages[readerThread.chronologicalIds[0] ?? ""]?.author.name || "unknown"}</dd></div>
            <div><dt>date</dt><dd>{readerThread.messages[readerThread.chronologicalIds[0] ?? ""]?.timestamp.iso ?? readerThread.messages[readerThread.chronologicalIds[0] ?? ""]?.timestamp.raw ?? "unknown"}</dd></div>
            <div><dt>messages</dt><dd>{readerThread.chronologicalIds.length}</dd></div>
            <div><dt>patches</dt><dd>{Object.keys(readerThread.patches ?? {}).length}</dd></div>
            <div><dt>lists</dt><dd>{[...new Set(Object.values(readerThread.messages).flatMap((message) => message.mailingLists.map((list) => list.displayName || list.id)))].join(" · ") || "unknown"}</dd></div>
          </dl>
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
            {readerThread.chronologicalIds.map((messageId, index) => {
              const message = readerThread.messages[messageId];
              if (message === undefined) return null;
              return (
                <SavedMessageArticle
                  key={message.id}
                  message={message}
                  patches={readerThread.patches}
                  ordinal={index + 1}
                  total={readerThread.chronologicalIds.length}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function threadType(subject: string): string {
  const value = subject.toUpperCase();
  if (value.includes("RFC")) return "rfc";
  if (value.includes("PATCH")) return "patch";
  return "discussion";
}

function SavedMessageArticle({
  message,
  patches,
  ordinal,
  total,
}: {
  message: Thread["messages"][string];
  patches?: Thread["patches"];
  ordinal: number;
  total: number;
}) {
  return (
    <article className={`message-article${message.patchIds.length > 0 ? " message-article--patch" : ""}`} id={`message-${encodeURIComponent(message.id)}`}>
      <header>
        <p className="message-article__author"><strong>{message.author.name || "Unknown author"}</strong></p>
        <h2>{message.subject || "(no subject)"}</h2>
        <p className="message-article__date">
          message {ordinal} of {total} · {" "}
          {message.timestamp.valid ? message.timestamp.iso : message.timestamp.raw ?? "Unknown date"}
        </p>
        {message.messageId !== undefined && (
          <p className="message-article__source">
            <a href={safeLoreMessageHref(message.messageId)} rel="noopener noreferrer">view on lore</a>
          </p>
        )}
      </header>
      <RichContentBlocks blocks={message.blocks.filter((block) => block.kind !== "patch")} />
      {message.patchIds.map((patchId) => {
        const patch = patches?.[patchId];
        return patch === undefined ? null : <PatchView key={patch.id} patch={patch} />;
      })}
    </article>
  );
}
