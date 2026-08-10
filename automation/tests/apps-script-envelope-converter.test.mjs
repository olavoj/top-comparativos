import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = [
  new URL('../apps-script/EnvelopeImages.js', import.meta.url),
  new URL('../apps-script/EditorialNormalize.js', import.meta.url),
  new URL('../apps-script/Código.js', import.meta.url)
];

const ElementType = {
  PARAGRAPH: 'PARAGRAPH',
  LIST_ITEM: 'LIST_ITEM',
  TABLE: 'TABLE',
  INLINE_IMAGE: 'INLINE_IMAGE'
};

const ParagraphHeading = {
  NORMAL: 'NORMAL',
  TITLE: 'TITLE',
  HEADING1: 'HEADING1',
  HEADING2: 'HEADING2',
  HEADING3: 'HEADING3'
};

function paragrafo(texto, heading = ParagraphHeading.NORMAL) {
  const elemento = {
    getType: () => ElementType.PARAGRAPH,
    getText: () => texto,
    getHeading: () => heading,
    getNumChildren: () => 0,
    getChild: () => null
  };
  elemento.asParagraph = () => elemento;
  return elemento;
}

function paragrafoComImagem(altTitle) {
  const imagem = {
    getType: () => ElementType.INLINE_IMAGE,
    asInlineImage: () => ({ getAltTitle: () => altTitle })
  };

  const elemento = {
    getType: () => ElementType.PARAGRAPH,
    getText: () => '',
    getHeading: () => ParagraphHeading.NORMAL,
    getNumChildren: () => 1,
    getChild: () => imagem
  };

  elemento.asParagraph = () => elemento;
  return elemento;
}

function documento(elementos) {
  return {
    getBody: () => ({
      getNumChildren: () => elementos.length,
      getChild: indice => elementos[indice]
    })
  };
}

function converter(elementos, midias) {
  const context = vm.createContext({
    DocumentApp: { ElementType, ParagraphHeading }
  });

  for (const script of scripts) {
    vm.runInContext(fs.readFileSync(script, 'utf8'), context, {
      filename: String(script)
    });
  }

  return context.topcConverterDocumentoEditorial_(
    documento(elementos),
    midias
  );
}

const capa = {
  mediaKey: 'imagem-principal-artigo.jpg',
  role: 'cover',
  alt: 'Imagem principal artigo'
};

const internas = [
  { mediaKey: 'editorial-1-artigo.jpg', role: 'inline', alt: 'Editorial 1' },
  { mediaKey: 'editorial-2-artigo.jpg', role: 'inline', alt: 'Editorial 2' },
  { mediaKey: 'editorial-3-artigo.jpg', role: 'inline', alt: 'Editorial 3' }
];

const introducao =
  'Escolher uma sanduicheira elétrica exige atenção a alguns detalhes ' +
  'simples que mudam bastante o resultado no dia a dia.';

function documentoRevisado(alts) {
  return [
    paragrafo('Revisão editorial', ParagraphHeading.TITLE),
    paragrafo('=== CONTEÚDO PARA PUBLICAÇÃO ==='),
    paragrafo('TÍTULO SEO:'),
    paragrafo('Guia de sanduicheiras elétricas'),
    paragrafo('Guia completo', ParagraphHeading.HEADING1),
    paragrafo(introducao),
    paragrafoComImagem(alts[0]),
    paragrafo('Como escolher', ParagraphHeading.HEADING2),
    paragrafoComImagem(alts[1]),
    paragrafo('Texto da seção com informação útil para o leitor.'),
    paragrafoComImagem(alts[2]),
    paragrafoComImagem(alts[3]),
    paragrafo('FONTES PARA REVISÃO:'),
    paragrafo('https://exemplo.com.br/fonte')
  ];
}

function mediaKeys(resultado) {
  // structuredClone traz o array do contexto do vm para o realm do teste.
  return structuredClone(resultado.blocks)
    .filter(bloco => bloco.type === 'image')
    .map(bloco => bloco.mediaKey);
}

test('cada mídia concluída aparece uma única vez no envelope', () => {
  const resultado = converter(
    documentoRevisado([
      'imagem-principal-artigo.webp',
      'editorial-1-artigo.webp',
      'editorial-2-artigo.webp',
      'editorial-3-artigo.webp'
    ]),
    [capa, ...internas]
  );

  assert.deepEqual(mediaKeys(resultado), [
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);

  assert.equal(resultado.title, 'Guia completo');
  assert.equal(resultado.excerpt, introducao);
  assert.deepEqual(structuredClone(resultado.sources), [
    { label: 'exemplo.com.br', url: 'https://exemplo.com.br/fonte' }
  ]);
});

test('documento antigo sem alt não duplica a capa nem perde a última imagem', () => {
  const resultado = converter(
    documentoRevisado(['', '', '', '']),
    [capa, ...internas]
  );

  assert.deepEqual(mediaKeys(resultado), [
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);
});

test('capa que não está no corpo entra no início do conteúdo', () => {
  const elementos = documentoRevisado(['', '', '', '']).filter(
    (_, indice) => indice !== 11
  );

  const resultado = converter(elementos, [capa, ...internas]);

  assert.deepEqual(mediaKeys(resultado), [
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);

  assert.equal(resultado.blocks[0].type, 'image');
  assert.equal(resultado.blocks[0].mediaKey, 'imagem-principal-artigo.jpg');
});

test('artigo sem H1 é recusado antes de virar envelope', () => {
  const elementos = documentoRevisado(['', '', '', '']).filter(
    elemento => elemento.getHeading() !== ParagraphHeading.HEADING1
  );

  assert.throws(
    () => converter(elementos, [capa, ...internas]),
    /H1 do artigo/
  );
});
