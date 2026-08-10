import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/Diagnostico.js', import.meta.url);

function load() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
    filename: String(path)
  });
  return context.topcResumirImagensDaPauta_;
}

const capa = { mediaKey: 'capa-artigo.jpg', role: 'cover' };
const inline1 = { mediaKey: 'limpeza-1.jpg', role: 'inline' };
const inline2 = { mediaKey: 'limpeza-2.jpg', role: 'inline' };

const noArtigo = indice => ({
  indice,
  alt: '',
  antesDoH1: false,
  depoisDasFontes: false
});

test('confirma quando tudo está referenciado', () => {
  const resumir = load();
  const resumo = resumir(
    [capa, inline1],
    ['capa-artigo.jpg', 'limpeza-1.jpg'],
    [noArtigo(8), noArtigo(12)]
  );

  assert.deepEqual(structuredClone(resumo.naoReferenciadas), []);
  assert.match(resumo.veredito, /todas as imagens/i);
});

test('aponta imagens fora do corpo do artigo', () => {
  const resumir = load();
  const resumo = resumir(
    [capa, inline1, inline2],
    ['capa-artigo.jpg'],
    [
      { indice: 4, alt: '', antesDoH1: true, depoisDasFontes: false },
      { indice: 28, alt: '', antesDoH1: true, depoisDasFontes: false },
      { indice: 30, alt: '', antesDoH1: true, depoisDasFontes: false }
    ]
  );

  assert.deepEqual(structuredClone(resumo.naoReferenciadas), [
    'limpeza-1.jpg',
    'limpeza-2.jpg'
  ]);
  assert.match(resumo.veredito, /fora do corpo do artigo/);
  assert.match(resumo.veredito, /3 imagem/);
});

test('aponta lote antigo quando faltam imagens no documento', () => {
  const resumir = load();
  const resumo = resumir(
    [capa, inline1, inline2],
    ['capa-artigo.jpg', 'limpeza-1.jpg'],
    [noArtigo(8), noArtigo(12)]
  );

  assert.match(resumo.veredito, /lote antigo/);
});

test('pede reenvio quando as imagens estão no artigo mas fora do envelope', () => {
  const resumir = load();
  const resumo = resumir(
    [capa, inline1],
    ['capa-artigo.jpg'],
    [noArtigo(8), noArtigo(12)]
  );

  assert.match(resumo.veredito, /Reenvie o rascunho/);
});
