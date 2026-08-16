# Security model

Archive content is hostile input. Lorefold treats it as data and never renders
mail HTML with `dangerouslySetInnerHTML`. HTML-only messages are converted to
inert text; images, styles, scripts, frames, media, attachments, and tracking
resources are not loaded automatically.

The production document has a self-only CSP with no object or frame sources,
self-only workers/connections, and no third-party CDN. The only generated
external download link is accepted when it is HTTPS, has the exact
`lore.kernel.org` origin, and is the complete-thread `t.mbox.gz` path without
credentials, query parameters, or fragments.

Parser boundaries include compressed and decompressed byte limits, record
counts, MIME depth, header bytes, reference counts, raw-message size, and
bounded gzip streaming. Invalid URL schemes/hosts, malformed encodings, bad
dates, oversized inputs, and recoverable parser damage produce typed failures
or diagnostics. Visible text removes bidi control characters; the raw view is
still text inside `<pre>` and does not execute markup.

No `no-cors`, iframe scraping, JSONP, proxy, runtime mirror, analytics, or
remote content loader is permitted. User state remains in browser storage and
saved-thread content is available offline through the static shell.
