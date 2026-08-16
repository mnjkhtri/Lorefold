# data access

the browser does not fetch lore directly. upstream responses did not grant
usable cors from the real pages origin.

github actions reads `manifest.js.gz`, discovers public-inbox git archives, and
shallow-clones recent message commits from active archives. the frontend reads
the generated catalog and thread documents from github pages.
