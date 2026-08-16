# Lorefold

a tiny live reader for linux mailing lists.

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

github actions discovers lore archives, shallow-fetches recent messages, and
publishes static thread data. no backend. no uploads. no list allowlist.
