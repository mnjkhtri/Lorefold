# Lorefold technical spike report

Date: 2026-08-16

Status: complete

## Scope and method

This report is the retained result for TICKET-001. The representative thread is
the filelock patch thread identified by
`20250903-filelock-v1-1-f2926902962d@kernel.org`. The checks below were made
from the command line against `https://lore.kernel.org` with the request
origin set to `https://example.github.io/Lorefold/`, representing a GitHub
Pages subpath deployment. `curl` was used to corroborate response status and
headers; no credentials, cookies, or browser extensions were used.

The exact probe form was:

```sh
curl -L -sS -D - -o /dev/null \
  -H 'Origin: https://example.github.io/Lorefold/' \
  'https://lore.kernel.org/<path>'
```

The tested resource paths were the canonical message, `/r/<Message-ID>`,
`/raw`, `/t.mbox.gz`, `/t.atom`, a list `new.atom` feed, and a list search
Atom request. The mbox preflight was:

```sh
curl -L -sS -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://example.github.io/Lorefold/' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: range' \
  'https://lore.kernel.org/all/<Message-ID>/t.mbox.gz'
```

## Results

| Resource | Result observed | CORS evidence |
| --- | --- | --- |
| `/all/<Message-ID>/` | `403` in this probe | No `Access-Control-Allow-Origin` |
| `/r/<Message-ID>` | `403` in this probe | No `Access-Control-Allow-Origin` |
| `/all/<Message-ID>/raw` | `403` with the Pages `Origin`; `200`, `text/plain` without that `Origin` when using a descriptive user agent | No `Access-Control-Allow-Origin` |
| `/all/<Message-ID>/t.mbox.gz` | `200`, `application/gzip`, `4,560` downloaded bytes | No `Access-Control-Allow-Origin` |
| `/all/<Message-ID>/t.atom` | `403` in this probe | No `Access-Control-Allow-Origin` |
| `/<list>/new.atom` | `403` in this probe | No `Access-Control-Allow-Origin` |
| `/<list>/?q=...&x=A` | `403` in this probe | No `Access-Control-Allow-Origin` |
| mbox `OPTIONS` | `405` | No CORS permission headers |

The `403` responses are an upstream access/rate-control observation, not a
claim that those resources do not exist. In particular, the mbox and raw
resources were reachable during the same probe. The important browser
compatibility result is the absence of an affirmative CORS header on every
response checked, plus the failed preflight. A browser cannot expose these
cross-origin response bodies to Lorefold JavaScript under this result.

The representative mbox measured 4,560 compressed bytes and 9,612 uncompressed bytes. Its mbox envelope scan found two From records. These measurements describe this small filelock sample; they are not parser limits.

## Real Pages-origin browser test

After TICKET-002 created a local scaffold, the deferred browser test was run on 2026-08-16 with Google Chrome 150.0.7871.128 in headless mode through the Chrome DevTools Protocol. The repository Pages URL, https://mnjkhtri.github.io/Lorefold/, redirected to its configured custom Pages domain, https://manojkhatri42.com.np/Lorefold/. That origin currently displays a GitHub Pages 404 because the scaffold has not been deployed; it is nevertheless the real deployed Pages origin.

From that page context, JavaScript attempted fetch for the canonical, redirect, raw, mbox, thread Atom, recent Atom, and search Atom URLs listed above. Every request rejected with TypeError: Failed to fetch. A second mbox request with a non-safelisted X-Lorefold-Probe header, which forces a CORS preflight, also rejected with TypeError: Failed to fetch. No response body, status, or CORS response header was exposed to browser JavaScript.

This is the required real-origin browser result: direct Lore loading is not available to Lorefold. The deployed page 404 is an independent deployment state and does not change the CORS conclusion.

## Spike conclusions

1. Direct browser loading is not enabled. `no-cors` is not an alternative
   because it produces an opaque response whose body Lorefold cannot parse.
2. The complete-thread mbox remains the preferred fidelity input when a user
   downloads it locally. It contains RFC822 messages and can be parsed by the
   same local ingestion pipeline as an `.eml` file.
3. The MVP must accept local `.eml`, uncompressed `.mbox`, `.mbox.gz`, and
   `.gz` files. A pasted Lore URL must show the exact canonical
   `/all/<Message-ID>/t.mbox.gz` download URL and retain the requested
   Message-ID for validation after import.
4. No proxy, serverless function, mirror, or other backend is justified or
   permitted. A future direct-fetch adapter may be reconsidered only after a
   real GitHub Pages browser test observes a readable response body and status
   with CORS enabled.

## Ticket completion

TICKET-001 is fully complete. The endpoint comparison, mbox measurements, header/preflight corroboration, real Pages-origin browser result, and local import fallback are recorded above. The separate SP-06 asset/reload and SP-07 installation/offline checks remain later application tickets, not TICKET-001 acceptance criteria.
