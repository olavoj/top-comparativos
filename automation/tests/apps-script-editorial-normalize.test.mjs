import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const helperPath = path.resolve('automation/apps-script/EditorialNormalize.js');
function loadHelper() { const context = vm.createContext({}); vm.runInContext(fs.readFileSync(helperPath, 'utf8'), context, { filename: helperPath }); return context.topcNormalizarRevisaoEditorial_; }
const plain = value => JSON.parse(JSON.stringify(value));

test('remove keywords multilinha quando H1 está disponível', () => {
  const normalize = loadHelper();
  const result = normalize({ title: 'Guia', excerpt: 'Revisão', sources: [], blocks: [
    { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
    { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' },
    { type: 'paragraph', text: 'sanduicheira elétrica' }, { type: 'paragraph', text: 'melhor sanduicheira' },
    { type: 'heading', level: 1, text: 'Guia completo' }, { type: 'paragraph', text: 'Conteúdo real.' },
  ]});
  assert.deepEqual(plain(result.blocks), [{ type: 'heading', level: 1, text: 'Guia completo' }, { type: 'paragraph', text: 'Conteúdo real.' }]);
});

test('nunca engole o artigo se H1 não estiver presente nos blocks', () => {
  const normalize = loadHelper();
  const result = normalize({ title: 'Guia completo para escolher uma sanduicheira elétrica', excerpt: 'Revisão editorial', sources: [], blocks: [
    { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
    { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' },
    { type: 'paragraph', text: 'sanduicheira elétrica' },
    { type: 'paragraph', text: 'melhor sanduicheira' },
    { type: 'paragraph', text: 'sanduicheira grill' },
    { type: 'paragraph', text: 'Escolher uma sanduicheira elétrica parece simples, mas alguns critérios fazem diferença.' },
    { type: 'heading', level: 2, text: 'O que considerar antes de comprar' },
    { type: 'paragraph', text: 'Potência, tamanho e facilidade de limpeza são critérios importantes.' },
  ]});
  const texts = result.blocks.map(b => b.text).filter(Boolean);
  assert.ok(texts.includes('Escolher uma sanduicheira elétrica parece simples, mas alguns critérios fazem diferença.'));
  assert.ok(texts.includes('O que considerar antes de comprar'));
  assert.ok(!texts.includes('sanduicheira elétrica'));
  assert.ok(!texts.includes('melhor sanduicheira'));
});

test('remove metadados de valor único e preserva conteúdo', () => {
  const normalize = loadHelper();
  const result = normalize({ title: 'Guia', excerpt: 'Revisão', sources: [], blocks: [
    { type: 'image', mediaKey: 'capa.webp' }, { type: 'paragraph', text: '=== CONTEÚDO PARA PUBLICAÇÃO ===' },
    { type: 'paragraph', text: 'META DESCRIPTION:' }, { type: 'paragraph', text: 'Descrição SEO' },
    { type: 'paragraph', text: 'PALAVRAS-CHAVE SECUNDÁRIAS:' }, { type: 'paragraph', text: 'keyword única' },
    { type: 'heading', level: 1, text: 'Guia' }, { type: 'paragraph', text: 'Conteúdo real.' },
  ]});
  assert.equal(result.seoDescription, 'Descrição SEO');
  assert.deepEqual(plain(result.blocks), [{ type: 'image', mediaKey: 'capa.webp' }, { type: 'heading', level: 1, text: 'Guia' }, { type: 'paragraph', text: 'Conteúdo real.' }]);
});

test('mantém comportamento legado sem marcador', () => {
  const normalize = loadHelper();
  const input = { title: 'Título legado', excerpt: 'Resumo legado', sources: [], blocks: [{ type: 'paragraph', text: 'Resumo legado' }] };
  const result = normalize(input);
  assert.equal(result.title, input.title); assert.deepEqual(plain(result.blocks), input.blocks);
});
