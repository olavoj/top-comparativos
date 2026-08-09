import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const helperPath = path.resolve('automation/apps-script/EditorialNormalize.js');
function loadHelper() { const context = vm.createContext({}); vm.runInContext(fs.readFileSync(helperPath, 'utf8'), context, { filename: helperPath }); return context.topcNormalizarRevisaoEditorial_; }
const plain = value => JSON.parse(JSON.stringify(value));

test('remove múltiplas palavras-chave secundárias até o H1', () => {
  const normalize = loadHelper();
  const result = normalize({ title: 'Guia', excerpt: 'Revisão', sources: [], blocks: [
    { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
    { type: 'paragraph', text: 'TÍTULO SEO:' }, { type: 'paragraph', text: 'Guia SEO' },
    { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' },
    { type: 'paragraph', text: 'sanduicheira elétrica' },
    { type: 'paragraph', text: 'melhor sanduicheira' },
    { type: 'paragraph', text: 'sanduicheira grill' },
    { type: 'heading', level: 1, text: 'Guia completo para escolher uma sanduicheira elétrica' },
    { type: 'paragraph', text: 'Escolher uma boa sanduicheira começa pelo uso que você pretende fazer.' },
  ]});
  assert.deepEqual(plain(result.blocks), [
    { type: 'heading', level: 1, text: 'Guia completo para escolher uma sanduicheira elétrica' },
    { type: 'paragraph', text: 'Escolher uma boa sanduicheira começa pelo uso que você pretende fazer.' },
  ]);
  assert.equal(result.excerpt, 'Escolher uma boa sanduicheira começa pelo uso que você pretende fazer.');
});

test('remove metadados de valor único e preserva conteúdo', () => {
  const normalize = loadHelper();
  const result = normalize({ title: 'Guia', excerpt: 'Revisão', sources: [], blocks: [
    { type: 'image', mediaKey: 'capa.webp' },
    { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
    { type: 'paragraph', text: 'META DESCRIPTION:' }, { type: 'paragraph', text: 'Descrição SEO' },
    { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' }, { type: 'paragraph', text: 'keyword única' },
    { type: 'heading', level: 1, text: 'Guia' }, { type: 'paragraph', text: 'Conteúdo real.' },
  ]});
  assert.equal(result.seoDescription, 'Descrição SEO');
  assert.deepEqual(plain(result.blocks), [{ type: 'image', mediaKey: 'capa.webp' }, { type: 'heading', level: 1, text: 'Guia' }, { type: 'paragraph', text: 'Conteúdo real.' }]);
});

test('mantém o comportamento legado quando não há marcador de revisão', () => {
  const normalize = loadHelper();
  const input = { title: 'Título legado', excerpt: 'Resumo legado', sources: [], blocks: [{ type: 'paragraph', text: 'Resumo legado' }] };
  const result = normalize(input);
  assert.equal(result.title, input.title); assert.equal(result.excerpt, input.excerpt); assert.deepEqual(plain(result.blocks), input.blocks);
});
