import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../apps-script/Código.js', import.meta.url),
  'utf8'
);

function pesquisaSelecionadaSource() {
  const start = source.indexOf('function pesquisarPautaSelecionada()');
  const end = source.indexOf('\nfunction pesquisarNoPerplexity_', start);
  assert.notEqual(start, -1, 'função pesquisarPautaSelecionada não encontrada');
  assert.notEqual(end, -1, 'fim da função pesquisarPautaSelecionada não encontrado');
  return source.slice(start, end);
}

test('pesquisa usa a coluna Link da pesquisa em vez do cabeçalho legado', () => {
  const pesquisa = pesquisaSelecionadaSource();
  assert.match(pesquisa, /'Link da pesquisa'/);
  assert.doesNotMatch(pesquisa, /'Link do Google Docs'/);
});
