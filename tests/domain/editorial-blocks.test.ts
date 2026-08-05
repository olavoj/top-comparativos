import { describe, expect, it } from "vitest";
import {
  EditorialDocumentSchema,
  EditorialDraftEnvelopeSchema,
  MEDIA_KEY_PATTERN,
} from "@/lib/domain/editorial-blocks";

const validDocument = {
  version: 1,
  blocks: [
    { type: "paragraph", text: "Este é um parágrafo editorial seguro." },
    { type: "heading", level: 2, text: "Como avaliamos" },
    { type: "list", items: ["Critério objetivo", "Fonte verificável"] },
    { type: "callout", title: "Em resumo", text: "Compare antes de comprar." },
    {
      type: "table",
      columns: ["Critério", "Modelo A"],
      rows: [["Bateria", "10 horas"]],
    },
    { type: "image", mediaKey: "hero-potes.webp", alt: "Produto em destaque" },
    { type: "product", asin: "B0BHMGY76M" },
    {
      type: "faq",
      items: [{ question: "Vale a pena?", answer: "Depende do seu uso." }],
    },
  ],
};

const validEnvelope = {
  title: "Melhores caixas de som para sua casa",
  slug: "melhores-caixas-de-som",
  excerpt: "Um comparativo editorial para escolher uma caixa de som adequada.",
  categorySlug: "audio",
  articleType: "comparison",
  seo: {
    title: "Melhores caixas de som",
    description: "Compare caixas de som para encontrar a ideal.",
  },
  primaryKeyword: "melhores caixas de som",
  searchIntent: "commercial",
  document: validDocument,
  products: [
    {
      asin: "B0BHMGY76M",
      name: "Caixa de som exemplo",
      brand: "Marca exemplo",
      affiliateUrl: "https://www.amazon.com.br/dp/B0BHMGY76M",
      verdict: "A melhor para uso diário.",
      pros: ["Boa bateria"],
      limitations: ["Sem entrada auxiliar"],
    },
  ],
  sources: [
    {
      label: "Fabricante",
      url: "https://example.com/produto",
      sourceType: "manufacturer",
      checkedAt: "2026-08-04",
    },
  ],
};

describe("safe editorial block contract", () => {
  it("accepts a versioned document with every supported block", () => {
    expect(EditorialDocumentSchema.parse(validDocument)).toEqual(validDocument);
    expect(EditorialDraftEnvelopeSchema.parse(validEnvelope)).toEqual(validEnvelope);
  });

  it("rejects unknown blocks and raw HTML fields", () => {
    expect(
      EditorialDocumentSchema.safeParse({
        ...validDocument,
        blocks: [{ type: "embed", url: "https://example.com" }],
      }).success,
    ).toBe(false);
    expect(
      EditorialDocumentSchema.safeParse({
        ...validDocument,
        blocks: [{ type: "paragraph", text: "Seguro", html: "<b>não</b>" }],
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe URLs wherever external links are accepted", () => {
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        products: [{ ...validEnvelope.products[0], affiliateUrl: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        sources: [{ ...validEnvelope.sources[0], url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
  });

  it("rejects impossible source dates", () => {
    for (const checkedAt of ["2026-99-99", "2026-02-31"]) {
      expect(
        EditorialDraftEnvelopeSchema.safeParse({
          ...validEnvelope,
          sources: [{ ...validEnvelope.sources[0], checkedAt }],
        }).success,
      ).toBe(false);
    }
  });

  it("rejects empty arrays that carry editorial content", () => {
    expect(
      EditorialDocumentSchema.safeParse({ ...validDocument, blocks: [] }).success,
    ).toBe(false);
    expect(
      EditorialDocumentSchema.safeParse({
        ...validDocument,
        blocks: [{ type: "list", items: [] }],
      }).success,
    ).toBe(false);
    expect(
      EditorialDraftEnvelopeSchema.safeParse({ ...validEnvelope, sources: [] }).success,
    ).toBe(false);
  });

  it("rejects duplicate FAQ questions", () => {
    expect(
      EditorialDocumentSchema.safeParse({
        ...validDocument,
        blocks: [
          {
            type: "faq",
            items: [
              { question: "Como funciona?", answer: "Assim." },
              { question: "Como funciona?", answer: "Dessa forma." },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires every product block to reference an envelope product with an explicit HTTPS affiliate URL", () => {
    const documentWithProduct = {
      ...validDocument,
      blocks: [{ type: "product" as const, asin: "B0BHMGY76M" }],
    };

    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        document: documentWithProduct,
        products: undefined,
      }).success,
    ).toBe(false);
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        document: documentWithProduct,
        products: [{ ...validEnvelope.products[0], asin: "B09B8V1LZ3" }],
      }).success,
    ).toBe(false);
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        document: documentWithProduct,
        products: [{ ...validEnvelope.products[0], affiliateUrl: "http://example.com" }],
      }).success,
    ).toBe(false);
    const productWithoutAffiliateUrl = { ...validEnvelope.products[0] };
    delete (productWithoutAffiliateUrl as { affiliateUrl?: string }).affiliateUrl;
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        document: documentWithProduct,
        products: [productWithoutAffiliateUrl],
      }).success,
    ).toBe(false);
    expect(
      EditorialDraftEnvelopeSchema.safeParse({
        ...validEnvelope,
        document: documentWithProduct,
        products: [
          validEnvelope.products[0],
          { ...validEnvelope.products[0], asin: "B09B8V1LZ3", name: "Produto extra" },
        ],
      }).success,
    ).toBe(true);
  });

  it("allows only basename-shaped media keys", () => {
    expect(MEDIA_KEY_PATTERN.test("hero-potes.webp")).toBe(true);
    expect(MEDIA_KEY_PATTERN.test("articles/hero.webp")).toBe(false);

    for (const mediaKey of ["../hero.webp", "folder/hero.webp", ".hidden.png"]) {
      expect(
        EditorialDocumentSchema.safeParse({
          ...validDocument,
          blocks: [{ type: "image", mediaKey, alt: "Imagem segura" }],
        }).success,
      ).toBe(false);
    }
  });
});
