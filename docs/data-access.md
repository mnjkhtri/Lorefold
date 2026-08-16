# data access

the browser does not fetch lore directly. upstream responses did not grant
usable cors from the real pages origin.

github actions fetches the Lore archive index, discovers list identifiers, and
fetches a bounded current window for each discovered list. the frontend reads
that generated same-origin data and has a generic list route; it has no upload
or pasted-mail workflow.
