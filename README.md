# Lorefold

a tiny local-first mail thread reader.

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

drop in `.eml`, `.mbox`, or `.mbox.gz` files. parsing happens in a worker.
saved threads live in indexeddb. there is no backend.

lore fetching stays off because browser cors is not there. download the mbox,
then open it here.

the pages workflow is ready, but github pages must be enabled for the repo
before it can publish.
