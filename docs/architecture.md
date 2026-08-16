# Architecture

Lorefold is a static React/TypeScript/Vite PWA intended for GitHub Pages. It
has no application server, API proxy, serverless function, database service, or
authentication service.

## Data flow

1. The user selects an `.eml`, `.mbox`, `.mbox.gz`, or `.gz` file.
2. The browser transfers the file bytes to a dedicated parser worker.
3. Bounded decompression, mbox splitting, MIME normalization, header parsing,
   body projection, quote/signature detection, patch parsing, and deterministic
   thread reconstruction produce public application models.
4. React renders text-only message content and structured disclosures/diffs.
5. Saved and recent snapshots are stored in IndexedDB. The PWA service worker
   caches only the static application shell and build assets.

Persisted models are independent of `postal-mime` and other parser-library
types. Thread maps and ordered ID arrays are used instead of recursive
persisted trees. Hash routing keeps direct reloads compatible with a static
Pages host.

## Deployment paths

Local builds use `/` by default. The Pages workflow sets
`VITE_BASE_PATH=/Lorefold/`; Vite derives JavaScript, worker, manifest, icon,
and service-worker paths from that base. The Pages-base E2E suite tests the
same subpath artifact before upload.

## Lore access decision

The real Pages-origin browser probe recorded in [spike-report.md](spike-report.md)
could not read Lore responses because the tested endpoints did not grant
browser CORS access. Direct loading therefore remains disabled. A pasted Lore
URL is validated and converted into the exact complete-thread mbox download
URL; the user downloads it and imports it locally.
