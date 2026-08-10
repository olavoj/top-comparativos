import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/MediaQueue.js', import.meta.url);

function load(rows) {
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getDisplayValues: () => rows }) }) }) },
    DriveApp: { getFileById: id => ({ getBlob: () => ({ getContentType: () => 'image/jpeg' }) }) },
    topcNormalizarMediaKeyPorMime_: key => key.replace(/\.webp$/i, '.jpg'),
    topcAltImagem_: key => key,
  });
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: String(path) });
  return context.topcObterMidiasConcluidas_;
}

const headers = ['Slug', 'Linha pauta', 'Nome arquivo', 'Tipo imagem', 'Status', 'Arquivo ID'];

function media(nome, tipo = 'Interna') {
  const fn = load([headers, ['artigo', '3', nome, tipo, 'Concluída', 'drive-1']]);
  return JSON.parse(JSON.stringify(fn(3, 'artigo')[0]));
}

test('Tipo imagem Capa continua gerando cover', () => {
  assert.equal(media('capa-artigo.webp', 'Capa').role, 'cover');
});

test('imagem-principal marcada como Interna usa fallback cover', () => {
  const result = media('imagem-principal-artigo.webp', 'Interna');
  assert.equal(result.role, 'cover');
  assert.equal(result.position, 0);
});

test('imagem interna comum continua inline', () => {
  const result = media('detalhe-artigo.webp', 'Interna');
  assert.equal(result.role, 'inline');
  assert.equal(result.position, 0);
});
