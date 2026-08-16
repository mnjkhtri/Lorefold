import type { ParsedWorkerRecord } from "../parsing/worker-protocol";
import { ContentBlocks } from "./ContentBlocks";
import { SafeTextDialog } from "./SafeTextDialog";

export function MessageArticle({ record }: { record: ParsedWorkerRecord }) {
  const author = record.headers.author.address === undefined
    ? record.headers.author.name || "Unknown author"
    : `${record.headers.author.name} <${record.headers.author.address}>`;
  return (
    <article className="message-article">
      <header>
        <p className="message-article__author">{author}</p>
        <h2>{record.headers.subject || "(no subject)"}</h2>
        <p className="message-article__date">
          {record.headers.timestamp.valid ? record.headers.timestamp.iso : record.headers.timestamp.raw ?? "Unknown date"}
        </p>
      </header>
      <ContentBlocks text={record.body.text} />
      <footer className="message-article__actions">
        <SafeTextDialog
          label="Metadata"
          title="Message metadata"
          text={record.headers.rawHeaders.map((header) => `${header.originalKey}: ${header.value}`).join("\n")}
          emptyMessage="No headers were retained."
        />
        <SafeTextDialog label="Raw message" title="Raw message" text={record.rawText} emptyMessage="Raw message unavailable." />
      </footer>
    </article>
  );
}
