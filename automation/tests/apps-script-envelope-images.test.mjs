import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/EnvelopeImages.js', import.meta.url);

function load() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
    filename: String(path)
  });
  return context.topcPlanejarImagensDocumento_;
}

const capa = {
  mediaKey: 'imagem-principal-artigo.jpg',
  role: 'cover',
  alt: 'Imagem principal artigo'
};

const internas = [
  { mediaKey: 'editorial-1-artigo.jpg', role: 'inline', alt: 'Editorial 1' },
  { mediaKey: 'editorial-2-artigo.jpg', role: 'inline', alt: 'Editorial 2' },
  { mediaKey: 'editorial-3-artigo.jpg', role: 'inline', alt: 'Editorial 3' }
];

const midias = [capa, ...internas];
const chaves = plano => plano.atribuicoes.map(m => (m ? m.mediaKey : null));

test('liga cada imagem à mídia gravada no título alternativo', () => {
  const planejar = load();

  const plano = planejar(
    [
      'editorial-2-artigo.webp',
      'imagem-principal-artigo.webp',
      'editorial-1-artigo.webp',
      'editorial-3-artigo.webp'
    ],
    midias
  );

  assert.deepEqual(chaves(plano), [
    'editorial-2-artigo.jpg',
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);

  assert.equal(plano.capaRestante, null);
});

test('documento antigo sem alt: a primeira imagem é a capa e nada é perdido', () => {
  const planejar = load();
  const plano = planejar(['', '', '', ''], midias);

  assert.deepEqual(chaves(plano), [
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);

  assert.equal(plano.capaRestante, null);
});

test('capa ausente do corpo é devolvida para entrar depois do H1', () => {
  const planejar = load();
  const plano = planejar(['', '', ''], midias);

  assert.deepEqual(chaves(plano), [
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg',
    'editorial-3-artigo.jpg'
  ]);

  assert.equal(plano.capaRestante.mediaKey, 'imagem-principal-artigo.jpg');
});

test('imagem do documento sem mídia correspondente é descartada', () => {
  const planejar = load();
  const plano = planejar(['', '', '', '', ''], [capa, internas[0]]);

  assert.deepEqual(chaves(plano), [
    'imagem-principal-artigo.jpg',
    'editorial-1-artigo.jpg',
    null,
    null,
    null
  ]);
});

test('a mesma mídia nunca é usada duas vezes', () => {
  const planejar = load();

  const plano = planejar(
    ['editorial-1-artigo.webp', 'editorial-1-artigo.webp'],
    [internas[0], internas[1]]
  );

  assert.deepEqual(chaves(plano), [
    'editorial-1-artigo.jpg',
    'editorial-2-artigo.jpg'
  ]);
});

test('pauta sem imagens concluídas não gera atribuição nem capa', () => {
  const planejar = load();
  const plano = planejar(['', ''], []);

  assert.deepEqual(chaves(plano), [null, null]);
  assert.equal(plano.capaRestante, null);
});
