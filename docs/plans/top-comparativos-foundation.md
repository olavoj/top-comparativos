# Top Comparativos Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the first working Top Comparativos foundation on OpenAI Sites, including the public editorial experience, private single-user panel, D1 content model, SiteStripe link validation, publishing workflow, and SEO baseline.

**Architecture:** Use the standard Sites Vinext starter with server-rendered public routes and protected administrative routes. Persist articles, products, sources, editorial state, and audit events in Cloudflare D1 through Drizzle; keep external product URLs server-side and expose only safe article data to public pages. Authentication uses the Sites-supported identity surface so the admin area is private without implementing a custom password system.

**Tech Stack:** OpenAI Sites Vinext starter, TypeScript, React, Cloudflare Workers, Cloudflare D1, Drizzle ORM, Zod, Vitest, React Testing Library, CSS modules/global CSS.

## Global Constraints

- Public UI direction: “Guia inteligente”.
- Primary colors: `#18352B`, `#2F6F59`, `#39745F`, `#F6F4ED`, `#5D665F`, `#D8D4C8`.
- Store ID must equal `topcomparat09-20`.
- The admin panel is accessible only to Olavo.
- Publishing is always human-approved in this phase.
- No PA API integration in this phase.
- Never expose credentials in browser code, repository files, logs, or public routes.
- SiteStripe links remain complete in storage; public buttons display human-readable labels.
- Block publication when a required link, valid tag, ASIN, affiliate notice, source, or review date is missing.
- Do not claim that a product was tested unless an explicit verified field records that fact.
- Prices and availability are not persisted or displayed in this phase.
- Public output is Portuguese (Brazil).
- Public routes must be mobile-first, accessible, crawlable, and server-rendered.
- The first hosted deliverable uses the free Sites URL.

---

## Planned File Map

### Platform and configuration

- `.openai/hosting.json` — Sites project identity and D1 binding.
- `package.json` — scripts and test dependencies.
- `vitest.config.ts` — unit/component test configuration.
- `app/globals.css` — approved visual tokens and global responsive rules.
- `app/layout.tsx` — global document metadata, header, footer, and page shell.
- `app/robots.ts` — public crawl policy with admin exclusion.
- `app/sitemap.ts` — public route and published article sitemap.

### Domain model

- `db/schema.ts` — D1 tables and enums.
- `db/index.ts` — database binding accessor.
- `lib/domain/content.ts` — shared content types and editorial states.
- `lib/domain/site-stripe.ts` — Amazon URL parsing and validation.
- `lib/domain/publishing.ts` — publication readiness checks.
- `lib/domain/slugs.ts` — stable slug generation and validation.
- `lib/repositories/articles.ts` — article persistence operations.
- `lib/repositories/products.ts` — product and affiliate-link persistence.
- `lib/repositories/audit.ts` — append-only editorial audit events.

### Public experience

- `components/site/header.tsx` — public navigation.
- `components/site/footer.tsx` — legal links and affiliate disclosure.
- `components/content/article-card.tsx` — reusable article summary.
- `components/content/recommendation-summary.tsx` — profile-based recommendation summary.
- `components/content/product-comparison.tsx` — accessible comparison table.
- `components/content/amazon-link.tsx` — consistent affiliate CTA.
- `app/page.tsx` — home page.
- `app/comparativos/page.tsx` — published comparison index.
- `app/comparativos/[slug]/page.tsx` — published article page.
- `app/categorias/[slug]/page.tsx` — category archive.
- `app/como-avaliamos/page.tsx` — editorial methodology.
- `app/sobre/page.tsx` — project information.
- `app/aviso-de-afiliado/page.tsx` — affiliate disclosure.
- `app/privacidade/page.tsx` — privacy notice.

### Private editorial panel

- `lib/auth/admin.ts` — identity assertion and allowlist check.
- `app/admin/layout.tsx` — protected admin shell.
- `app/admin/page.tsx` — editorial overview.
- `app/admin/artigos/page.tsx` — content queue.
- `app/admin/artigos/novo/page.tsx` — new draft form.
- `app/admin/artigos/[id]/page.tsx` — article editor.
- `app/admin/api/articles/route.ts` — create/list articles.
- `app/admin/api/articles/[id]/route.ts` — update one article.
- `app/admin/api/articles/[id]/publish/route.ts` — guarded publish action.
- `components/admin/article-form.tsx` — typed article editor.
- `components/admin/status-badge.tsx` — editorial state badge.
- `components/admin/readiness-checklist.tsx` — publication blockers.

### Tests and fixtures

- `tests/domain/site-stripe.test.ts`
- `tests/domain/publishing.test.ts`
- `tests/domain/slugs.test.ts`
- `tests/repositories/articles.test.ts`
- `tests/components/product-comparison.test.tsx`
- `tests/components/amazon-link.test.tsx`
- `tests/routes/public-article.test.tsx`
- `tests/routes/admin-auth.test.ts`
- `tests/routes/publish.test.ts`
- `tests/fixtures/articles.ts`

---

### Task 1: Create the Sites Checkout and Test Harness

**Files:**
- Create through Sites lifecycle: `.openai/hosting.json`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke/starter.test.ts`

**Interfaces:**
- Consumes: approved project title `Top Comparativos` and slug `top-comparativos`.
- Produces: a ready Sites checkout with `npm test` and `npm run test:watch`.

- [ ] **Step 1: Reuse the existing Site checkout created through the required lifecycle command**

The Sites checkout already exists at:

```bash
/workspace/sites/top-comparativos
```

The isolated implementation worktree is:

```bash
/workspace/sites/top-comparativos/.worktrees/foundation
```

Do not run `sites.py create` again. Confirm `.openai/hosting.json` exists and keep its `project_id` unchanged.

- [ ] **Step 2: Write the initial smoke test**

Create `tests/smoke/starter.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("Top Comparativos starter", () => {
  it("runs the test harness", () => {
    expect("top-comparativos").toBe("top-comparativos");
  });
});
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts", "components/**/*.tsx", "app/admin/api/**/*.ts"],
    },
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add these dev dependencies:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
```

Preserve the starter's existing rendered-build test by renaming that command to `test:rendered`. Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run && npm run test:rendered",
    "test:unit": "vitest run",
    "test:rendered": "npm run build && node --test tests/rendered-html.test.mjs",
    "test:watch": "vitest"
  }
}
```

Preserve every existing starter script.

- [ ] **Step 4: Run the smoke test**

Run:

```bash
npm test -- tests/smoke/starter.test.ts
```

Expected: one passing test.

- [ ] **Step 5: Validate the starter build**

Run:

```bash
npm run build
```

Expected: exit code 0 and `dist/server/index.js`.

- [ ] **Step 6: Commit the setup**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/smoke/starter.test.ts .openai/hosting.json
git commit -m "chore: initialize Top Comparativos Sites project"
```

---

### Task 2: Define the D1 Editorial Data Model

**Files:**
- Modify: `.openai/hosting.json`
- Create: `db/schema.ts`
- Modify: `db/index.ts`
- Create: `lib/domain/content.ts`
- Create: `tests/repositories/articles.test.ts`
- Create: `tests/fixtures/articles.ts`

**Interfaces:**
- Consumes: Sites D1 binding named `DB`.
- Produces:
  - `EditorialStatus` union.
  - `ArticleRecord`, `ProductRecord`, `SourceRecord`, and `AuditEventRecord` types.
  - Drizzle tables `categories`, `articles`, `products`, `articleProducts`, `sources`, and `auditEvents`.

- [ ] **Step 1: Write the domain fixture and failing schema test**

Create `tests/fixtures/articles.ts`:

```ts
import type { ArticleDraftInput } from "@/lib/domain/content";

export const validDraft: ArticleDraftInput = {
  title: "Echo Pop vs Echo Dot: qual escolher?",
  slug: "echo-pop-vs-echo-dot",
  excerpt: "Compare os dois dispositivos Amazon e descubra qual combina com seu perfil.",
  categorySlug: "tecnologia",
  intro: "Os dois modelos atendem perfis diferentes de uso.",
  criteria: ["qualidade de som", "recursos", "preço relativo"],
  recommendation: "O Echo Pop atende ambientes menores; o Echo Dot oferece som mais encorpado.",
  affiliateNotice:
    "Como associado da Amazon, o Top Comparativos recebe por compras qualificadas.",
  reviewedAt: "2026-07-29",
  testedByTopComparativos: false,
};
```

Create `tests/repositories/articles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EDITORIAL_STATUSES } from "@/lib/domain/content";
import { articles } from "@/db/schema";

describe("editorial schema", () => {
  it("defines every approved editorial state", () => {
    expect(EDITORIAL_STATUSES).toEqual([
      "opportunity",
      "approved",
      "researching",
      "draft",
      "review",
      "awaiting_links",
      "ready",
      "published",
      "rejected",
      "archived",
    ]);
  });

  it("exports the articles table", () => {
    expect(articles).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the schema test and verify failure**

Run:

```bash
npm test -- tests/repositories/articles.test.ts
```

Expected: FAIL because `lib/domain/content.ts` and `db/schema.ts` do not exist.

- [ ] **Step 3: Implement domain types**

Create `lib/domain/content.ts`:

```ts
export const EDITORIAL_STATUSES = [
  "opportunity",
  "approved",
  "researching",
  "draft",
  "review",
  "awaiting_links",
  "ready",
  "published",
  "rejected",
  "archived",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export interface ArticleDraftInput {
  title: string;
  slug: string;
  excerpt: string;
  categorySlug: string;
  intro: string;
  criteria: string[];
  recommendation: string;
  affiliateNotice: string;
  reviewedAt: string;
  testedByTopComparativos: boolean;
}
```

- [ ] **Step 4: Implement the Drizzle schema**

Create `db/schema.ts` with:

```ts
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    priority: integer("priority").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    status: text("status").notNull().default("draft"),
    intro: text("intro").notNull(),
    criteriaJson: text("criteria_json").notNull(),
    recommendation: text("recommendation").notNull(),
    affiliateNotice: text("affiliate_notice").notNull(),
    testedByTopComparativos: integer("tested_by_top_comparativos", { mode: "boolean" })
      .notNull()
      .default(false),
    reviewedAt: text("reviewed_at"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("articles_slug_unique").on(table.slug)],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    asin: text("asin").notNull(),
    affiliateUrl: text("affiliate_url").notNull(),
    affiliateTag: text("affiliate_tag").notNull(),
    imageUrl: text("image_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("products_asin_unique").on(table.asin)],
);

export const articleProducts = sqliteTable(
  "article_products",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    position: integer("position").notNull(),
    verdict: text("verdict").notNull(),
    prosJson: text("pros_json").notNull(),
    consJson: text("cons_json").notNull(),
  },
);

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(),
  checkedAt: text("checked_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").references(() => articles.id),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});
```

Set the Sites manifest D1 binding to:

```json
{
  "d1": "DB"
}
```

Preserve the existing `project_id`.

- [ ] **Step 5: Generate and inspect the migration**

Run the starter’s database generation command:

```bash
npm run db:generate
```

Expected: a migration under `.openai/drizzle/` creating all six tables and both unique indexes.

- [ ] **Step 6: Run the schema tests**

```bash
npm test -- tests/repositories/articles.test.ts
```

Expected: two passing tests.

- [ ] **Step 7: Commit the data model**

```bash
git add .openai/hosting.json .openai/drizzle db/schema.ts db/index.ts lib/domain/content.ts tests/repositories/articles.test.ts tests/fixtures/articles.ts
git commit -m "feat: add editorial data model"
```

---

### Task 3: Add SiteStripe Parsing and Publication Readiness

**Files:**
- Create: `lib/domain/site-stripe.ts`
- Create: `lib/domain/publishing.ts`
- Create: `lib/domain/slugs.ts`
- Create: `tests/domain/site-stripe.test.ts`
- Create: `tests/domain/publishing.test.ts`
- Create: `tests/domain/slugs.test.ts`

**Interfaces:**
- Produces:
  - `parseSiteStripeUrl(input: string): SiteStripeResult`.
  - `getPublicationBlockers(input: PublicationCandidate): PublicationBlocker[]`.
  - `createArticleSlug(title: string): string`.
- Consumes: expected affiliate tag `topcomparat09-20`.

- [ ] **Step 1: Write failing SiteStripe tests**

Create `tests/domain/site-stripe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSiteStripeUrl } from "@/lib/domain/site-stripe";

const validUrl =
  "https://www.amazon.com.br/Daily-T-shirt-Masculino-Preto-G/dp/B0BHMGY76M?linkCode=ll2&tag=topcomparat09-20&linkId=bb8caf513ddf43f84bd8559976912280";

describe("parseSiteStripeUrl", () => {
  it("extracts ASIN and the expected associate tag", () => {
    expect(parseSiteStripeUrl(validUrl)).toEqual({
      valid: true,
      asin: "B0BHMGY76M",
      tag: "topcomparat09-20",
      normalizedUrl: validUrl,
      errors: [],
    });
  });

  it("rejects an unexpected associate tag", () => {
    const result = parseSiteStripeUrl(validUrl.replace("topcomparat09-20", "outra-tag-20"));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("affiliate_tag_mismatch");
  });

  it("rejects non-Amazon hosts", () => {
    const result = parseSiteStripeUrl(
      "https://example.com/dp/B0BHMGY76M?tag=topcomparat09-20",
    );
    expect(result.errors).toContain("invalid_amazon_host");
  });
});
```

- [ ] **Step 2: Write failing publication tests**

Create `tests/domain/publishing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPublicationBlockers } from "@/lib/domain/publishing";

describe("getPublicationBlockers", () => {
  it("blocks an article without products, sources, notice, or review date", () => {
    expect(
      getPublicationBlockers({
        title: "Comparativo",
        slug: "comparativo",
        excerpt: "Resumo",
        intro: "Introdução",
        criteria: ["critério"],
        recommendation: "Recomendação",
        affiliateNotice: "",
        reviewedAt: null,
        products: [],
        sources: [],
      }).map((blocker) => blocker.code),
    ).toEqual([
      "missing_affiliate_notice",
      "missing_review_date",
      "missing_products",
      "missing_sources",
    ]);
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

```bash
npm test -- tests/domain/site-stripe.test.ts tests/domain/publishing.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement SiteStripe validation**

Create `lib/domain/site-stripe.ts`:

```ts
const EXPECTED_TAG = "topcomparat09-20";
const AMAZON_HOSTS = new Set(["amazon.com.br", "www.amazon.com.br"]);

export interface SiteStripeResult {
  valid: boolean;
  asin: string | null;
  tag: string | null;
  normalizedUrl: string | null;
  errors: string[];
}

export function parseSiteStripeUrl(input: string): SiteStripeResult {
  const errors: string[] = [];
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return {
      valid: false,
      asin: null,
      tag: null,
      normalizedUrl: null,
      errors: ["invalid_url"],
    };
  }

  if (!AMAZON_HOSTS.has(url.hostname)) errors.push("invalid_amazon_host");

  const asinMatch = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/);
  const asin = asinMatch?.[1] ?? url.searchParams.get("pd_rd_i");
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) errors.push("missing_asin");

  const tag = url.searchParams.get("tag");
  if (!tag) errors.push("missing_affiliate_tag");
  if (tag && tag !== EXPECTED_TAG) errors.push("affiliate_tag_mismatch");

  return {
    valid: errors.length === 0,
    asin: asin ?? null,
    tag,
    normalizedUrl: url.toString(),
    errors,
  };
}
```

- [ ] **Step 5: Implement publication readiness**

Create `lib/domain/publishing.ts`:

```ts
export interface PublicationCandidate {
  title: string;
  slug: string;
  excerpt: string;
  intro: string;
  criteria: string[];
  recommendation: string;
  affiliateNotice: string;
  reviewedAt: string | null;
  products: Array<{ asin: string; affiliateUrl: string; affiliateTag: string }>;
  sources: Array<{ label: string; url: string; checkedAt: string }>;
}

export interface PublicationBlocker {
  code: string;
  message: string;
}

export function getPublicationBlockers(
  input: PublicationCandidate,
): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = [];

  if (!input.affiliateNotice.trim()) {
    blockers.push({
      code: "missing_affiliate_notice",
      message: "Inclua o aviso de afiliado.",
    });
  }
  if (!input.reviewedAt) {
    blockers.push({
      code: "missing_review_date",
      message: "Informe a data da revisão.",
    });
  }
  if (input.products.length < 2) {
    blockers.push({
      code: "missing_products",
      message: "Inclua pelo menos dois produtos.",
    });
  }
  if (input.sources.length === 0) {
    blockers.push({
      code: "missing_sources",
      message: "Inclua pelo menos uma fonte verificável.",
    });
  }

  return blockers;
}
```

- [ ] **Step 6: Implement and test slug generation**

Create `tests/domain/slugs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createArticleSlug } from "@/lib/domain/slugs";

describe("createArticleSlug", () => {
  it("normalizes Portuguese titles", () => {
    expect(createArticleSlug("Air fryer: qual é a melhor opção?")).toBe(
      "air-fryer-qual-e-a-melhor-opcao",
    );
  });
});
```

Create `lib/domain/slugs.ts`:

```ts
export function createArticleSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 7: Run all domain tests**

```bash
npm test -- tests/domain
```

Expected: all domain tests pass.

- [ ] **Step 8: Commit domain rules**

```bash
git add lib/domain tests/domain
git commit -m "feat: validate affiliate links and publishing readiness"
```

---

### Task 4: Build the Approved Public Design System and Pages

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `components/site/header.tsx`
- Create: `components/site/footer.tsx`
- Create: `components/content/article-card.tsx`
- Create: `components/content/recommendation-summary.tsx`
- Create: `components/content/product-comparison.tsx`
- Create: `components/content/amazon-link.tsx`
- Create: `app/comparativos/page.tsx`
- Create: `app/comparativos/[slug]/page.tsx`
- Create: `app/categorias/[slug]/page.tsx`
- Create: `app/como-avaliamos/page.tsx`
- Create: `app/sobre/page.tsx`
- Create: `app/aviso-de-afiliado/page.tsx`
- Create: `app/privacidade/page.tsx`
- Create: `tests/components/product-comparison.test.tsx`
- Create: `tests/components/amazon-link.test.tsx`
- Create: `tests/routes/public-article.test.tsx`

**Interfaces:**
- Consumes: published article view models from `lib/repositories/articles.ts`.
- Produces: reusable public components and crawlable routes.

- [ ] **Step 1: Write failing component tests**

Create `tests/components/amazon-link.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmazonLink } from "@/components/content/amazon-link";

describe("AmazonLink", () => {
  it("renders a safe external affiliate link", () => {
    render(
      <AmazonLink
        href="https://www.amazon.com.br/dp/B0BHMGY76M?tag=topcomparat09-20"
        productName="Camiseta Daily"
      />,
    );
    const link = screen.getByRole("link", { name: /ver camiseta daily na amazon/i });
    expect(link).toHaveAttribute("rel", "sponsored noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
```

Create `tests/components/product-comparison.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductComparison } from "@/components/content/product-comparison";

describe("ProductComparison", () => {
  it("renders accessible column headers", () => {
    render(
      <ProductComparison
        products={[
          { name: "Echo Pop", verdict: "Melhor para ambientes pequenos" },
          { name: "Echo Dot", verdict: "Melhor qualidade de som" },
        ]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Produto" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Indicação" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/components
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the affiliate CTA**

Create `components/content/amazon-link.tsx`:

```tsx
interface AmazonLinkProps {
  href: string;
  productName: string;
}

export function AmazonLink({ href, productName }: AmazonLinkProps) {
  return (
    <a
      className="amazon-link"
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
    >
      Ver {productName} na Amazon
    </a>
  );
}
```

- [ ] **Step 4: Implement the comparison table**

Create `components/content/product-comparison.tsx`:

```tsx
interface ComparisonProduct {
  name: string;
  verdict: string;
}

export function ProductComparison({
  products,
}: {
  products: ComparisonProduct[];
}) {
  return (
    <div className="comparison-scroll" tabIndex={0} aria-label="Comparação de produtos">
      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Indicação</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.name}>
              <th scope="row">{product.name}</th>
              <td>{product.verdict}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Apply the approved visual tokens**

Define these CSS custom properties in `app/globals.css`:

```css
:root {
  --color-ink: #18352b;
  --color-action: #2f6f59;
  --color-accent: #39745f;
  --color-canvas: #f6f4ed;
  --color-muted: #5d665f;
  --color-border: #d8d4c8;
  --color-surface: #ffffff;
  --font-editorial: Georgia, "Times New Roman", serif;
  --font-ui: Inter, Arial, sans-serif;
  --content-width: 72rem;
  --reading-width: 46rem;
  --radius-card: 1rem;
  --shadow-card: 0 1rem 2.5rem rgb(24 53 43 / 0.08);
}
```

Implement mobile-first rules with:

- minimum body font size of `1rem`;
- line-height of at least `1.6`;
- visible `:focus-visible` outlines;
- 44px minimum interactive target height;
- responsive comparison-table overflow;
- maximum reading width of `46rem`;
- no horizontal page overflow at 320px.

- [ ] **Step 6: Implement public layouts and institutional content**

Use the approved copy:

- Hero title: `Escolhas mais inteligentes começam aqui.`
- Hero subtitle: `Nós comparamos. Você decide com clareza.`
- Primary action: `Descobrir recomendações`.
- Affiliate footer notice: `Como associado da Amazon, o Top Comparativos recebe por compras qualificadas.`

The methodology page must explicitly state:

- criteria are declared;
- pros and limitations are shown;
- recommendations vary by profile;
- products are not claimed as tested unless verified;
- prices and availability may change.

- [ ] **Step 7: Run component and route tests**

```bash
npm test -- tests/components tests/routes/public-article.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Run the agent preview and inspect responsive layouts**

Start the Sites agent preview, then verify:

- 1440×900 home page.
- 390×844 home page.
- 390×844 comparison table.
- Keyboard navigation through header and CTA.
- No clipped text or horizontal overflow.

Fix observable issues before continuing.

- [ ] **Step 9: Commit the public experience**

```bash
git add app components tests/components tests/routes/public-article.test.tsx
git commit -m "feat: build public editorial experience"
```

---

### Task 5: Implement the Single-User Protected Admin Shell

**Files:**
- Create: `lib/auth/admin.ts`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `components/admin/status-badge.tsx`
- Create: `tests/routes/admin-auth.test.ts`

**Interfaces:**
- Produces:
  - `requireAdmin(requestContext): Promise<AdminIdentity>`.
  - protected `/admin` layout.
- Consumes: Sites identity claims and the configured Olavo identity allowlist.

- [ ] **Step 1: Read the Sites authentication reference before coding**

Read:

```text
/root/.codex/plugins/cache/openai-curated-remote/sites/0.1.13/skills/sites-building/references/authentication.md
```

Use the current Sites-supported identity interface exactly as documented. Do not create username/password storage.

- [ ] **Step 2: Write failing authorization tests**

Create `tests/routes/admin-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAllowedAdmin } from "@/lib/auth/admin";

describe("admin allowlist", () => {
  it("allows the configured Olavo identity", () => {
    expect(
      isAllowedAdmin(
        { subject: "olavo", email: "olavo@example.invalid" },
        { subjects: ["olavo"], emails: [] },
      ),
    ).toBe(true);
  });

  it("rejects every identity outside the allowlist", () => {
    expect(
      isAllowedAdmin(
        { subject: "visitor", email: "visitor@example.invalid" },
        { subjects: ["olavo"], emails: [] },
      ),
    ).toBe(false);
  });
});
```

The `.invalid` addresses are test-only values and must never become production configuration.

- [ ] **Step 3: Run the authorization test and verify failure**

```bash
npm test -- tests/routes/admin-auth.test.ts
```

Expected: FAIL because `lib/auth/admin.ts` does not exist.

- [ ] **Step 4: Implement allowlist authorization**

Create `lib/auth/admin.ts` with:

```ts
export interface AdminIdentity {
  subject: string;
  email: string | null;
}

export interface AdminAllowlist {
  subjects: string[];
  emails: string[];
}

export function isAllowedAdmin(
  identity: AdminIdentity,
  allowlist: AdminAllowlist,
): boolean {
  return (
    allowlist.subjects.includes(identity.subject) ||
    (identity.email !== null && allowlist.emails.includes(identity.email))
  );
}
```

Add a server-only adapter `requireAdmin` using the exact Sites identity API discovered in Step 1. Read the allowlist from protected hosted runtime values:

- `ADMIN_SUBJECTS`
- `ADMIN_EMAILS`

Return HTTP 403 for an authenticated but unauthorized identity and redirect an unauthenticated visitor to the Sites sign-in flow.

- [ ] **Step 5: Implement the protected admin shell**

The `/admin` shell must include:

- `Visão geral`;
- `Radar diário`;
- `Fila editorial`;
- `Artigos`;
- `Configurações`.

Display no admin navigation in public layouts.

- [ ] **Step 6: Run authorization tests**

```bash
npm test -- tests/routes/admin-auth.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Verify protection in agent preview**

Check:

- unauthenticated `/admin` does not reveal content;
- unauthorized identity receives 403;
- configured Olavo identity opens the dashboard;
- `/admin` includes `noindex`.

- [ ] **Step 8: Commit admin protection**

```bash
git add lib/auth app/admin components/admin/status-badge.tsx tests/routes/admin-auth.test.ts
git commit -m "feat: protect the private editorial panel"
```

---

### Task 6: Implement Article CRUD and Editorial Status History

**Files:**
- Create: `lib/repositories/articles.ts`
- Create: `lib/repositories/products.ts`
- Create: `lib/repositories/audit.ts`
- Create: `app/admin/api/articles/route.ts`
- Create: `app/admin/api/articles/[id]/route.ts`
- Create: `app/admin/artigos/page.tsx`
- Create: `app/admin/artigos/novo/page.tsx`
- Create: `app/admin/artigos/[id]/page.tsx`
- Create: `components/admin/article-form.tsx`
- Create: `components/admin/readiness-checklist.tsx`
- Create: `tests/routes/publish.test.ts`

**Interfaces:**
- Produces:
  - `createArticle(input, actor): Promise<ArticleRecord>`.
  - `updateArticle(id, patch, actor): Promise<ArticleRecord>`.
  - `transitionArticle(id, nextStatus, actor): Promise<ArticleRecord>`.
  - `getArticleForAdmin(id): Promise<AdminArticleView>`.
- Consumes: D1 binding, publication blockers, SiteStripe parser, and authenticated admin identity.

- [ ] **Step 1: Define the allowed status-transition test**

Add to `tests/routes/publish.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/repositories/articles";

describe("editorial transitions", () => {
  it("allows review to awaiting_links", () => {
    expect(canTransition("review", "awaiting_links")).toBe(true);
  });

  it("allows ready to published", () => {
    expect(canTransition("ready", "published")).toBe(true);
  });

  it("rejects draft directly to published", () => {
    expect(canTransition("draft", "published")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the transition test and verify failure**

```bash
npm test -- tests/routes/publish.test.ts
```

Expected: FAIL because `canTransition` does not exist.

- [ ] **Step 3: Implement the transition map**

In `lib/repositories/articles.ts`:

```ts
import type { EditorialStatus } from "@/lib/domain/content";

const TRANSITIONS: Record<EditorialStatus, EditorialStatus[]> = {
  opportunity: ["approved", "rejected", "archived"],
  approved: ["researching", "archived"],
  researching: ["draft", "archived"],
  draft: ["review", "archived"],
  review: ["draft", "awaiting_links", "archived"],
  awaiting_links: ["review", "ready", "archived"],
  ready: ["review", "published", "archived"],
  published: ["review", "archived"],
  rejected: ["opportunity", "archived"],
  archived: ["draft"],
};

export function canTransition(
  current: EditorialStatus,
  next: EditorialStatus,
): boolean {
  return TRANSITIONS[current].includes(next);
}
```

- [ ] **Step 4: Implement transactional repository operations**

Every create, update, and transition must append an `audit_events` row containing:

```ts
{
  action: "article.created" | "article.updated" | "article.status_changed",
  actor: identity.subject,
  payloadJson: JSON.stringify({ before, after }),
  createdAt: new Date().toISOString(),
}
```

Reject invalid transitions before issuing database writes.

- [ ] **Step 5: Implement Zod validation at admin API boundaries**

Install Zod if absent:

```bash
npm install zod
```

The create/update schema must require:

- title: 10–160 characters;
- excerpt: 40–300 characters;
- non-empty intro;
- one or more criteria;
- non-empty recommendation;
- valid `YYYY-MM-DD` review date when present;
- boolean `testedByTopComparativos`.

Return:

- 400 for invalid payload;
- 401 for missing identity;
- 403 for non-admin identity;
- 404 for unknown article;
- 409 for invalid status transition.

- [ ] **Step 6: Implement the editorial forms**

The article editor must support:

- title and slug;
- excerpt;
- category;
- introduction;
- criteria list;
- recommendation;
- affiliate notice;
- review date;
- tested-by-us checkbox defaulting to false;
- products with SiteStripe link, verdict, pros, and limitations;
- sources with label, URL, type, and checked date.

Show parsing errors next to each SiteStripe URL.

- [ ] **Step 7: Implement the readiness checklist**

Display every blocker from `getPublicationBlockers` and disable the publish action until the array is empty and the status equals `ready`.

- [ ] **Step 8: Run CRUD and route tests**

```bash
npm test -- tests/repositories tests/routes/publish.test.ts
```

Expected: all tests pass.

- [ ] **Step 9: Commit the editorial workflow**

```bash
git add lib/repositories app/admin/api app/admin/artigos components/admin tests/repositories tests/routes/publish.test.ts package.json package-lock.json
git commit -m "feat: add editorial article workflow"
```

---

### Task 7: Connect Published Content to Public Routes and SEO

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/comparativos/page.tsx`
- Modify: `app/comparativos/[slug]/page.tsx`
- Modify: `app/categorias/[slug]/page.tsx`
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Modify: `lib/repositories/articles.ts`
- Modify: `tests/routes/public-article.test.tsx`

**Interfaces:**
- Produces:
  - `listPublishedArticles(): Promise<PublicArticleSummary[]>`.
  - `getPublishedArticleBySlug(slug): Promise<PublicArticleView | null>`.
  - metadata, canonical URL, and JSON-LD for each public article.
- Consumes: published D1 records only.

- [ ] **Step 1: Write the public visibility test**

Add to `tests/routes/public-article.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { isPublicStatus } from "@/lib/repositories/articles";

describe("public article visibility", () => {
  it("exposes only published articles", () => {
    expect(isPublicStatus("published")).toBe(true);
    expect(isPublicStatus("ready")).toBe(false);
    expect(isPublicStatus("draft")).toBe(false);
  });
});
```

- [ ] **Step 2: Implement strict public filtering**

Add:

```ts
export function isPublicStatus(status: EditorialStatus): boolean {
  return status === "published";
}
```

Every public query must include `status = "published"` and must return 404 for non-published slugs.

- [ ] **Step 3: Implement article metadata**

Each article must generate:

- unique `<title>`;
- meta description from `excerpt`;
- canonical `/comparativos/{slug}`;
- Open Graph title, description, and URL;
- `datePublished` and `dateModified`;
- editorial product-review JSON-LD without fabricated rating or price data.

- [ ] **Step 4: Implement crawl controls**

`app/robots.ts` must:

- allow `/`;
- disallow `/admin`;
- declare the sitemap URL.

`app/sitemap.ts` must include:

- home;
- institutional pages;
- category pages containing published content;
- published article URLs only.

- [ ] **Step 5: Run public route tests**

```bash
npm test -- tests/routes/public-article.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Validate rendered HTML**

For one published fixture page, inspect the agent preview HTML and confirm:

- one H1;
- canonical URL;
- affiliate notice;
- sponsored link relation;
- JSON-LD parses as JSON;
- no admin data;
- no unpublished article data.

- [ ] **Step 7: Commit public content integration**

```bash
git add app lib/repositories/articles.ts tests/routes/public-article.test.tsx
git commit -m "feat: publish editorial content with SEO metadata"
```

---

### Task 8: Seed Categories, Validate the Complete Foundation, and Deploy a Checkpoint

**Files:**
- Create: `db/seed.ts`
- Create: `tests/smoke/foundation.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: four category records, a verified foundation checkpoint, and operator documentation.
- Consumes: all prior tasks.

- [ ] **Step 1: Create deterministic category seed data**

Create `db/seed.ts` with:

```ts
export const CATEGORY_SEED = [
  { name: "Casa e cozinha", slug: "casa-e-cozinha", priority: 100 },
  { name: "Tecnologia", slug: "tecnologia", priority: 90 },
  { name: "Fitness e bem-estar", slug: "fitness-e-bem-estar", priority: 60 },
  { name: "Viagem", slug: "viagem", priority: 50 },
] as const;
```

Implement idempotent insertion keyed by category slug.

- [ ] **Step 2: Write the final foundation smoke test**

Create `tests/smoke/foundation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATEGORY_SEED } from "@/db/seed";
import { parseSiteStripeUrl } from "@/lib/domain/site-stripe";

describe("Top Comparativos foundation", () => {
  it("contains the four approved categories", () => {
    expect(CATEGORY_SEED.map((category) => category.slug)).toEqual([
      "casa-e-cozinha",
      "tecnologia",
      "fitness-e-bem-estar",
      "viagem",
    ]);
  });

  it("accepts the verified associate tag", () => {
    expect(
      parseSiteStripeUrl(
        "https://www.amazon.com.br/dp/B0BHMGY76M?tag=topcomparat09-20",
      ).valid,
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: exit code 0, `dist/server/index.js`, and `dist/.openai/hosting.json`.

- [ ] **Step 5: Run final agent-preview QA**

Verify:

- home, category, comparison index, article, and institutional routes;
- 320px, 390px, 768px, and 1440px widths;
- keyboard navigation;
- color contrast;
- protected `/admin`;
- create/edit/status flow;
- valid and invalid SiteStripe URLs;
- readiness blockers;
- publish and unpublish behavior;
- sitemap and robots output;
- no price or availability displayed.

- [ ] **Step 6: Document operations**

Update `README.md` with:

- product purpose;
- local commands;
- test command;
- build command;
- content status flow;
- SiteStripe link workflow;
- protected runtime variable names;
- statement that PA API is not active in this phase;
- link to `docs/specs/top-comparativos-design.md`.

- [ ] **Step 7: Commit the validated foundation**

```bash
git add db/seed.ts tests/smoke/foundation.test.ts README.md
git commit -m "chore: validate Top Comparativos foundation"
```

- [ ] **Step 8: Create the first hosted checkpoint**

Use the Sites lifecycle checkpoint command from the current Sites hosting skill and wait for the deployment-status verification to reach a terminal successful state.

Expected: a verified production checkpoint URL surfaced to Olavo, built from the exact committed source state.

---

## Deferred Plans

The following subsystems require their own implementation plans after this foundation is accepted:

1. **Daily Opportunity Radar**
   - daily 9h schedule;
   - five scored opportunities;
   - category diversity rules;
   - research-source adapters;
   - duplicate suppression;
   - notification and dashboard ingestion.

2. **AI Research and Draft Generation**
   - approved-opportunity trigger;
   - source gathering;
   - conflicting-fact handling;
   - structured article generation;
   - human-review handoff;
   - generation audit trail.

3. **Launch Content and Measurement**
   - select and produce ten initial articles;
   - link validation and editorial QA;
   - Search Console;
   - click tracking;
   - Amazon report import;
   - scoring recalibration.
