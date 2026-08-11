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

// O Claude às vezes ecoa o marcador de exemplo do prompt ("[IMAGEM: ...]")
// como texto literal em vez de indicar um nome de arquivo real. Isso não
// pode virar uma tarefa de fila, ou o envio ao site falha depois com
// "Nome de imagem inválido: ...".
test('ignora marcadores de imagem sem nome de arquivo válido', () => {
  const api = load();

  const encontrados = api.extrairMarcadoresImagens_(
    'Texto antes [IMAGEM: ...] no meio [IMAGEM: sanduicheira-limpa.webp] ' +
    'fim [IMAGEM: ] outro [IMAGEM: sem-extensao]'
  );

  // O array retornado pertence ao realm do vm; espalha antes de mapear
  // para comparar com um array comum sem cair no "not reference-equal"
  // do assert.deepEqual entre realms diferentes.
  assert.deepEqual(
    [...encontrados].map(item => item.nome),
    ['sanduicheira-limpa.webp']
  );
});

test('aceita nomes de arquivo válidos com hífen, underscore e ponto', () => {
  const api = load();

  assert.equal(api.topcNomeDeImagemValido_('imagem-principal_1.webp'), true);
  assert.equal(api.topcNomeDeImagemValido_('...'), false);
  assert.equal(api.topcNomeDeImagemValido_(''), false);
  assert.equal(api.topcNomeDeImagemValido_('sem-extensao'), false);
});
