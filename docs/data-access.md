# Lorefold data-access decision

## Decision

The MVP is local-import first. Lorefold does not fetch Lore data at runtime
from the browser while the upstream responses lack `Access-Control-Allow-Origin`.

Supported local inputs are:

- `.eml` — one RFC822 message;
- `.mbox` — an uncompressed mboxrd archive;
- `.mbox.gz` and `.gz` — bounded gzip input that becomes an mbox or message.

For a pasted canonical Lore URL or bare Message-ID, Lorefold validates the
identifier and derives the exact download URL:

```text
https://lore.kernel.org/all/<Message-ID>/t.mbox.gz
```

The user downloads that file and selects it in Lorefold. After parsing,
Lorefold validates that the requested Message-ID is present before opening the
thread. Lore remains the authoritative source and every retained message
keeps its canonical Message-ID and source URL.

## Interface inventory

| Interface | Intended use | MVP status |
| --- | --- | --- |
| `/all/<Message-ID>/` | Canonical HTML message | Link only |
| `/r/<Message-ID>` | List-independent canonical redirect | Link only |
| `/all/<Message-ID>/raw` | One complete RFC822 message | User download/link |
| `/all/<Message-ID>/t.mbox.gz` | Complete thread RFC822 archive | User download, then local import |
| `/all/<Message-ID>/t.atom` | Thread metadata and relationships | Not fetched by the browser |
| `/<list>/new.atom` | Recent-list discovery | Not in MVP |
| `/<list>/?q=...&x=A` | Search results | Not in MVP |

The mbox endpoint is preferred over HTML and Atom because it preserves the
complete message stream, MIME parts, headers, and threading fields needed by
the parser. Atom may inform a future bounded discovery/catalog feature, but it
is never an authoritative archive mirror.

## Browser verification

On 2026-08-16, headless Google Chrome 150.0.7871.128 ran from the real Pages redirect target, https://manojkhatri42.com.np/Lorefold/. Fetches to the representative Lore message, redirect, raw, mbox, thread Atom, recent Atom, and search Atom endpoints all rejected with TypeError: Failed to fetch. A non-safelisted mbox request that forced a CORS preflight failed the same way. No Lore response was readable from the browser.

## Security and architecture constraints

Lorefold remains a static GitHub Pages PWA with no API server, proxy,
serverless function, database service, authentication service, or runtime
archive mirror. Static Actions data, if added later, must be explicitly
bounded demo/discovery data and cannot satisfy arbitrary pasted URLs.

Imported mail is hostile input. The implementation must enforce byte, gzip,
record, MIME-depth, header, URL, host, scheme, and timeout limits; never
execute or remotely load message content; and never use `no-cors`, iframe
scraping, JSONP, or a service worker as a same-origin-policy bypass.
