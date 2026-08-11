import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const codigo = new URL('../apps-script/Código.js', import.meta.url);

function load() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(codigo, 'utf8'), context, {
    filename: String(codigo)
  });
  return context;
}

function respostaBase(corpo) {
  return (
    'CLASSIFICAÇÃO: EVERGREEN\n' +
    'TÍTULO ANTERIOR:\nAntigo\n' +
    'TÍTULO REVISADO:\nNovo\n' +
    '=== CONTEÚDO PARA PUBLICAÇÃO ===\n' +
    corpo +
    '\n'.repeat(1) +
    'x'.repeat(500)
  );
}

test('remove travessão " — " do conteúdo revisado', () => {
  const api = load();

  const resultado = api.limparRespostaClaude_(
    respostaBase('O produto é resistente — e também leve — para o dia a dia.')
  );

  assert.doesNotMatch(resultado, /—/);
  assert.match(resultado, /resistente e também leve para o dia a dia\./);
});

test('não deixa espaços duplos depois de remover o travessão', () => {
  const api = load();

  const resultado = api.limparRespostaClaude_(
    respostaBase('Frase um — frase dois.')
  );

  assert.doesNotMatch(resultado, /  /);
});
