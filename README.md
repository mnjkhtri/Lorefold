# Lorefold

Lorefold is an unofficial, local-first reader for Linux development
discussions. It is a static GitHub Pages PWA: there is no application backend.
Import `.eml`, `.mbox`, or `.mbox.gz` archives locally; parsing runs in a
dedicated worker and saved threads remain in browser storage.

## Development

```text
npm install
npm run dev
```

The complete local quality gate is:

```text
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

End-to-end tests build and serve the production artifact. Chromium is required
for those tests; install it with `npx playwright install chromium` when needed.

Direct Lore loading is intentionally disabled until a real browser test from
the deployed Pages origin proves readable CORS access. Lorefold is not
affiliated with or endorsed by Lore or the Linux kernel community. Imported
mail remains the responsibility of the user and may be copyrighted.

More detail is in [the architecture notes](docs/architecture.md), [the
security model](docs/security.md), [the data-access decision](docs/data-access.md),
and [the fixture policy](docs/fixtures.md). The reproducible CORS evidence is
in [the technical spike report](docs/spike-report.md).
