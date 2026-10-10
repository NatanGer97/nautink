---
"@nautink/web": patch
---

Load Motion (the live-build fade) when a reply starts streaming and the settings rows the first time Settings opens, so neither sits in the main bundle: the entry script drops from 170 kB to 162 kB gzip.
