import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/Código.js', import.meta.url);

function fakeIterator(itens) {
  let indice = 0;
  return {
    hasNext: () => indice < itens.length,
    next: () => itens[indice++]
  };
}

function fakeArquivo(nome) {
  return { getName: () => nome, getId: () => 'id-' + nome };
}

function driveFake(nomesNaPasta) {
  return {
    getFolderById: () => ({
      getFiles: () => fakeIterator(nomesNaPasta.map(fakeArquivo))
    })
  };
}

function carregar(nomesNaPasta) {
  const context = vm.createContext({ DriveApp: driveFake(nomesNaPasta) });
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: String(path) });
  return context;
}

test('localizarImagemManualNaPasta_ acha arquivo com mesmo nome base, extensão diferente', () => {
  const api = carregar(['capa-artigo.jpg']);
  const arquivo = api.localizarImagemManualNaPasta_('pasta-id', 'capa-artigo.webp');

  assert.ok(arquivo);
  assert.equal(arquivo.getId(), 'id-capa-artigo.jpg');
});

test('localizarImagemManualNaPasta_ ignora maiúsculas/minúsculas', () => {
  const api = carregar(['Capa-Artigo.PNG']);
  const arquivo = api.localizarImagemManualNaPasta_('pasta-id', 'capa-artigo.webp');

  assert.ok(arquivo);
});

test('localizarImagemManualNaPasta_ retorna null quando não há arquivo correspondente', () => {
  const api = carregar(['editorial-1-artigo.webp']);
  const arquivo = api.localizarImagemManualNaPasta_('pasta-id', 'capa-artigo.webp');

  assert.equal(arquivo, null);
});

test('localizarImagemManualNaPasta_ não casa nomes parecidos mas diferentes', () => {
  const api = carregar(['editorial-10-artigo.webp']);
  const arquivo = api.localizarImagemManualNaPasta_('pasta-id', 'editorial-1-artigo.webp');

  assert.equal(arquivo, null);
});
