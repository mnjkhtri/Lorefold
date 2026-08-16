import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { StoredThread } from "../models/storage";
import { IndexedDbThreadRepository } from "../storage/thread-repository";

export function SavedPage() {
  const [records, setRecords] = useState<StoredThread[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const repository = new IndexedDbThreadRepository();
    void repository.list().then(setRecords).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Saved threads could not be opened.");
    });
    return () => { void repository.close(); };
  }, []);

  return (
    <section className="welcome-panel" aria-labelledby="saved-title">
      <p><Link to="/">Open another archive</Link></p>
      <h1 id="saved-title">Saved threads</h1>
      {error !== undefined && <p role="alert">{error}</p>}
      {records.length === 0 ? <p>No saved or recent threads yet.</p> : (
        <ul>
          {records.map((record) => (
            <li key={record.thread.id}>
                <Link
                  to={`/thread/${encodeURIComponent(record.thread.id)}`}
                  state={{ thread: record.thread, rawRecords: record.rawRecords }}
                >
                {record.thread.subject || "(no subject)"}
              </Link>
              {record.saved ? " (saved)" : " (recent)"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
