---
"@nautink/storage": minor
---

Add JSON backup: `exportAll` writes a `nautink-backup` (version 1) with diagrams, versions and positions; `validateBackup` and `importAll` also accept Mermaid Chat (v1) backups and merge like v1, giving clashing ids new ids.
