import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { GeneratedThreadDocument } from "../models/static-data";
import type { Thread } from "../models/thread";
import { safeLoreMessageHref } from "../security/safe-links";
import { PatchView } from "./PatchView";
import { RichContentBlocks } from "./RichContentBlocks";
import { ThreadOverview } from "./ThreadOverview";
import { fetchThreadDocument } from "./catalog";

export function ThreadPage() {
  const { key } = useParams<{ key: string }>();
  const [document, setDocument] = useState<GeneratedThreadDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (key === undefined || !/^[a-f0-9]{24}$/u.test(key)) {
      setError("invalid thread link");
      return undefined;
    }
    let active = true;
    void fetchThreadDocument(`threads/${key}.json`)
      .then((next) => { if (active) setDocument(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "thread unavailable"); });
    return () => { active = false; };
  }, [key]);

  const thread = document?.thread;
  const initialMessage = thread === undefined ? undefined : firstMessage(thread);
  return (
    <section className="thread-reader" aria-labelledby="thread-title">
      <p><Link to="/">← activity</Link></p>
      {error !== undefined && <p role="alert">{error}</p>}
      {thread === undefined && error === undefined && <p role="status">loading discussion…</p>}
      {thread !== undefined && (
        <>
          <div className="thread-title-row">
            <h1 id="thread-title">{thread.subject || "discussion"}</h1>
            <span className="thread-type">{threadType(thread.subject)}</span>
          </div>
          <dl className="thread-facts">
            <div><dt>author</dt><dd>{initialMessage?.author.name || "unknown"}</dd></div>
            <div><dt>date</dt><dd>{readableDate(initialMessage?.timestamp.iso ?? initialMessage?.timestamp.raw)}</dd></div>
            <div><dt>messages</dt><dd>{thread.chronologicalIds.length}</dd></div>
            <div><dt>patches</dt><dd>{Object.keys(thread.patches ?? {}).length}</dd></div>
            <div><dt>lists</dt><dd>{document?.channels.join(" · ") || "unknown"}</dd></div>
          </dl>
          {initialMessage !== undefined && <MessageMetadata message={initialMessage} />}
          <ThreadOverview
            messages={Object.fromEntries(Object.values(thread.messages).map((message) => [message.id, {
              id: message.id,
              subject: message.subject,
            }]))}
            rootIds={thread.rootIds}
            childrenByParent={thread.childrenByParent}
          />
          <div className="thread-messages">
            {thread.chronologicalIds.map((messageId, index) => {
              const message = thread.messages[messageId];
              return message === undefined ? null : (
                <MessageArticle
                  key={message.id}
                  message={message}
                  patches={thread.patches}
                  ordinal={index + 1}
                  total={thread.chronologicalIds.length}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function MessageMetadata({ message }: { message: Thread["messages"][string] }) {
  const rows: Array<[string, string]> = [
    ["from", formatAddress(message.author)],
    ...(message.sender === undefined ? [] : [["sender", formatAddress(message.sender)] as [string, string]]),
    ...(message.to === undefined || message.to.length === 0 ? [] : [["to", formatAddresses(message.to)] as [string, string]]),
    ...(message.cc === undefined || message.cc.length === 0 ? [] : [["cc", formatAddresses(message.cc)] as [string, string]]),
    ...(message.replyTo === undefined || message.replyTo.length === 0 ? [] : [["reply-to", formatAddresses(message.replyTo)] as [string, string]]),
    ...(message.messageId === undefined ? [] : [["message-id", `<${message.messageId}>`] as [string, string]]),
    ...(message.declaredParentMessageId === undefined ? [] : [["in-reply-to", `<${message.declaredParentMessageId}>`] as [string, string]]),
    ...(message.references.length === 0 ? [] : [["references", message.references.map((value) => `<${value}>`).join(" ")] as [string, string]]),
    ...(message.mailingLists.length === 0 ? [] : [["list-id", message.mailingLists.map((list) => list.id).join(" · ")] as [string, string]]),
    ...(message.mailingLists.some((list) => list.address !== undefined)
      ? [["list-post", message.mailingLists.flatMap((list) => list.address === undefined ? [] : [list.address]).join(" · ")] as [string, string]]
      : []),
  ];
  return (
    <details className="message-metadata">
      <summary>message metadata</summary>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </details>
  );
}

function formatAddresses(addresses: readonly { name: string; address?: string }[]): string {
  return addresses.map(formatAddress).join(", ");
}

function formatAddress(author: { name: string; address?: string }): string {
  if (author.address === undefined) return author.name || "unknown";
  return author.name === "" ? author.address : `${author.name} <${author.address}>`;
}

function firstMessage(thread: Thread) {
  return thread.messages[thread.chronologicalIds[0] ?? ""];
}

function threadType(subject: string): string {
  const value = subject.toUpperCase();
  if (value.includes("RFC")) return "rfc";
  if (value.includes("PATCH")) return "patch";
  return "discussion";
}

function readableDate(value: string | undefined): string {
  if (value === undefined) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function MessageArticle({
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
        <p className="message-article__date">message {ordinal} of {total} · {readableDate(message.timestamp.valid ? message.timestamp.iso : message.timestamp.raw)}</p>
        {message.messageId !== undefined && <p className="message-article__source"><a href={safeLoreMessageHref(message.messageId)} rel="noopener noreferrer">view on lore</a></p>}
      </header>
      <RichContentBlocks blocks={message.blocks.filter((block) => block.kind !== "patch")} />
      {message.patchIds.map((patchId) => {
        const patch = patches?.[patchId];
        return patch === undefined ? null : <PatchView key={patch.id} patch={patch} />;
      })}
    </article>
  );
}
