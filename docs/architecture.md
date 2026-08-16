# architecture

static vite app. github pages. hash routes. no server.

github actions reads lore's public-inbox manifest, shallow-clones the most
recently active archives, parses a bounded message window, and publishes a
small catalog plus one json document per thread.

local builds use `/`. pages builds use `/Lorefold/`.

the browser reads same-origin data and polls for new deployments. list names
come from lore. there is no upload or local-mail workflow.
