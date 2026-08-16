# architecture

static vite app. github pages. hash routes. no server.

files go to a worker, the worker makes plain data, react renders it, indexeddb
keeps saved threads, and the service worker keeps the shell around offline.

local builds use `/`. pages builds use `/Lorefold/`.

lore is download-then-import for now. direct browser reads wait for real cors.
