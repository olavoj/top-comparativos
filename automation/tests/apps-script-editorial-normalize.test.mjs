import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const helperPath = path.resolve('automation/apps-script/EditorialNormalize.js');

function loadHelper() {
  const context = vm.createContext({});
  const source = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, 'utf8') : '';
  vm.runInContext(source, context, { filename: helperPath });
  return context.topcNormalizarRevisaoEditorial_;
}

test('remove metadados da revisão e preserva capa, conteúdo e fontes', () => {
  const normalize = loadHelper();
  assert.equal(typeof normalize, 'function', 'helper de normalização deve existir');

  const sources = [{ label: 'Google Search Central', url: 'https://developers.google.com/search' }];
  const result = normalize({
    title: 'Guia completo de potes herméticos',
    excerpt: 'Revisão editorial',
    sources,
    blocks: [
      { type: 'paragraph', text: 'Revisão editorial' },
      { type: 'paragraph', text: 'Versão revisada automaticamente. Aprovação humana obrigatória.' },
      { type: 'image', mediaKey: 'capa-guia.webp', alt: 'Capa do guia' },
      { type: 'paragraph', text: 'CLASSIFICAÇÃO: EVERGREEN' },
      { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
      { type: 'paragraph', text: 'TÍTULO SEO:' },
      { type: 'paragraph', text: 'Como Escolher Potes Herméticos: Guia Completo' },
      { type: 'paragraph', text: 'META DESCRIPTION:' },
      { type: 'paragraph', text: 'Aprenda como escolher potes herméticos ideais para sua cozinha.' },
      { type: 'paragraph', text: 'SLUG:' },
      { type: 'paragraph', text: 'guia-completo-potes-hermeticos' },
      { type: 'paragraph', text: 'PALAVRA-CHAVE PRINCIPAL:' },
      { type: 'paragraph', text: 'como escolher potes herméticos' },
      { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' },
      { type: 'paragraph', text: 'pote hermético de vidro, organização de despensa' },
      { type: 'paragraph', text: 'Escolher o pote certo ajuda a conservar melhor os alimentos.' },
      { type: 'heading', level: 2, text: 'Como escolher potes herméticos' },
    ],
  });

  assert.equal(result.seoTitle, 'Como Escolher Potes Herméticos: Guia Completo');
  assert.equal(result.seoDescription, 'Aprenda como escolher potes herméticos ideais para sua cozinha.');
  assert.equal(result.excerpt, 'Escolher o pote certo ajuda a conservar melhor os alimentos.');
  assert.deepEqual(JSON.parse(JSON.stringify(result.sources)), sources);
  assert.deepEqual(JSON.parse(JSON.stringify(result.blocks)), [
    { type: 'image', mediaKey: 'capa-guia.webp', alt: 'Capa do guia' },
    { type: 'paragraph', text: 'Escolher o pote certo ajuda a conservar melhor os alimentos.' },
    { type: 'heading', level: 2, text: 'Como escolher potes herméticos' },
  ]);
});

test('mantém o comportamento legado quando não há marcador de revisão', () => {
  const normalize = loadHelper();
  assert.equal(typeof normalize, 'function', 'helper de normalização deve existir');

  const input = {
    title: 'Título legado',
    excerpt: 'Resumo legado',
    sources: [],
    blocks: [{ type: 'paragraph', text: 'Resumo legado' }],
  };
  const result = normalize(input);

  assert.equal(result.title, input.title);
  assert.equal(result.excerpt, input.excerpt);
  assert.equal(result.seoTitle, input.title);
  assert.equal(result.seoDescription, input.excerpt);
  assert.deepEqual(JSON.parse(JSON.stringify(result.blocks)), input.blocks);
});
