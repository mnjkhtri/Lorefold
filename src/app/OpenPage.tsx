import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createLocalImportWorkflow } from "../lore/access";
import { DEFAULT_PARSER_LIMITS } from "../parsing/limits";
import { parseInWorker, type ParserProgress } from "../parsing/worker-client";
import { safeExternalHref } from "../security/safe-links";

export function OpenPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ParserProgress | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [url, setUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [requestedMessageId, setRequestedMessageId] = useState<string | undefined>();
  const [requestedCanonicalUrl, setRequestedCanonicalUrl] = useState<string | undefined>();
  const [requestedLoreUrl, setRequestedLoreUrl] = useState<string | undefined>();

  const parseFile = async (file: File): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(undefined);
    setProgress({ processed: 0, total: 0 });
    try {
      const result = await parseInWorker(
        await file.arrayBuffer(),
        {
          source: {
            kind: "local-file",
            importedFilename: file.name,
            contentDigest: `filename:${file.name}`,
            ...(requestedMessageId === undefined || requestedCanonicalUrl === undefined || requestedLoreUrl === undefined
              ? {}
              : { requestedLoreUrl, canonicalThreadUrl: requestedCanonicalUrl }),
          },
          ...(requestedMessageId === undefined ? {} : { requestedMessageId }),
        },
        DEFAULT_PARSER_LIMITS,
        { signal: controller.signal, onProgress: setProgress },
      );
      navigate(`/thread/${encodeURIComponent(file.name)}`, { state: result });
    } catch (parseError) {
      if (!controller.signal.aborted) {
        setError(parseError instanceof Error ? parseError.message : "File could not be parsed.");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) void parseFile(file);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file !== undefined) void parseFile(file);
  };

  const onUrlSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    try {
      setError(undefined);
      const workflow = createLocalImportWorkflow(url);
      setRequestedMessageId(workflow.reference.messageId);
      setRequestedCanonicalUrl(workflow.reference.canonicalUrl);
      setRequestedLoreUrl(url);
      setDownloadUrl(workflow.downloadUrl);
    } catch (parseError) {
      setDownloadUrl(undefined);
      setRequestedMessageId(undefined);
      setRequestedCanonicalUrl(undefined);
      setRequestedLoreUrl(undefined);
      setError(parseError instanceof Error ? parseError.message : "Lore reference is invalid.");
    }
  };

  const safeDownloadUrl = downloadUrl === undefined ? undefined : safeExternalHref(downloadUrl);

  const cancel = (): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProgress(undefined);
  };

  return (
    <section className="welcome-panel" aria-labelledby="open-title">
      <h1 id="open-title">Open a discussion</h1>
      <p>Choose a local .eml, .mbox, or .mbox.gz file. Parsing stays in a worker.</p>
      <div
        className="file-drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <button type="button" onClick={() => inputRef.current?.click()}>
          Choose mail archive
        </button>
        <span>or drop a file here</span>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".eml,.mbox,.gz,.mbox.gz,message/rfc822,application/gzip"
          onChange={onFileChange}
        />
      </div>
      {progress !== undefined && (
        <p aria-live="polite">
          Parsing {progress.processed}{progress.total > 0 ? ` of ${progress.total}` : ""} records.
          <button type="button" onClick={cancel}>Cancel</button>
        </p>
      )}
      <form onSubmit={onUrlSubmit}>
        <label htmlFor="lore-url">Lore URL or Message-ID</label>
        <input id="lore-url" value={url} onChange={(event) => setUrl(event.target.value)} />
        <button type="submit">Prepare download</button>
      </form>
      {safeDownloadUrl !== undefined && (
        <p>
          Download the complete thread, then choose it above: <a href={safeDownloadUrl} rel="noreferrer">{safeDownloadUrl}</a>
        </p>
      )}
      {error !== undefined && <p role="alert">{error}</p>}
    </section>
  );
}
