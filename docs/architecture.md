# architecture

static vite app. github pages. hash routes. no server.

github actions fetches a bounded lkml feed and mboxes, the build publishes
same-origin json, react renders it, indexeddb keeps saved threads, and the
service worker keeps the shell around offline.

local builds use `/`. pages builds use `/Lorefold/`.

lore is fetched by actions because direct browser reads wait for real cors.
list identifiers are discovered during ingestion; the browser has no list
allowlist and no mail-file workflow.
