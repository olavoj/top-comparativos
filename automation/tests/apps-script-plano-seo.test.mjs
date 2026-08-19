import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
  analiseSeo: new URL('../apps-script/AnaliseSeo.js', import.meta.url),
  planoSeo: new URL('../apps-script/PlanoSeo.js', import.meta.url)
};

function load(paths, extras = {}) {
  const context = vm.createContext({ ...extras });

  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }

  return context;
}

function planoValido(overrides = {}) {
  return {
    keyword: 'sanduicheira',
    language: 'pt-BR',
    country: 'BR',
    intent: {
      primary: 'comercial',
      secondary: ['informacional'],
      confidence: 'alta',
      evidence: ['fonte a']
    },
    recommended_page: {
      type: 'comparativo',
      title: 'Melhores sanduicheiras',
      slug: 'melhores-sanduicheiras',
      funnel_stage: 'decisão',
      objective: 'ajudar a escolher'
    },
    keyword_map: {
      primary: ['sanduicheira'],
      secondary: [],
      questions: ['qual a melhor'],
      entities: []
    },
    serp_analysis: {
      formats: ['lista'],
      patterns: [],
      content_gaps: [],
      competitor_urls: []
    },
    outline: [
      { level: 'H2', heading: 'Como escolher', purpose: 'orientar', questions_answered: [], evidence_required: [] }
    ],
    differentiation: [],
    internal_links: [],
    conversion_elements: [],
    structured_data: [],
    sources: ['https://exemplo.com'],
    risks: [],
    human_review: [],
    ...overrides
  };
}

// --- Doc: docBuilder cresce à medida que appendParagraph/appendListItem
// são chamados, para inspecionar o conteúdo gerado sem abrir um Doc real.
function fakeDocumentApp() {
  const paragrafos = [];

  function corpo() {
    const api = {
      appendParagraph: (texto) => {
        const p = { texto, heading: null, setHeading: (h) => { p.heading = h; return p; } };
        paragrafos.push(p);
        return p;
      },
      appendListItem: (texto) => {
        paragrafos.push({ texto, item: true });
        return {};
      },
      appendHorizontalRule: () => {}
    };
    return api;
  }

  const documento = {
    getBody: () => corpo(),
    getUrl: () => 'https://docs.google.com/document/d/plano123/edit',
    getId: () => 'plano123',
    saveAndClose: () => {}
  };

  return {
    DocumentApp: {
      create: () => documento,
      openById: () => documento,
      ParagraphHeading: { TITLE: 'TITLE', HEADING1: 'H1', HEADING2: 'H2', HEADING3: 'H3' }
    },
    paragrafos
  };
}

function fakeDriveEFolder() {
  return {
    DriveApp: {
      getFolderById: () => ({
        getFoldersByName: () => ({
          hasNext: () => true,
          next: () => ({})
        })
      }),
      getFileById: () => ({ moveTo: () => {} })
    }
  };
}

test('criarDocumentoPlano_ grava as seções principais do plano no Doc', () => {
  const { DocumentApp, paragrafos } = fakeDocumentApp();
  const { DriveApp } = fakeDriveEFolder();

  const api = load([scripts.codigo, scripts.planoSeo], { DocumentApp, DriveApp });

  const pauta = { titulo: 'Melhor sanduicheira 2026' };
  api.criarDocumentoPlano_(pauta, planoValido());

  const textos = paragrafos.map(p => p.texto).join(' | ');
  assert.match(textos, /Palavra-chave: sanduicheira/);
  assert.match(textos, /Principal: comercial/);
  assert.match(textos, /Como escolher/);
  assert.match(textos, /Objetivo: orientar/);
});

test('criarDocumentoPlano_ não grava seções de listas vazias', () => {
  const { DocumentApp, paragrafos } = fakeDocumentApp();
  const { DriveApp } = fakeDriveEFolder();

  const api = load([scripts.codigo, scripts.planoSeo], { DocumentApp, DriveApp });

  api.criarDocumentoPlano_({ titulo: 'X' }, planoValido({ differentiation: [] }));

  const textos = paragrafos.map(p => p.texto);
  assert.ok(!textos.includes('Diferenciais:'));
});

function abaFake(valoresIniciais) {
  const cabecalhos = Object.keys(valoresIniciais);
  const valores = { ...valoresIniciais };

  return {
    getLastColumn: () => cabecalhos.length,
    getRange: (linha, coluna, numLinhas, numColunas) => {
      if (numColunas !== undefined) {
        return { getDisplayValues: () => [cabecalhos] };
      }
      const nomeColuna = cabecalhos[coluna - 1];
      return {
        getDisplayValue: () => String(valores[nomeColuna] ?? ''),
        setValue: (v) => { valores[nomeColuna] = v; }
      };
    },
    _valores: valores
  };
}

const utilitiesFake = {
  Utilities: {
    computeDigest: (algoritmo, texto) => Array.from(texto).map(c => c.charCodeAt(0) % 256),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  }
};

test('gravarPlanoLinha_ limpa Aprovado por/em quando um plano Aprovado é regenerado', () => {
  const api = load([scripts.codigo, scripts.planoSeo], utilitiesFake);

  const aba = abaFake({
    'Link do plano SEO': '',
    'Status do plano': 'Aprovado',
    'Aprovado por': 'olavo@example.com',
    'Aprovado em': '17/08/2026 10:00',
    'Hash do plano': 'hash-antigo'
  });

  const colunas = api.obterColunas_(aba);
  const documento = { getUrl: () => 'https://docs.google.com/document/d/novo/edit' };

  api.gravarPlanoLinha_(aba, 2, colunas, planoValido(), documento);

  assert.equal(aba._valores['Status do plano'], 'Plano gerado');
  assert.equal(aba._valores['Aprovado por'], '');
  assert.equal(aba._valores['Aprovado em'], '');
  assert.equal(aba._valores['Link do plano SEO'], 'https://docs.google.com/document/d/novo/edit');
  assert.notEqual(aba._valores['Hash do plano'], 'hash-antigo');
});

test('gravarPlanoLinha_ não mexe em Aprovado por/em quando não havia aprovação anterior', () => {
  const api = load([scripts.codigo, scripts.planoSeo], utilitiesFake);

  const aba = abaFake({
    'Link do plano SEO': '',
    'Status do plano': '',
    'Aprovado por': '',
    'Aprovado em': '',
    'Hash do plano': ''
  });

  const colunas = api.obterColunas_(aba);
  const documento = { getUrl: () => 'https://docs.google.com/document/d/novo/edit' };

  api.gravarPlanoLinha_(aba, 2, colunas, planoValido(), documento);

  assert.equal(aba._valores['Status do plano'], 'Plano gerado');
  assert.equal(aba._valores['Aprovado por'], '');
});

test('topcObterStatusPlanoLinha_ reporta ausência de plano quando a coluna não existe', () => {
  const api = load([scripts.codigo, scripts.planoSeo]);
  const aba = abaFake({ Título: 'x' });

  const resultado = api.topcObterStatusPlanoLinha_(aba, 2);

  assert.equal(resultado.existe, false);
  assert.equal(resultado.aprovado, false);
});

test('topcObterStatusPlanoLinha_ só considera aprovado com status exato "Aprovado"', () => {
  const api = load([scripts.codigo, scripts.planoSeo]);

  const abaPendente = abaFake({ 'Link do plano SEO': 'https://x', 'Status do plano': 'Plano gerado' });
  const abaAprovada = abaFake({ 'Link do plano SEO': 'https://x', 'Status do plano': 'Aprovado' });

  assert.equal(api.topcObterStatusPlanoLinha_(abaPendente, 2).aprovado, false);
  assert.equal(api.topcObterStatusPlanoLinha_(abaAprovada, 2).aprovado, true);
});

// Aba que cresce de verdade quando uma coluna nova é adicionada, ao
// contrário de abaFake (que tem cabeçalhos fixos) — precisa disso pra
// testar topcGarantirColuna_ de forma realista.
function abaCrescivel(headers) {
  const linhas = { 1: headers.slice() };

  return {
    getLastColumn: () => linhas[1].length,
    getRange(row, col, numRows, numCols) {
      if (numRows === undefined) {
        return {
          getDisplayValue: () => String((linhas[row] || [])[col - 1] ?? ''),
          setValue: (v) => {
            linhas[row] = linhas[row] || [];
            linhas[row][col - 1] = v;
          }
        };
      }
      return {
        getDisplayValues: () => [(linhas[row] || []).slice(col - 1, col - 1 + numCols)]
      };
    },
    _linhas: linhas
  };
}

test('topcGarantirColuna_ cria a coluna no fim quando ela não existe', () => {
  const api = load([scripts.codigo, scripts.planoSeo]);
  const aba = abaCrescivel(['Título', 'Status']);

  const indice = api.topcGarantirColuna_(aba, 'Link do plano SEO');

  assert.equal(indice, 3);
  assert.equal(aba._linhas[1][2], 'Link do plano SEO');
});

test('topcGarantirColuna_ reaproveita a coluna quando ela já existe, sem duplicar', () => {
  const api = load([scripts.codigo, scripts.planoSeo]);
  const aba = abaCrescivel(['Título', 'Status do plano', 'Observações']);

  const indice = api.topcGarantirColuna_(aba, 'Status do plano');

  assert.equal(indice, 2);
  assert.equal(aba.getLastColumn(), 3);
});

test('topcGarantirColunasPlanoSeo_ cria as cinco colunas do plano de uma vez', () => {
  const api = load([scripts.codigo, scripts.planoSeo]);
  const aba = abaCrescivel(['Título']);

  api.topcGarantirColunasPlanoSeo_(aba);

  assert.deepEqual(Array.from(aba._linhas[1]), [
    'Título',
    'Link do plano SEO',
    'Status do plano',
    'Aprovado por',
    'Aprovado em',
    'Hash do plano'
  ]);
});

test('analisarSeoLinha_ exige um link de pesquisa antes de chamar o Claude', () => {
  const api = load([scripts.codigo, scripts.analiseSeo, scripts.planoSeo]);

  const aba = abaFake({
    'Título': 'Melhor sanduicheira',
    'Tipo': 'Comparativo',
    'Palavra-chave principal': 'sanduicheira',
    'Intenção': 'Comercial',
    'Categoria': 'Casa e cozinha',
    'Status': '',
    'Link da pesquisa': '',
    'Link do plano SEO': '',
    'Status do plano': '',
    'Aprovado por': '',
    'Aprovado em': '',
    'Hash do plano': '',
    'Observações': ''
  });

  assert.throws(
    () => api.analisarSeoLinha_(aba, 2),
    /ainda não possui um link de pesquisa/
  );
});
