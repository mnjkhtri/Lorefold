# Lorefold

a tiny automatic lkml thread reader.

run it:

```text
npm install
npm run dev
```

checks:

```text
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

the pages build fetches a small fresh mailing-list catalog through github actions.
saved threads live in indexeddb. there is no backend.

browser lore fetching stays off because cors is not there. actions fetch the
mboxes and publish same-origin data instead. the archive index is discovered at
ingest time, so the frontend has no built-in mailing-list allowlist.
