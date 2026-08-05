import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

type TableLike = Record<string, { name: string }>;

let database: DatabaseSync | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

function table(name: string): TableLike {
  const value = (schema as Record<string, unknown>)[name];
  expect(value, `Expected ${name} to be exported from db/schema.ts`).toBeDefined();
  return value as TableLike;
}

function migrationPath(version: string): string {
  const migrations = readdirSync(resolve("drizzle")).filter((file) =>
    new RegExp(`^${version}_.*\\.sql$`).test(file),
  );

  expect(migrations, `Expected exactly one ${version} migration`).toHaveLength(1);
  return resolve("drizzle", migrations[0]!);
}

function createLegacyDatabase(): DatabaseSync {
  database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(readFileSync(migrationPath("0000"), "utf8"));
  database.exec(readFileSync(migrationPath("0001"), "utf8"));

  database
    .prepare(
      `INSERT INTO categories (id, name, slug, priority, created_at)
      VALUES (1, ?, ?, 0, ?)`,
    )
    .run("Tecnologia", "tecnologia", "2026-08-04T00:00:00.000Z");
  insertLegacyArticle(database, 7, "artigo-legado", "2026-08-04T00:00:00.000Z");
  insertLegacyArticle(database, 8, "segundo-artigo", "2026-08-04T00:01:00.000Z");
  database
    .prepare(
      `INSERT INTO products (
        id, name, brand, asin, affiliate_url, affiliate_tag, image_url, created_at, updated_at
      ) VALUES (11, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "Produto legado",
      "Marca",
      "B000LEGACY",
      "https://example.invalid/produto",
      "tag-legado",
      "https://example.invalid/produto.webp",
      "2026-08-04T00:00:00.000Z",
      "2026-08-04T00:00:00.000Z",
    );
  database.exec(
    `INSERT INTO article_products (
      article_id, product_id, position, verdict, pros_json, cons_json
    ) VALUES (7, 11, 0, 'Veredito legado', '["Pró"]', '["Contra"]');
    INSERT INTO sources (
      id, article_id, label, url, source_type, checked_at
    ) VALUES (13, 7, 'Fonte legada', 'https://example.invalid/fonte', 'manufacturer', '2026-08-04');
    INSERT INTO audit_events (
      id, article_id, action, actor, payload_json, created_at
    ) VALUES (17, 7, 'legacy', 'owner@example.invalid', '{"safe":true}', '2026-08-04T00:00:00.000Z');`,
  );

  return database;
}

function insertLegacyArticle(
  db: DatabaseSync,
  id: number,
  slug: string,
  timestamp: string,
) {
  db
    .prepare(
      `INSERT INTO articles (
        id, title, slug, excerpt, category_id, article_type, status, intro,
        criteria_json, recommendation, affiliate_notice, tested_by_top_comparativos,
        reviewed_at, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'comparison', 'published', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    )
    .run(
      id,
      `Título ${id}`,
      slug,
      `Resumo ${id}`,
      `Introdução ${id}`,
      '["critério"]',
      `Recomendação ${id}`,
      "Aviso de afiliado",
      timestamp,
      timestamp,
      timestamp,
      timestamp,
    );
}

function tableInfo(db: DatabaseSync, tableName: string) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;
}

function indexColumns(db: DatabaseSync, indexName: string): string[] {
  return (
    db.prepare(`PRAGMA index_info(${indexName})`).all() as Array<{
      seqno: number;
      name: string;
    }>
  )
    .sort((left, right) => left.seqno - right.seqno)
    .map((column) => column.name);
}

function expectUniqueIndex(
  db: DatabaseSync,
  tableName: string,
  indexName: string,
  columns: string[],
) {
  expect(db.prepare(`PRAGMA index_list(${tableName})`).all()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: indexName, unique: 1 }),
    ]),
  );
  expect(indexColumns(db, indexName)).toEqual(columns);
}

describe("editorial automation persistence contract", () => {
  it("binds the media bucket as MEDIA", () => {
    const hosting = JSON.parse(
      readFileSync(resolve(".openai/hosting.json"), "utf8"),
    ) as { r2?: string | null };

    expect(hosting.r2).toBe("MEDIA");
  });

  it("models versioned article content and separate draft relationships", () => {
    const article = table("articles");

    expect(article.sourceKey.name).toBe("source_key");
    expect(article.draftContentJson.name).toBe("draft_content_json");
    expect(article.publishedContentJson.name).toBe("published_content_json");
    expect(article.draftHeroMediaId.name).toBe("draft_hero_media_id");
    expect(article.publishedHeroMediaId.name).toBe("published_hero_media_id");
    expect(article.draftVersion.name).toBe("draft_version");
    expect(article.publishedVersion.name).toBe("published_version");

    expect(table("draftArticleProducts").articleId.name).toBe("article_id");
    expect(table("draftSources").articleId.name).toBe("article_id");
  });

  it("exposes the operation, media, and garbage-collection physical columns", () => {
    const operations = table("automationOperations");
    expect(operations.operation.name).toBe("operation");
    expect(operations.requestId.name).toBe("request_id");
    expect(operations.sourceKey.name).toBe("source_key");
    expect(operations.bodySha256.name).toBe("body_sha256");
    expect(operations.resultJson.name).toBe("result_json");
    expect(operations.createdAt.name).toBe("created_at");

    const articleMedia = table("articleMedia");
    expect(articleMedia.mediaKey.name).toBe("media_key");
    expect(articleMedia.draftObjectKey.name).toBe("draft_object_key");
    expect(articleMedia.publishedObjectKey.name).toBe("published_object_key");

    const candidates = table("mediaGcCandidates");
    expect(candidates.state.name).toBe("state");
    expect(candidates.claimToken.name).toBe("claim_token");
    expect(candidates.claimFencingToken.name).toBe("claim_fencing_token");
    expect(candidates.lastCheckedAt.name).toBe("last_checked_at");

    expect(table("mediaGcState").inventoryCursor.name).toBe("inventory_cursor");

    const mediaGcLease = table("mediaGcLease");
    expect(mediaGcLease.ownerToken.name).toBe("owner_token");
    expect(mediaGcLease.fencingToken.name).toBe("fencing_token");
    expect(mediaGcLease.acquiredAt.name).toBe("acquired_at");
    expect(mediaGcLease.expiresAt.name).toBe("expires_at");
  });

  it("preserves legacy data and enforces same-article hero references", () => {
    const db = createLegacyDatabase();
    const legacyArticle = db
      .prepare(
        `SELECT id, title, slug, excerpt, category_id, article_type, status, intro,
          criteria_json, recommendation, affiliate_notice, tested_by_top_comparativos,
          reviewed_at, published_at, created_at, updated_at
        FROM articles WHERE id = 7`,
      )
      .get();
    const legacyRelations = {
      products: db.prepare("SELECT * FROM article_products").all(),
      sources: db.prepare("SELECT * FROM sources").all(),
      auditEvents: db.prepare("SELECT * FROM audit_events").all(),
    };

    const migration = readFileSync(migrationPath("0002"), "utf8");
    expect(migration).toMatch(/PRAGMA\s+defer_foreign_keys\s*=\s*ON\s*;/i);
    expect(migration).not.toMatch(/PRAGMA\s+foreign_keys\s*=\s*OFF\s*;/i);
    expect(db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });

    db.exec("BEGIN");
    try {
      db.exec(migration);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    expect(db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });

    expect(
      db
        .prepare(
          `SELECT id, title, slug, excerpt, category_id, article_type, status, intro,
            criteria_json, recommendation, affiliate_notice, tested_by_top_comparativos,
            reviewed_at, published_at, created_at, updated_at
          FROM articles WHERE id = 7`,
        )
        .get(),
    ).toEqual(legacyArticle);
    expect(db.prepare("SELECT * FROM article_products").all()).toEqual(
      legacyRelations.products,
    );
    expect(db.prepare("SELECT * FROM sources").all()).toEqual(legacyRelations.sources);
    expect(db.prepare("SELECT * FROM audit_events").all()).toEqual(
      legacyRelations.auditEvents,
    );
    expect(
      db
        .prepare(
          "SELECT draft_version, published_version FROM articles WHERE id = 7",
        )
        .get(),
    ).toEqual({ draft_version: 1, published_version: 1 });

    expect(tableInfo(db, "articles")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "draft_version",
          notnull: 1,
          dflt_value: "1",
        }),
        expect.objectContaining({
          name: "published_version",
          notnull: 1,
          dflt_value: "1",
        }),
      ]),
    );
    expectUniqueIndex(db, "articles", "articles_source_key_unique", ["source_key"]);
    expectUniqueIndex(db, "articles", "articles_slug_unique", ["slug"]);
    expectUniqueIndex(db, "automation_operations", "automation_operations_operation_request_id_unique", [
      "operation",
      "request_id",
    ]);
    expectUniqueIndex(db, "article_media", "article_media_article_id_id_unique", [
      "article_id",
      "id",
    ]);
    expectUniqueIndex(db, "article_media", "article_media_article_id_media_key_unique", [
      "article_id",
      "media_key",
    ]);
    expectUniqueIndex(db, "media_gc_candidates", "media_gc_candidates_object_key_unique", [
      "object_key",
    ]);
    expect(indexColumns(db, "media_gc_candidates_state_last_checked_at_id_index")).toEqual([
      "state",
      "last_checked_at",
      "id",
    ]);

    const articleForeignKeys = db
      .prepare("PRAGMA foreign_key_list(articles)")
      .all() as Array<{ table: string; from: string; to: string }>;
    expect(articleForeignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "article_media",
          from: "draft_hero_media_id",
          to: "id",
        }),
        expect.objectContaining({
          table: "article_media",
          from: "published_hero_media_id",
          to: "id",
        }),
      ]),
    );
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    insertMedia(db, 70, 7, "hero-principal");
    insertMedia(db, 71, 8, "hero-de-outro-artigo");
    db.exec(
      "UPDATE articles SET draft_hero_media_id = 70, published_hero_media_id = 70 WHERE id = 7",
    );

    expect(() =>
      db.exec("UPDATE articles SET draft_hero_media_id = 999 WHERE id = 7"),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      db.exec("UPDATE articles SET published_hero_media_id = 999 WHERE id = 7"),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      db.exec("UPDATE articles SET draft_hero_media_id = 71 WHERE id = 7"),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      db.exec("UPDATE articles SET published_hero_media_id = 71 WHERE id = 7"),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});

function insertMedia(db: DatabaseSync, id: number, articleId: number, mediaKey: string) {
  db
    .prepare(
      `INSERT INTO article_media (
        id, article_id, media_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      articleId,
      mediaKey,
      "2026-08-04T00:00:00.000Z",
      "2026-08-04T00:00:00.000Z",
    );
}
