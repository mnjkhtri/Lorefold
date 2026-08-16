import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { GeneratedCatalog, GeneratedThreadRecord } from "../models/static-data";
import { safeLoreThreadHref } from "../security/safe-links";
import { useCatalog } from "./catalog";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function ThreadCard({ record }: { record: GeneratedThreadRecord }) {
  const navigate = useNavigate();
  const href = safeLoreThreadHref(record.canonicalUrl);
  return (
    <article className="activity-card">
      <div className="activity-card__main">
        <button type="button" className="activity-card__title" onClick={() => navigate(`/thread/${encodeURIComponent(record.id)}`, {
          state: { thread: record.thread, rawRecords: record.rawRecords.map(decodeBase64) },
        })}>
          {record.subject || "(no subject)"}
        </button>
        <p className="activity-card__meta">
          <span>{record.author}</span>
          <span>{record.channels.join(" · ")}</span>
          <span>{record.replyCount} {record.replyCount === 1 ? "reply" : "replies"}</span>
          <span>{relativeTime(record.updatedAt)}</span>
        </p>
      </div>
      <div className="activity-card__tags">
        <span className={`activity-type activity-type--${record.activityType}`}>{record.activityType}</span>
        {record.patchVersion !== undefined && <span>{record.patchVersion}</span>}
        {record.topics.slice(0, 2).map((topic) => <span key={topic}>{topic}</span>)}
        {href !== undefined && <a href={href} rel="noopener noreferrer">lore</a>}
      </div>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function relativeTime(value: string): string {
  const age = Date.now() - Date.parse(value);
  if (!Number.isFinite(age) || age < 0) return "recently";
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityControls({ query, setQuery, filter, setFilter }: {
  query: string;
  setQuery: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
}) {
  return (
    <div className="activity-controls">
      <label>
        <span className="visually-hidden">Search discussions</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search discussions" type="search" />
      </label>
      <div className="filter-pills" aria-label="Activity type">
        {(["all", "patch", "rfc", "discussion"] as const).map((value) => (
          <button key={value} type="button" className={filter === value ? "is-selected" : ""} onClick={() => setFilter(value)}>
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function OpenListForm() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const listId = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9+._-]*$/u.test(listId)) {
      setError("use the list identifier from lore.kernel.org");
      return;
    }
    setError(undefined);
    navigate(`/channel/${encodeURIComponent(listId)}`);
  };
  return (
    <form className="open-list-form" onSubmit={submit}>
      <label htmlFor="list-id">open another list</label>
      <div><input id="list-id" value={value} onChange={(event) => setValue(event.target.value)} placeholder="list identifier" /><button type="submit">open</button></div>
      {error !== undefined && <small role="alert">{error}</small>}
    </form>
  );
}

export function filteredThreads(catalog: GeneratedCatalog, query: string, filter: string, channel?: string) {
  const normalized = query.trim().toLowerCase();
  return catalog.threads
    .filter((record) => channel === undefined || record.channels.includes(channel))
    .filter((record) => filter === "all" || record.activityType === filter)
    .filter((record) => normalized.length === 0 || [record.subject, record.author, record.latestParticipant, ...record.channels, ...record.topics]
      .join(" ").toLowerCase().includes(normalized))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function LatestPage() {
  const navigate = useNavigate();
  const { catalog, error, newCatalog, refreshing, applyNewCatalog } = useCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const activeCatalog = catalog;
  const threads = useMemo(() => activeCatalog === undefined ? [] : filteredThreads(activeCatalog, query, filter, selectedChannel === "all" ? undefined : selectedChannel), [activeCatalog, filter, query, selectedChannel]);

  return (
    <section className="activity-page" aria-labelledby="latest-title">
      <div className="page-intro">
        <div>
          <p className="eyebrow">kernel development, in motion</p>
          <h1 id="latest-title">latest activity</h1>
        </div>
        {activeCatalog !== undefined && <SyncStatus catalog={activeCatalog} refreshing={refreshing} />}
      </div>
      {newCatalog !== undefined && (
        <button className="new-activity" type="button" onClick={applyNewCatalog}>new activity available · show it</button>
      )}
      {catalog === undefined && error === undefined && <p role="status">loading activity…</p>}
      {error !== undefined && <p role="alert">{error}</p>}
      {activeCatalog !== undefined && (
        <>
          <div className="index-toolbar">
            <label className="list-select">
              <span className="visually-hidden">Mailing list</span>
              <select value={selectedChannel} onChange={(event) => setSelectedChannel(event.target.value)}>
                <option value="all">all lists</option>
                {activeCatalog.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
              </select>
            </label>
            <label className="index-search">
              <span className="visually-hidden">Search activity</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search subject, author, list" type="search" />
            </label>
            <div className="filter-pills" aria-label="Activity type">
              {(["all", "patch", "rfc", "discussion"] as const).map((value) => <button key={value} type="button" className={filter === value ? "is-selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "messages" : value === "patch" ? "patchsets" : value}</button>)}
            </div>
          </div>
          <OpenListForm />
          <div className="activity-heading"><h2>recent activity</h2><span>{threads.length} shown</span></div>
          <div className="activity-list">
            <table className="activity-table">
              <thead><tr><th scope="col">subject</th><th scope="col">author</th><th scope="col">date</th><th scope="col">messages</th><th scope="col">type</th></tr></thead>
              <tbody>{threads.map((record) => {
                const href = safeLoreThreadHref(record.canonicalUrl);
                const labels = [...new Set([...record.channels, ...record.topics])].slice(0, 4);
                return <tr className="activity-card" key={record.id}>
                  <td className="activity-subject"><button type="button" className="activity-card__title" onClick={() => navigate(`/thread/${encodeURIComponent(record.id)}`, { state: { thread: record.thread, rawRecords: record.rawRecords.map(decodeBase64) } })}>{record.subject || "(no subject)"}</button><div className="activity-labels">{labels.map((label) => record.channels.includes(label) ? <Link key={label} to={`/channel/${encodeURIComponent(label)}`}>{label}</Link> : <span key={label}>{label}</span>)}</div>{href !== undefined && <a className="activity-source" href={href} rel="noopener noreferrer">lore</a>}</td>
                  <td>{record.author}</td><td>{formatDate(record.updatedAt)}<small>{relativeTime(record.updatedAt)}</small></td><td>{record.messageCount}</td><td><span className={`activity-type activity-type--${record.activityType}`}>{record.activityType}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {threads.length === 0 && <p className="empty-state">nothing matches that filter.</p>}
        </>
      )}
    </section>
  );
}

export function SyncStatus({ catalog, refreshing = false }: { catalog: GeneratedCatalog; refreshing?: boolean }) {
  return <p className={`sync-status${refreshing ? " is-refreshing" : ""}`} role="status"><span className="sync-dot" aria-hidden="true" />{refreshing ? "checking for latest activity…" : `synced ${relativeTime(catalog.generatedAt)}`}</p>;
}
