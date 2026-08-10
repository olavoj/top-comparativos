import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const limitesPath = new URL('../apps-script/LimitesDoArtigo.js', import.meta.url);
const insertPath = new URL('../apps-script/ImageInsert.js', import.meta.url);

function load(paths, extras = {}) {
  const context = vm.createContext({ ...extras });

  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }

  return context;
}

// Estrutura típica do documento "Final — ...": cabeçalho da revisão com
// PENDÊNCIAS repetindo os marcadores, artigo, fontes.
const documentoTipico = [
  { texto: 'Revisão editorial', ehH1: false },
  { texto: 'CLASSIFICAÇÃO: EVERGREEN', ehH1: false },
  { texto: 'PENDÊNCIAS:', ehH1: false },
  { texto: '[IMAGEM: sanduicheira-limpa.webp]', ehH1: false },
  { texto: '=== CONTEÚDO PARA PUBLICAÇÃO ===', ehH1: false },
  { texto: 'TÍTULO SEO:', ehH1: false },
  { texto: 'Como limpar uma sanduicheira', ehH1: false },
  { texto: 'Como limpar uma sanduicheira', ehH1: true },
  { texto: 'Introdução do artigo.', ehH1: false },
  { texto: '[IMAGEM: sanduicheira-limpa.webp]', ehH1: false },
  { texto: 'FONTES PARA REVISÃO:', ehH1: false },
  { texto: 'https://exemplo.com.br', ehH1: false }
];

test('o início do artigo fica depois do marcador de publicação', () => {
  const api = load([limitesPath]);

  assert.equal(api.topcIndiceInicioDoArtigo_(documentoTipico), 5);
  assert.equal(api.topcIndiceDoH1_(documentoTipico), 7);
});

test('sem marcador de publicação, o início é o H1', () => {
  const api = load([limitesPath]);
  const semMarcador = documentoTipico.filter(p => !p.texto.startsWith('==='));

  assert.equal(api.topcIndiceInicioDoArtigo_(semMarcador), 6);
});

test('documento sem cabeçalho de revisão começa no zero', () => {
  const api = load([limitesPath]);

  assert.equal(
    api.topcIndiceInicioDoArtigo_([{ texto: 'Só um parágrafo', ehH1: false }]),
    0
  );
});

test('o fim do artigo é a primeira linha de fontes ou aviso', () => {
  const api = load([limitesPath]);

  assert.equal(api.topcIndiceFimDoArtigo_(documentoTipico), 10);
  assert.equal(
    api.topcIndiceFimDoArtigo_([
      { texto: 'Conteúdo', ehH1: false },
      { texto: 'AVISO EDITORIAL:', ehH1: false }
    ]),
    1
  );
  assert.equal(api.topcIndiceFimDoArtigo_([{ texto: 'Conteúdo' }]), -1);
});

// Corpo falso: cada ocorrência do marcador vive num parágrafo cujo pai
// é o corpo, como no Google Docs.
function localizar(indices, indiceInicio) {
  const api = load([limitesPath, insertPath], {
    DocumentApp: { ElementType: { BODY_SECTION: 'BODY_SECTION' } }
  });

  const corpo = {
    getType: () => 'BODY_SECTION',
    getChildIndex: elemento => elemento.indice
  };

  const resultados = indices.map(indice => {
    const paragrafo = {
      indice,
      getType: () => 'PARAGRAPH',
      getParent: () => corpo
    };

    return {
      indice,
      getElement: () => ({ getParent: () => paragrafo })
    };
  });

  corpo.findText = (_padrao, apartirDe) => {
    if (!apartirDe) return resultados[0] || null;
    return resultados[resultados.indexOf(apartirDe) + 1] || null;
  };

  const encontrado = api.topcLocalizarMarcadorNoArtigo_(
    corpo,
    '[IMAGEM: x.webp]',
    indiceInicio
  );

  return encontrado ? encontrado.indice : null;
}

test('ignora a ocorrência do cabeçalho e usa a do corpo do artigo', () => {
  assert.equal(localizar([3, 9], 5), 9);
});

test('usa a primeira ocorrência quando ela já está no artigo', () => {
  assert.equal(localizar([9, 14], 5), 9);
});

test('sem ocorrência no artigo, cai na primeira encontrada', () => {
  assert.equal(localizar([3], 5), 3);
});
