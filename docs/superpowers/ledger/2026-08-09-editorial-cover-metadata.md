# Editorial cover/metadata execution ledger

- Design approved by user.
- Implementation plan committed.
- Cover regression tests added.
- `ZZMediaKeyFix.js`: `imagem-principal-*` now falls back to `cover` while explicit `Capa` remains supported.
- Editorial regression tests added for multiline secondary keywords and legacy documents.
- `EditorialNormalize.js`: secondary keywords are consumed until H1 and excluded from public blocks.
- PR CI workflow added to execute all Apps Script Node tests on Node 24.
- Next: open PR, inspect CI, address findings, merge to main, verify deploy.
