# Editorial Automation Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the signed draft-import and media pipeline for Top Comparativos with strict draft/public separation and a fenced, exclusive R2 garbage collector.

**Architecture:** Google Apps Script calls HMAC-authenticated endpoints. D1 stores versioned editorial state, idempotency records, media references, GC candidates, inventory cursor and a global lease; R2 binding `MEDIA` stores immutable image objects. Import and upload mutate draft state only, while public reads use published snapshots only.

**Tech Stack:** TypeScript 5.9, Next.js 16 App Router on Vinext/Cloudflare Workers, D1/SQLite, R2, Drizzle ORM, Zod 4, Vitest 4.

## Global Constraints

- Importing or resending content must never publish or mutate an existing published snapshot.
- Google Drive is an input source only; public rendering must not depend on Drive.
- The logical R2 binding name is exactly `MEDIA`.
- Affiliate data is accepted only when a product and explicit affiliate URL are supplied.
- Automation authentication is HMAC-SHA256 over `timestamp\nrequestId\nsourceKey\nsha256(body)` with a maximum age of 300 seconds.
- Request IDs are unique per operation scope; identical replay returns the prior result and conflicting reuse returns HTTP 409.
- Raw HTML, scripts, styles, arbitrary media paths, secrets and binary bodies must never enter persisted editorial content, logs or audit payloads.
- Media upload accepts only JPEG, PNG and WebP from 1 byte through 10 MiB inclusive.
- R2 object keys are immutable and content-addressed; public media reads consult D1 before R2.
- Every destructive GC action requires a valid `owner_token` and monotonic `fencing_token`.
- A D1 result with `success === false` or an expected mutation with `meta.changes !== 1` is never reported as progress.
- Complete each task with focused tests, full unit tests, lint and a reviewer gate; push the reviewed commit before starting the next task.

## File Map

- `db/schema.ts`: Drizzle definitions for draft/published editorial state, operations, media and GC control.
- `drizzle/*.sql`: additive D1 migrations generated from the schema.
- `lib/domain/editorial-blocks.ts`: versioned safe-block schema and shared `mediaKey` validation.
- `lib/auth/automation.ts`: canonical HMAC verification and automation header parsing.
- `lib/repositories/editorial-import.ts`: idempotent draft-only import transaction.
- `lib/repositories/media.ts`: immutable R2 upload and draft media metadata transaction.
- `lib/repositories/media-gc.ts`: lease, fencing, fair candidate processing and persistent R2 inventory.
- `app/api/automation/articles/[sourceKey]/route.ts`: signed JSON import endpoint.
- `app/api/automation/articles/[sourceKey]/media/route.ts`: signed bounded binary upload endpoint.
- `app/api/automation/media/gc/route.ts`: signed bounded maintenance endpoint.
- `app/media/[...key]/route.ts`: allowlisted published-media response.
- `tests/helpers/sqlite-d1.ts`: SQLite-backed D1 test adapter with controllable result failures.

---

### Task 1: Add Versioned Editorial and Media Persistence

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Create: `tests/domain/editorial-schema-contract.test.ts`
- Create: generated `drizzle/0002_*.sql`

**Interfaces:**
- Consumes: current `articles`, `products`, `article_products`, `sources`, `audit_events` tables.
- Produces: draft/published article columns; `automation_operations`, `article_media`, `media_gc_candidates`, `media_gc_state`, and `media_gc_lease` tables; R2 binding `MEDIA`.

- [ ] **Step 1: Write the failing schema contract test**

Assert that `.openai/hosting.json` contains `"r2": "MEDIA"`, that exported tables contain the exact physical columns below, and that the migration includes their unique indexes:

```ts
expect(articleMedia.mediaKey.name).toBe("media_key");
expect(articleMedia.draftObjectKey.name).toBe("draft_object_key");
expect(articleMedia.publishedObjectKey.name).toBe("published_object_key");
expect(mediaGcLease.ownerToken.name).toBe("owner_token");
expect(mediaGcLease.fencingToken.name).toBe("fencing_token");
```

Required article additions: `source_key`, `draft_content_json`, `published_content_json`, `draft_hero_media_id`, `published_hero_media_id`, `draft_version`, `published_version`.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npm run test:unit -- tests/domain/editorial-schema-contract.test.ts`

Expected: FAIL because the new exports and R2 binding do not exist.

- [ ] **Step 3: Add the minimal additive schema**

Define operation rows with `operation`, `request_id`, `source_key`, `body_sha256`, `result_json`, `created_at`; media rows with draft and published object/checksum/MIME/filename/alt/role/position fields; GC candidate rows with `state`, `claim_token`, `claim_fencing_token`, `last_checked_at`; singleton GC state with `inventory_cursor`; singleton lease with `owner_token`, `fencing_token`, `acquired_at`, `expires_at`.

Use unique indexes for `articles.source_key`, automation request identity, `(article_id, media_key)`, and candidate `object_key`. Add an index on `(state, last_checked_at, id)`.

- [ ] **Step 4: Generate and inspect the migration**

Run: `npm run db:generate`

Verify the SQL is additive, backfills non-null version values safely, creates `MEDIA`-related tables without dropping current article data, and includes every index from Step 3.

- [ ] **Step 5: Run focused and full validation**

Run:

```bash
npm run test:unit -- tests/domain/editorial-schema-contract.test.ts
npm run test:unit
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Review, commit and push**

```bash
git add .openai/hosting.json db/schema.ts drizzle tests/domain/editorial-schema-contract.test.ts
git commit -m "feat: restore editorial automation persistence"
git push
```

---

### Task 2: Define the Safe Editorial Block Contract

**Files:**
- Create: `lib/domain/editorial-blocks.ts`
- Create: `tests/domain/editorial-blocks.test.ts`

**Interfaces:**
- Consumes: Zod 4.
- Produces: `MEDIA_KEY_PATTERN`, `EditorialDocumentSchema`, `EditorialDocument`, `EditorialDraftEnvelopeSchema`, `EditorialDraftEnvelope`.

- [ ] **Step 1: Write failing validation tests**

Cover one valid document containing all eight blocks (`paragraph`, `heading`, `list`, `callout`, `table`, `image`, `product`, `faq`) and explicit rejection of unknown block types, raw HTML fields, `javascript:` URLs, empty arrays, duplicate FAQ questions, and media keys such as `../hero.webp`, `folder/hero.webp`, and `.hidden.png`.

Use this shared valid key expectation:

```ts
expect(MEDIA_KEY_PATTERN.test("hero-potes.webp")).toBe(true);
expect(MEDIA_KEY_PATTERN.test("articles/hero.webp")).toBe(false);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/domain/editorial-blocks.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement discriminated Zod schemas**

Set root document version to literal `1`, use `.strict()` for every object, allow headings only at levels 2 and 3, restrict external links to `https:`, require media keys to match `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`, and cap strings/arrays to documented finite sizes.

The envelope must retain title, slug, excerpt, category, type, SEO metadata, `primaryKeyword`, `searchIntent`, document, optional products with explicit `affiliateUrl`, and sources.

- [ ] **Step 4: Run focused and full validation**

```bash
npm run test:unit -- tests/domain/editorial-blocks.test.ts
npm run test:unit
npm run lint
```

- [ ] **Step 5: Review, commit and push**

```bash
git add lib/domain/editorial-blocks.ts tests/domain/editorial-blocks.test.ts
git commit -m "feat: restore safe editorial document contract"
git push
```

---

### Task 3: Authenticate Automation Requests

**Files:**
- Create: `lib/auth/automation.ts`
- Create: `tests/auth/automation.test.ts`

**Interfaces:**
- Consumes: raw request bytes, source key, current epoch seconds, hosted `AUTOMATION_HMAC_SECRET`.
- Produces: `sha256Hex(body)`, `canonicalAutomationMessage(input)`, `verifyAutomationRequest(input)` and stable `AutomationAuthError` codes.

- [ ] **Step 1: Write failing HMAC tests**

Use a fixed secret and Web Crypto to prove exact canonical bytes:

```ts
const message = `1722780000\nreq-123\nguia-potes\n${bodyHash}`;
expect(canonicalAutomationMessage(input)).toBe(message);
```

Cover valid signature, missing/duplicate headers, uppercase hash rejection, signature length mismatch, body mutation, source mutation, timestamps at ±300 seconds, timestamps outside the window, and missing hosted secret. Assert errors do not include the secret or body.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- tests/auth/automation.test.ts`

- [ ] **Step 3: Implement Web Crypto verification**

Read exactly `x-automation-timestamp`, `x-automation-request-id`, `x-automation-signature`, and `x-automation-body-sha256`; require lowercase 64-character hex hashes; compute SHA-256 over the exact `Uint8Array`; verify timestamp; compute HMAC-SHA256; compare fixed-length byte arrays without early exit.

- [ ] **Step 4: Run focused and full validation**

```bash
npm run test:unit -- tests/auth/automation.test.ts
npm run test:unit
npm run lint
```

- [ ] **Step 5: Review, commit and push**

```bash
git add lib/auth/automation.ts tests/auth/automation.test.ts
git commit -m "feat: authenticate editorial automation"
git push
```

---

### Task 4: Import Idempotent Drafts Without Touching Published State

**Files:**
- Create: `lib/repositories/editorial-import.ts`
- Create: `app/api/automation/articles/[sourceKey]/route.ts`
- Create: `tests/repositories/editorial-import.test.ts`
- Create: `tests/routes/editorial-import-api.test.ts`
- Modify: `tests/helpers/sqlite-d1.ts`

**Interfaces:**
- Consumes: `EditorialDraftEnvelope`, verified automation identity, D1.
- Produces: `importEditorialDraft(input): Promise<{articleId:number; sourceKey:string; draftVersion:number; created:boolean}>` and signed `POST /api/automation/articles/:sourceKey`.

- [ ] **Step 1: Write failing repository tests**

Cover create, draft update, published-article update, identical replay, conflicting request ID, concurrent same-request winner, slug/source collision, zero-change optimistic race, complete envelope retention, optional products, and shared-ASIN protection.

For a published article, snapshot all public columns, public products, public sources and public hero before import, then assert deep equality afterward while draft version increments.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm run test:unit -- tests/repositories/editorial-import.test.ts`

- [ ] **Step 3: Implement the draft-only transaction**

Use guarded `UPDATE ... WHERE updated_at = ? AND status = ?`, condition every dependent statement and operation insert on the winning mutation, recover unique conflicts by rereading the operation, and reject reuse when `source_key` or body hash differs. Store the full validated draft envelope in `draft_content_json`; do not write published columns or public relationships.

- [ ] **Step 4: Write and run failing route tests**

Cover exact-body authentication, invalid JSON, invalid block contract, unknown error normalization, replay response, conflict response, and a 1 MiB JSON body limit enforced using `Content-Length` plus incremental stream reading.

Run: `npm run test:unit -- tests/routes/editorial-import-api.test.ts`

- [ ] **Step 5: Implement the signed route**

Read at most 1 MiB, verify HMAC before JSON parsing, require path `sourceKey` to equal the envelope source key, call the repository, and return stable JSON without stack traces or payload fragments.

- [ ] **Step 6: Run focused and full validation**

```bash
npm run test:unit -- tests/repositories/editorial-import.test.ts tests/routes/editorial-import-api.test.ts
npm run test:unit
npm run lint
npm run build
```

- [ ] **Step 7: Review, commit and push**

```bash
git add lib/repositories/editorial-import.ts app/api/automation/articles tests/repositories/editorial-import.test.ts tests/routes/editorial-import-api.test.ts tests/helpers/sqlite-d1.ts
git commit -m "feat: restore idempotent editorial draft import"
git push
```

---

### Task 5: Upload Immutable Draft Media and Serve Published Media

**Files:**
- Create: `lib/repositories/media.ts`
- Create: `app/api/automation/articles/[sourceKey]/media/route.ts`
- Create: `app/media/[...key]/route.ts`
- Create: `tests/repositories/media.test.ts`
- Create: `tests/routes/editorial-media-api.test.ts`
- Create: `tests/routes/public-media.test.ts`
- Modify: `tests/mocks/cloudflare-workers.ts`

**Interfaces:**
- Consumes: verified raw bytes, basename `mediaKey`, checksum, MIME, role, alt, position, D1 and R2 `MEDIA`.
- Produces: `uploadDraftMedia(input): Promise<MediaUploadResult>` and public `/media/articles/:articleId/:objectName` responses.

- [ ] **Step 1: Write failing repository tests**

Cover new upload, same checksum reuse without `R2.put`, metadata-only changes, replacement with immutable object key, published snapshot immutability, request replay/conflict, concurrent equivalent replacements with different metadata, D1 failure after R2 put, and rejection while the exact object key is protected by an active deleting claim.

Assert object names include the lowercase checksum so a replacement never overwrites an old R2 object.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm run test:unit -- tests/repositories/media.test.ts`

- [ ] **Step 3: Implement immutable media persistence**

Validate basename, MIME, 1..10 MiB size and exact lowercase checksum. Write R2 first under `articles/{articleId}/{checksum}-{safeFilename}`, then atomically update draft metadata and operation result using checksum/object-key/metadata guards. On D1 failure, create a durable GC marker; never synchronously delete a possibly referenced key.

- [ ] **Step 4: Write failing binary route tests**

Prove unauthenticated oversized `Content-Length` is rejected before reading, chunked bodies stop at 10 MiB + 1 byte, accepted bytes are read once and are identical to HMAC/repository bytes, and stable errors contain no binary data.

- [ ] **Step 5: Implement the bounded upload route**

Use `ReadableStreamDefaultReader`, cancel on overflow, verify the exact accumulated `Uint8Array`, parse metadata from small headers with fixed maximum lengths, and call `uploadDraftMedia`.

- [ ] **Step 6: Write failing public route tests**

Cover invalid path, absent D1 reference, absent R2 object, published-only lookup, MIME, `Content-Length`, strong ETag, weak `If-None-Match`, comma-separated validators, cache headers, 304 and 404 without bucket listing.

- [ ] **Step 7: Implement the public media route**

Accept only `articles/{positiveInteger}/{safeObjectName}`, query published media by exact object key before R2, and return `Cache-Control: public, max-age=31536000, immutable` because object keys are content-addressed.

- [ ] **Step 8: Run focused and full validation**

```bash
npm run test:unit -- tests/repositories/media.test.ts tests/routes/editorial-media-api.test.ts tests/routes/public-media.test.ts
npm run test:unit
npm run lint
npm run build
```

- [ ] **Step 9: Review, commit and push**

```bash
git add lib/repositories/media.ts app/api/automation/articles app/media tests/repositories/media.test.ts tests/routes/editorial-media-api.test.ts tests/routes/public-media.test.ts tests/mocks/cloudflare-workers.ts
git commit -m "feat: restore immutable editorial media"
git push
```

---

### Task 6: Add Fenced Exclusive Media Garbage Collection

**Files:**
- Create: `lib/repositories/media-gc.ts`
- Create: `app/api/automation/media/gc/route.ts`
- Create: `tests/repositories/media-gc.test.ts`
- Create: `tests/routes/media-gc-api.test.ts`

**Interfaces:**
- Consumes: D1 lease/candidate/state tables, R2 `MEDIA`, HMAC authentication.
- Produces: `runMediaGc(input): Promise<MediaGcResult>`, `acquireMediaGcLease`, `renewMediaGcLease`, `releaseMediaGcLease`, and signed `POST /api/automation/media/gc`.

- [ ] **Step 1: Write failing lease tests**

Use a deterministic clock and tokens to cover first acquisition, denial while valid, atomic takeover after expiry, monotonic `fencing_token`, owner-only renewal, owner-only release, and D1 `success:false`/`changes:0` failures.

The stale-owner assertion must be explicit:

```ts
await expect(renewMediaGcLease(db, staleLease, now)).rejects.toMatchObject({
  code: "media_gc_lease_lost",
});
```

- [ ] **Step 2: Run lease tests and verify RED**

Run: `npm run test:unit -- tests/repositories/media-gc.test.ts -t lease`

- [ ] **Step 3: Implement fenced lease primitives**

Acquire with one conditional UPSERT that either creates the singleton or replaces only an expired lease while incrementing `fencing_token`. Renew and release with `WHERE owner_token = ? AND fencing_token = ?`. Return no authority unless exactly one row changed.

- [ ] **Step 4: Write failing destructive interleaving tests**

Create a controlled R2 mock that pauses immediately before delete. Test this sequence: worker A claims; A pauses; lease expires; worker B acquires higher fencing token; B finishes; upload recreates/references the object; A resumes. Assert A rechecks authority, does not call `R2.delete`, does not finalize the candidate and returns `media_gc_lease_lost`.

Also cover two simultaneous workers, lease loss after R2 lookup, referenced draft/public objects, active deleting claim blocking upload, and final candidate delete returning `success:false` or `changes:0`.

- [ ] **Step 5: Implement claim, revalidation and conditional finalization**

Before `R2.delete`, require all of: active matching lease owner/fence, matching candidate claim owner/fence, and zero draft/published references. After delete, remove the candidate only with the same claim and fence. If any conditional mutation changes zero rows, stop without reporting deletion.

- [ ] **Step 6: Write failing fairness and inventory tests**

Cover 101+ retained candidates rotating by `(last_checked_at,id)`, no starvation, cursor persistence after each R2 page, continuation beyond ten pages/1000 objects, repeated/missing cursor rejection, cursor reset only when `truncated === false`, and D1 failures producing no reported progress.

- [ ] **Step 7: Implement fair queue and persistent inventory**

Process at most 100 candidates ordered by oldest `last_checked_at,id`; persist each touch only when one row changes. List bounded R2 pages per invocation, persist the opaque cursor after each successfully recorded page, and restart at null only at a confirmed terminal page.

- [ ] **Step 8: Write failing route tests**

Require an empty or at most 1 KiB body, reject oversized `Content-Length` before authentication, read chunked input with the same bounded reader, authenticate exact bytes, return 202 when another valid lease owns the collector, and normalize failures without internal tokens.

- [ ] **Step 9: Implement the GC route**

Generate an unguessable owner token per invocation, acquire the lease, run bounded work, renew between pages/batches, and release in `finally` only when still owner. Never return owner or fencing tokens in the response.

- [ ] **Step 10: Run focused and full validation**

```bash
npm run test:unit -- tests/repositories/media-gc.test.ts tests/routes/media-gc-api.test.ts
npm run test:unit
npm run lint
npm run build
npm run validate:artifact
```

- [ ] **Step 11: Review, commit and push**

```bash
git add lib/repositories/media-gc.ts app/api/automation/media/gc tests/repositories/media-gc.test.ts tests/routes/media-gc-api.test.ts
git commit -m "feat: fence editorial media garbage collection"
git push
```

---

### Task 7: Verify the Reconstructed Pipeline End to End

**Files:**
- Create: `tests/integration/editorial-automation-pipeline.test.ts`
- Create: `docs/superpowers/reports/2026-08-04-editorial-automation-rebuild.md`

**Interfaces:**
- Consumes: signed import, upload, public media and GC APIs from Tasks 1–6.
- Produces: an evidence report and a reviewed base for later internal-link and publication tasks.

- [ ] **Step 1: Write the failing end-to-end test**

Exercise: import a draft → upload cover and inline image → reimport changed draft → verify public article/media snapshots unchanged → replay requests → run two overlapping GC invocations with lease expiry → recreate/re-reference an object → prove stale worker cannot delete it.

- [ ] **Step 2: Run the integration test and verify RED for any missing wiring**

Run: `npm run test:unit -- tests/integration/editorial-automation-pipeline.test.ts`

Expected: initial failure must identify a concrete missing boundary; if it passes immediately, record that no production change is needed.

- [ ] **Step 3: Route any demonstrated defect back to its owning task**

Do not patch production behavior inside Task 7. If Step 2 exposes a defect, reopen the responsible Task 1–6 with its original reviewer, add the focused failing regression there, implement the correction, rerun that task's complete gate, commit it, and then rerun the integration test. Do not add publishing, link graph or renderer behavior.

- [ ] **Step 4: Run the complete final gate**

```bash
npm run test:unit
npm run test:rendered
npm run lint
npm run build
npm run validate:artifact
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Write the evidence report**

Record exact commands and counts, schema migration name, reviewed commits, remaining operational note that GC scheduling belongs to the later connector/deployment phase, and explicit confirmation that no public deployment occurred.

- [ ] **Step 6: Request final independent review**

Reviewer must inspect the complete diff from `caaa267` through HEAD for spec compliance, security, draft/public isolation, D1/R2 consistency, destructive concurrency and test credibility. Resolve all Critical and Important findings before continuing.

- [ ] **Step 7: Commit and push the verified reconstruction**

```bash
git add tests/integration/editorial-automation-pipeline.test.ts docs/superpowers/reports/2026-08-04-editorial-automation-rebuild.md
git commit -m "test: verify rebuilt editorial automation pipeline"
git push
```

The next plan starts only after this branch is review-clean and durably synchronized.
