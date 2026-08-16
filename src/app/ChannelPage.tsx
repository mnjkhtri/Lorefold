import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ActivityControls, filteredThreads, SyncStatus, ThreadCard } from "./LatestPage";
import { useCatalog } from "./catalog";

export function ChannelPage() {
  const { channel } = useParams<{ channel: string }>();
  const { catalog, error, newCatalog, applyNewCatalog } = useCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const selected = catalog?.channels.find((item) => item.id === channel);
  const threads = useMemo(() => catalog === undefined || channel === undefined ? [] : filteredThreads(catalog, query, filter, channel), [catalog, channel, filter, query]);

  return (
    <section className="activity-page" aria-labelledby="channel-title">
      <div className="page-intro">
        <div><Link className="back-link" to="/">← all activity</Link><h1 id="channel-title">{selected?.label ?? channel}</h1></div>
        {catalog !== undefined && <SyncStatus catalog={catalog} />}
      </div>
      {newCatalog !== undefined && <button className="new-activity" type="button" onClick={applyNewCatalog}>new activity available · show it</button>}
      {catalog === undefined && error === undefined && <p role="status">loading activity…</p>}
      {error !== undefined && <p role="alert">{error}</p>}
      {catalog !== undefined && (
        <>
          <ActivityControls query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
          <div className="activity-heading"><h2>recent discussions</h2><span>{selected === undefined ? "not in this sync yet" : `${threads.length} shown`}</span></div>
          <div className="activity-list">{threads.map((record) => <ThreadCard key={record.id} record={record} />)}</div>
          {threads.length === 0 && <p className="empty-state">this list has no indexed activity in the current sync. it will appear after the next scheduled ingest if Lore exposes it.</p>}
        </>
      )}
    </section>
  );
}
