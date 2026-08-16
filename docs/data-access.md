# data access

the browser does not fetch lore directly. upstream responses did not grant
usable cors from the real pages origin.

github actions fetches a bounded set of current threads and publishes them as
same-origin static data. arbitrary pasted urls still use the fallback.
supported inputs are `.eml`, `.mbox`, `.mbox.gz`, and `.gz`.
