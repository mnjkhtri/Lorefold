import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { GeneratedCatalog } from "../models/static-data";
import { safeLoreThreadHref } from "../security/safe-links";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function LatestPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<GeneratedCatalog | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}data/lkml.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`catalog unavailable (${response.status})`);
        return response.json() as Promise<GeneratedCatalog>;
      })
      .then(setCatalog)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "catalog unavailable"));
  }, []);

  return (
    <section className="welcome-panel latest-panel" aria-labelledby="latest-title">
      <h1 id="latest-title">linux kernel threads</h1>
      <p>fresh discussions from lkml, rendered automatically.</p>
      {catalog === undefined && error === undefined && <p role="status">loading threads…</p>}
      {error !== undefined && (
        <p role="alert">{error}. <Link to="/import">open a local archive instead</Link>.</p>
      )}
      {catalog !== undefined && (
        <>
          <p>updated {new Date(catalog.generatedAt).toLocaleString()}</p>
          <ol className="latest-threads">
            {catalog.threads.map((record) => {
              const href = safeLoreThreadHref(record.canonicalUrl);
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/thread/${encodeURIComponent(record.id)}`, {
                      state: {
                        thread: record.thread,
                        rawRecords: record.rawRecords.map(decodeBase64),
                      },
                    })}
                  >
                    {record.subject || "(no subject)"}
                  </button>
                  <span>{record.updatedAt}</span>
                  {href !== undefined && <a href={href} rel="noopener noreferrer">source</a>}
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p><Link to="/import">import a local archive</Link></p>
    </section>
  );
}
