import type { ParsedWorkerRecord } from "../parsing/worker-protocol";
import { ContentBlocks } from "./ContentBlocks";

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
    </article>
  );
}
