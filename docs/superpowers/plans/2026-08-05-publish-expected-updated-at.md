# Versioned Article Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the draft `article.updatedAt` in the editorial sheet and send that exact value as `expectedUpdatedAt` when publishing.

**Architecture:** Keep the Site API unchanged. Add a small Apps Script persistence helper in `Publish.js`; the existing draft-send function records the Site version after every successful import, and the publish command reads that visible sheet value and refuses to publish without it. The HMAC helper continues signing the exact JSON body.

**Tech Stack:** Google Apps Script JavaScript, Node.js built-in `node:test`, VM-based Apps Script unit harness.

## Global Constraints

- The visible sheet column is exactly `Versão no site`.
- The publish body contains exactly one field: `expectedUpdatedAt`.
- Publication must not re-send the draft or guess a version.
- Existing pre-publication validation and HMAC transport remain unchanged.
- A missing Site version blocks before the HTTP publish request.

---

### Task 1: Persist the Site version returned by draft import

**Files:**
- Modify: `automation/apps-script/Publish.js`
- Modify: `automation/apps-script/Código.js`
- Test: `automation/tests/apps-script-publish.test.mjs`

**Interfaces:**
- Produces: `topcPersistirVersaoSite_(aba, linha, updatedAt)`
- Consumes: successful draft response `article.updatedAt: string`

- [ ] **Step 1: Write failing tests for version persistence**

Add tests that call `topcPersistirVersaoSite_` with a sheet double and assert:
1. when `Versão no site` exists, the selected row receives the exact timestamp;
2. when it does not exist, the helper creates the header once at `lastColumn + 1` and writes the value below it;
3. an empty `updatedAt` throws before writing.

Use `2026-08-05T21:59:46.49759321611Z` as the exact regression value.

- [ ] **Step 2: Run the focused test and verify RED**

Run:
```bash
node --test automation/tests/apps-script-publish.test.mjs
```

Expected: FAIL because `topcPersistirVersaoSite_` does not exist.

- [ ] **Step 3: Implement the minimal persistence helper**

In `Publish.js`, add `topcPersistirVersaoSite_(aba, linha, updatedAt)` which:
- trims and rejects an empty timestamp;
- reads row 1 through `aba.getLastColumn()`;
- finds the header `Versão no site`;
- if absent, writes that header to `lastColumn + 1`;
- writes the exact timestamp to the selected row and resolved column.

- [ ] **Step 4: Wire successful draft sending to the helper**

In `enviarRascunhoSiteSelecionado()`, immediately after parsing `retorno.article`, call:

```javascript
topcPersistirVersaoSite_(aba, linha, article.updatedAt);
```

Do not persist anything for non-200/201 responses.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:
```bash
node --test automation/tests/apps-script-publish.test.mjs
```

Expected: all Task 1 tests PASS.

### Task 2: Publish exactly the stored Site version

**Files:**
- Modify: `automation/apps-script/Publish.js`
- Test: `automation/tests/apps-script-publish.test.mjs`

**Interfaces:**
- Consumes: `contexto.versaoSite: string`
- Sends: `JSON.stringify({ expectedUpdatedAt: contexto.versaoSite })`

- [ ] **Step 1: Write failing publish-contract tests**

Update the valid sheet context to include:
```javascript
'Versão no site': '2026-08-05T21:59:46.49759321611Z'
```

Add a regression test showing that an empty version is rejected before `topcEnviarAssinado_` is called. Change the existing automatic publication assertion so the exact body must equal:
```json
{"expectedUpdatedAt":"2026-08-05T21:59:46.49759321611Z"}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:
```bash
node --test automation/tests/apps-script-publish.test.mjs
```

Expected: FAIL because the current context omits `versaoSite` and the current publish body is `{}`.

- [ ] **Step 3: Implement minimal publish-contract change**

In `topcObterContextoPublicacao_`, add:
```javascript
versaoSite: String(dados['Versão no site'] || '').trim()
```

In `topcValidarPrePublicacao_`, reject missing `contexto.versaoSite` with a message telling the user to send the draft again.

Replace:
```javascript
const body = '{}';
```

with:
```javascript
const body = JSON.stringify({
  expectedUpdatedAt: contexto.versaoSite
});
```

Do not add any extra publish fields.

- [ ] **Step 4: Run focused and media regression tests**

Run:
```bash
node --test automation/tests/apps-script-publish.test.mjs automation/tests/apps-script-media-upload.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Verify the final diff**

Confirm:
- only the intended Apps Script/test/docs files changed;
- no secret/HMAC value is present;
- no `{}` publish body remains;
- `git diff --check` is clean.

- [ ] **Step 6: Commit the implementation**

Commit only the implementation/test changes with:
```text
fix: publish exact editorial draft version
```
