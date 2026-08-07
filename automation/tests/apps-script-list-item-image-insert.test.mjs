import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = new URL('../apps-script/ZZImageInsertFix.js', import.meta.url);

function source() {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

test('inserção de imagem aceita PARAGRAPH e LIST_ITEM sem conversão forçada', () => {
  const codigo = source();
  assert.match(codigo, /ElementType\.PARAGRAPH/);
  assert.match(codigo, /ElementType\.LIST_ITEM/);
  assert.doesNotMatch(codigo, /getParent\(\)\.asParagraph\(\)/);
});

test('reparo reabre falhas causadas por LIST_ITEM para nova tentativa', () => {
  const codigo = source();
  assert.match(codigo, /LIST_ITEM/);
  assert.match(codigo, /setValue\('Pendente'\)/);
  assert.match(codigo, /setValue\(0\)/);
});
