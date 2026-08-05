import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ArticleType } from "@/lib/domain/content";

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
    articleType: text("article_type")
      .$type<ArticleType>()
      .notNull()
      .default("comparison"),
    status: text("status").notNull().default("draft"),
    intro: text("intro").notNull(),
    criteriaJson: text("criteria_json").notNull(),
    recommendation: text("recommendation").notNull(),
    affiliateNotice: text("affiliate_notice").notNull(),
    testedByTopComparativos: integer("tested_by_top_comparativos", { mode: "boolean" })
      .notNull()
      .default(false),
    sourceKey: text("source_key"),
    draftContentJson: text("draft_content_json"),
    publishedContentJson: text("published_content_json"),
    draftHeroMediaId: integer("draft_hero_media_id"),
    publishedHeroMediaId: integer("published_hero_media_id"),
    draftVersion: integer("draft_version").notNull().default(1),
    publishedVersion: integer("published_version").notNull().default(1),
    reviewedAt: text("reviewed_at"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("articles_slug_unique").on(table.slug),
    uniqueIndex("articles_source_key_unique").on(table.sourceKey),
    foreignKey(() => ({
      name: "articles_draft_hero_same_article_fk",
      columns: [table.id, table.draftHeroMediaId],
      foreignColumns: [articleMedia.articleId, articleMedia.id],
    })),
    foreignKey(() => ({
      name: "articles_published_hero_same_article_fk",
      columns: [table.id, table.publishedHeroMediaId],
      foreignColumns: [articleMedia.articleId, articleMedia.id],
    })),
  ],
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

/**
 * Import mutations write these rows only. Existing `article_products` stays the
 * public relation until a future explicit promotion copies this draft snapshot.
 */
export const draftArticleProducts = sqliteTable("article_draft_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  asin: text("asin").notNull(),
  affiliateUrl: text("affiliate_url").notNull(),
  affiliateTag: text("affiliate_tag").notNull(),
  imageUrl: text("image_url"),
  verdict: text("verdict").notNull(),
  prosJson: text("pros_json").notNull(),
  consJson: text("cons_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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

/**
 * Import mutations write these rows only. Existing `sources` stays the public
 * relation until a future explicit promotion copies this draft snapshot.
 */
export const draftSources = sqliteTable("article_draft_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(),
  checkedAt: text("checked_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const automationOperations = sqliteTable(
  "automation_operations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    operation: text("operation").notNull(),
    requestId: text("request_id").notNull(),
    sourceKey: text("source_key").notNull(),
    bodySha256: text("body_sha256").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("automation_operations_operation_request_id_unique").on(
      table.operation,
      table.requestId,
    ),
  ],
);

export const articleMedia = sqliteTable(
  "article_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    mediaKey: text("media_key").notNull(),
    draftObjectKey: text("draft_object_key"),
    draftChecksum: text("draft_checksum"),
    draftMimeType: text("draft_mime_type"),
    draftFilename: text("draft_filename"),
    draftAlt: text("draft_alt"),
    draftRole: text("draft_role"),
    draftPosition: integer("draft_position"),
    publishedObjectKey: text("published_object_key"),
    publishedChecksum: text("published_checksum"),
    publishedMimeType: text("published_mime_type"),
    publishedFilename: text("published_filename"),
    publishedAlt: text("published_alt"),
    publishedRole: text("published_role"),
    publishedPosition: integer("published_position"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("article_media_article_id_id_unique").on(
      table.articleId,
      table.id,
    ),
    uniqueIndex("article_media_article_id_media_key_unique").on(
      table.articleId,
      table.mediaKey,
    ),
  ],
);

export const mediaGcCandidates = sqliteTable(
  "media_gc_candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    objectKey: text("object_key").notNull(),
    state: text("state").notNull().default("pending"),
    claimToken: text("claim_token"),
    claimFencingToken: integer("claim_fencing_token"),
    lastCheckedAt: text("last_checked_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("media_gc_candidates_object_key_unique").on(table.objectKey),
    index("media_gc_candidates_state_last_checked_at_id_index").on(
      table.state,
      table.lastCheckedAt,
      table.id,
    ),
  ],
);

export const mediaGcState = sqliteTable("media_gc_state", {
  id: integer("id").primaryKey(),
  inventoryCursor: text("inventory_cursor"),
  updatedAt: text("updated_at").notNull(),
});

export const mediaGcLease = sqliteTable("media_gc_lease", {
  id: integer("id").primaryKey(),
  ownerToken: text("owner_token"),
  fencingToken: integer("fencing_token").notNull().default(0),
  acquiredAt: text("acquired_at"),
  expiresAt: text("expires_at"),
  updatedAt: text("updated_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").references(() => articles.id),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export type ArticleRecord = typeof articles.$inferSelect;
export type ProductRecord = typeof products.$inferSelect;
export type SourceRecord = typeof sources.$inferSelect;
export type AuditEventRecord = typeof auditEvents.$inferSelect;
export type DraftArticleProductRecord = typeof draftArticleProducts.$inferSelect;
export type DraftSourceRecord = typeof draftSources.$inferSelect;
export type AutomationOperationRecord = typeof automationOperations.$inferSelect;
export type ArticleMediaRecord = typeof articleMedia.$inferSelect;
export type MediaGcCandidateRecord = typeof mediaGcCandidates.$inferSelect;
