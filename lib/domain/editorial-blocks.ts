import { z } from "zod";

/** A safe, single-file media name: no paths, hidden files, or traversal. */
export const MEDIA_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const MAX_DOCUMENT_BLOCKS = 250;
const MAX_LIST_ITEMS = 100;
const MAX_TABLE_COLUMNS = 20;
const MAX_TABLE_ROWS = 100;
const MAX_FAQ_ITEMS = 50;
const MAX_PRODUCTS = 100;
const MAX_SOURCES = 100;

const htmlTagPattern = /<[^>]*>/;
const safeText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !htmlTagPattern.test(value), "HTML bruto não é permitido.");

const urlSchema = z
  .string()
  .url()
  .max(2_048)
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Links externos devem usar HTTPS.",
  );

const mediaKeySchema = z
  .string()
  .regex(MEDIA_KEY_PATTERN, "A chave de mídia deve ser um basename seguro.");

const paragraphBlockSchema = z
  .object({ type: z.literal("paragraph"), text: safeText(10_000) })
  .strict();

const headingBlockSchema = z
  .object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: safeText(300) })
  .strict();

const listBlockSchema = z
  .object({ type: z.literal("list"), items: z.array(safeText(500)).min(1).max(MAX_LIST_ITEMS) })
  .strict();

const calloutBlockSchema = z
  .object({ type: z.literal("callout"), title: safeText(300), text: safeText(5_000) })
  .strict();

const tableBlockSchema = z
  .object({
    type: z.literal("table"),
    columns: z.array(safeText(300)).min(1).max(MAX_TABLE_COLUMNS),
    rows: z
      .array(z.array(safeText(1_000)).min(1).max(MAX_TABLE_COLUMNS))
      .min(1)
      .max(MAX_TABLE_ROWS),
  })
  .strict()
  .superRefine((table, context) => {
    for (const [rowIndex, row] of table.rows.entries()) {
      if (row.length !== table.columns.length) {
        context.addIssue({
          code: "custom",
          path: ["rows", rowIndex],
          message: "Cada linha deve ter uma célula por coluna.",
        });
      }
    }
  });

const imageBlockSchema = z
  .object({
    type: z.literal("image"),
    mediaKey: mediaKeySchema,
    alt: safeText(500),
    caption: safeText(1_000).optional(),
  })
  .strict();

const productBlockSchema = z
  .object({
    type: z.literal("product"),
    asin: z.string().trim().regex(/^[A-Z0-9]{10}$/).max(10),
  })
  .strict();

const faqItemSchema = z
  .object({ question: safeText(500), answer: safeText(5_000) })
  .strict();

const faqBlockSchema = z
  .object({
    type: z.literal("faq"),
    items: z.array(faqItemSchema).min(1).max(MAX_FAQ_ITEMS),
  })
  .strict()
  .superRefine((faq, context) => {
    const questions = new Set<string>();
    for (const [index, item] of faq.items.entries()) {
      const question = item.question.toLocaleLowerCase("pt-BR");
      if (questions.has(question)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "question"],
          message: "As perguntas frequentes devem ser únicas.",
        });
      }
      questions.add(question);
    }
  });

const editorialBlockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  calloutBlockSchema,
  tableBlockSchema,
  imageBlockSchema,
  productBlockSchema,
  faqBlockSchema,
]);

export const EditorialDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(editorialBlockSchema).min(1).max(MAX_DOCUMENT_BLOCKS),
  })
  .strict();

const seoSchema = z
  .object({ title: safeText(160), description: safeText(320) })
  .strict();

const productSchema = z
  .object({
    asin: z.string().trim().regex(/^[A-Z0-9]{10}$/).max(10),
    name: safeText(300),
    brand: safeText(200),
    affiliateUrl: urlSchema,
    imageUrl: urlSchema.optional(),
    verdict: safeText(2_000),
    pros: z.array(safeText(500)).min(1).max(MAX_LIST_ITEMS),
    limitations: z.array(safeText(500)).min(1).max(MAX_LIST_ITEMS),
  })
  .strict();

const sourceSchema = z
  .object({
    label: safeText(300),
    url: urlSchema,
    sourceType: safeText(100),
    checkedAt: z.iso.date(),
  })
  .strict();

export const EditorialDraftEnvelopeSchema = z
  .object({
    title: safeText(160),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
    excerpt: safeText(500),
    categorySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
    articleType: z.enum(["review", "comparison", "blog"]),
    seo: seoSchema,
    primaryKeyword: safeText(200),
    searchIntent: z.enum(["informational", "commercial", "transactional", "navigational"]),
    document: EditorialDocumentSchema,
    products: z.array(productSchema).min(1).max(MAX_PRODUCTS).optional(),
    sources: z.array(sourceSchema).min(1).max(MAX_SOURCES),
  })
  .strict()
  .superRefine((envelope, context) => {
    const productAsins = new Set(envelope.products?.map((product) => product.asin));

    for (const [index, block] of envelope.document.blocks.entries()) {
      if (block.type === "product" && !productAsins.has(block.asin)) {
        context.addIssue({
          code: "custom",
          path: ["document", "blocks", index, "asin"],
          message: "Todo bloco de produto deve referenciar um produto com URL de afiliado explícita.",
        });
      }
    }
  });

export type EditorialDocument = z.infer<typeof EditorialDocumentSchema>;
export type EditorialDraftEnvelope = z.infer<typeof EditorialDraftEnvelopeSchema>;
