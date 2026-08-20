import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
  planoSeo: new URL('../apps-script/PlanoSeo.js', import.meta.url),
  clusterSeo: new URL('../apps-script/ClusterSeo.js', import.meta.url)
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

function paginaValida(overrides = {}) {
  return {
    type: 'Satélite',
    title: 'Melhor sanduicheira 2026',
    slug: 'melhor-sanduicheira',
    primary_keyword: 'melhor sanduicheira',
    intent: 'comercial',
    category: 'Casa e cozinha',
    funnel_stage: 'meio',
    objective: 'ajudar a escolher',
    keyword_map: { secondary: ['sanduicheira boa'], questions: ['qual a melhor?'] },
    ...overrides
  };
}

function clusterValido(overrides = {}) {
  return {
    seed_keyword: 'sanduicheira',
    language: 'pt-BR',
    country: 'BR',
    pillar: paginaValida({ type: 'Pilar', title: 'Sanduicheira: guia completo', slug: 'sanduicheira' }),
    satellites: [
      paginaValida({ slug: 'melhor-sanduicheira-eletrica', title: 'Melhor sanduicheira elétrica' }),
      paginaValida({ slug: 'melhor-sanduicheira-antiaderente', title: 'Melhor sanduicheira antiaderente' }),
      paginaValida({ slug: 'melhor-sanduicheira-inox', title: 'Melhor sanduicheira inox' })
    ],
    serp_analysis: { formats: ['lista'], patterns: [], content_gaps: [], competitor_urls: [] },
    internal_linking: ['pilar linka para satélites'],
    differentiation: [],
    sources: ['https://exemplo.com'],
    risks: [],
    human_review: [],
    ...overrides
  };
}

test('validarClusterSeo_ aceita um cluster válido', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  assert.doesNotThrow(() => api.validarClusterSeo_(clusterValido()));
});

test('validarClusterSeo_ rejeita menos de 3 satélites', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  const cluster = clusterValido({ satellites: [paginaValida()] });
  assert.throws(() => api.validarClusterSeo_(cluster), /entre 3 e 25 páginas/);
});

test('validarClusterSeo_ rejeita slug duplicado entre satélites', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  const cluster = clusterValido();
  cluster.satellites[1].slug = cluster.satellites[0].slug;
  assert.throws(() => api.validarClusterSeo_(cluster), /slug duplicado/);
});

test('validarClusterSeo_ rejeita satélite com slug igual ao do pilar', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  const cluster = clusterValido();
  cluster.satellites[0].slug = cluster.pillar.slug;
  assert.throws(() => api.validarClusterSeo_(cluster), /slug duplicado/);
});

test('validarClusterSeo_ rejeita type inválido no pilar', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  const cluster = clusterValido();
  cluster.pillar.type = 'Satélite';
  assert.throws(() => api.validarClusterSeo_(cluster), /pillar\.type precisa ser um de: Pilar/);
});

test('validarClusterSeo_ rejeita type inválido num satélite', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);
  const cluster = clusterValido();
  cluster.satellites[0].type = 'Pilar';
  assert.throws(() => api.validarClusterSeo_(cluster), /satellites\[0\]\.type precisa ser um de/);
});

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
    getUrl: () => 'https://docs.google.com/document/d/cluster123/edit',
    getId: () => 'cluster123',
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
        getFoldersByName: () => ({ hasNext: () => true, next: () => ({}) })
      }),
      getFileById: () => ({ moveTo: () => {} })
    }
  };
}

test('criarDocumentoCluster_ grava pilar e satélites no Doc', () => {
  const { DocumentApp, paragrafos } = fakeDocumentApp();
  const { DriveApp } = fakeDriveEFolder();

  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo], { DocumentApp, DriveApp });
  api.criarDocumentoCluster_('sanduicheira', clusterValido());

  const textos = paragrafos.map(p => p.texto).join(' | ');
  assert.match(textos, /Sanduicheira: guia completo/);
  assert.match(textos, /Melhor sanduicheira elétrica/);
  assert.match(textos, /Páginas satélites \(3\)/);
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

test('gravarClusterLinha_ limpa Aprovado por/em quando um cluster Aprovado é regenerado', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo], utilitiesFake);

  const aba = abaFake({
    'Link do cluster SEO': '',
    'Status do cluster': 'Aprovado',
    'Dados do cluster (JSON)': '',
    'Aprovado por': 'olavo@example.com',
    'Aprovado em': '17/08/2026 10:00',
    'Hash do cluster': 'hash-antigo'
  });

  const colunas = api.obterColunas_(aba);
  const documento = { getUrl: () => 'https://docs.google.com/document/d/novo/edit' };

  api.gravarClusterLinha_(aba, 2, colunas, clusterValido(), documento);

  assert.equal(aba._valores['Status do cluster'], 'Cluster gerado');
  assert.equal(aba._valores['Aprovado por'], '');
  assert.equal(aba._valores['Aprovado em'], '');
  assert.notEqual(aba._valores['Hash do cluster'], 'hash-antigo');
});

test('gerarClusterSeoLinha_ exige palavra-chave semente e link da pesquisa', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo]);

  const aba = abaFake({
    'Palavra-chave semente': '',
    'Link da pesquisa': ''
  });

  assert.throws(
    () => api.gerarClusterSeoLinha_(aba, 2),
    /Palavra-chave semente/
  );
});

// --- aba "Pauta editorial" que cresce de verdade, para testar a criação
// em massa de linhas a partir do cluster aprovado.
function abaPautaFake(headers, linhasExistentes = []) {
  const linhas = [headers.slice(), ...linhasExistentes.map(l => l.slice())];

  return {
    getLastRow: () => linhas.length,
    getLastColumn: () => headers.length,
    getRange(row, col, numRows, numCols) {
      if (numRows !== undefined) {
        return {
          getDisplayValues: () => {
            const out = [];
            for (let r = row - 1; r < row - 1 + numRows; r++) {
              out.push((linhas[r] || []).slice(col - 1, col - 1 + numCols));
            }
            return out;
          },
          setValues: (valores) => {
            valores.forEach((linhaValores, i) => {
              const idx = row - 1 + i;
              linhas[idx] = linhas[idx] ? linhas[idx].slice() : [];
              linhaValores.forEach((v, j) => { linhas[idx][col - 1 + j] = v; });
            });
          }
        };
      }
      return {
        getDisplayValue: () => String((linhas[row - 1] || [])[col - 1] ?? ''),
        setValue: (v) => { linhas[row - 1] = linhas[row - 1] || []; linhas[row - 1][col - 1] = v; }
      };
    },
    _linhas: linhas
  };
}

const TOPC_HEADERS_PAUTA = [
  'ID', 'Título', 'Tipo', 'Pilar relacionado', 'Palavra-chave principal',
  'Intenção', 'Categoria', 'Status', 'Slug', 'Link da pesquisa',
  'Link do artigo', 'Link da revisão', 'Link final', 'Status das imagens',
  'Observações', 'Versão no site'
];

function contextoClusterAprovado(overridesCluster = {}) {
  const cluster = clusterValido(overridesCluster);

  const abaCluster = abaFake({
    'Palavra-chave semente': cluster.seed_keyword,
    'Status do cluster': 'Aprovado',
    'Dados do cluster (JSON)': JSON.stringify(cluster),
    'Pautas criadas': '',
    'Observações': ''
  });

  return { cluster, abaCluster };
}

test('criarPautasDoClusterLinha_ exige status Aprovado', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo], { Utilities: { getUuid: () => 'uuid', formatDate: () => 'data' }, Session: { getScriptTimeZone: () => 'America/Sao_Paulo' } });

  const abaCluster = abaFake({
    'Palavra-chave semente': 'sanduicheira',
    'Status do cluster': 'Cluster gerado',
    'Dados do cluster (JSON)': JSON.stringify(clusterValido())
  });

  assert.throws(
    () => api.criarPautasDoClusterLinha_(abaCluster, 2),
    /não "Aprovado"/
  );
});

test('criarPautasDoClusterLinha_ cria uma linha por página (pilar + satélites)', () => {
  let uuidSeq = 0;
  const { cluster, abaCluster } = contextoClusterAprovado();
  const abaPauta = abaPautaFake(TOPC_HEADERS_PAUTA);

  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo], {
    Utilities: { getUuid: () => 'uuid-' + (uuidSeq++), formatDate: () => '20/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => abaPauta }) }
  });

  const resultado = api.criarPautasDoClusterLinha_(abaCluster, 2);

  assert.equal(resultado.criadas, 4);
  assert.equal(resultado.jaExistiam, 0);
  assert.equal(abaPauta._linhas.length, 5); // header + 4 páginas

  const idxTitulo = TOPC_HEADERS_PAUTA.indexOf('Título');
  const idxTipo = TOPC_HEADERS_PAUTA.indexOf('Tipo');
  const idxPilar = TOPC_HEADERS_PAUTA.indexOf('Pilar relacionado');

  const linhaPilar = abaPauta._linhas.find(l => l[idxTipo] === 'Pilar');
  const linhaSatelite = abaPauta._linhas.find(l => l[idxTipo] === 'Satélite');

  assert.equal(linhaPilar[idxTitulo], cluster.pillar.title);
  assert.equal(linhaPilar[idxPilar], '');
  assert.equal(linhaSatelite[idxPilar], cluster.pillar.title);

  assert.equal(abaCluster._valores['Status do cluster'], 'Pautas criadas');
  assert.equal(abaCluster._valores['Pautas criadas'], 4);
});

test('criarPautasDoClusterLinha_ pula páginas cujo slug já existe em Pauta editorial', () => {
  const { cluster, abaCluster } = contextoClusterAprovado();

  const linhaExistente = TOPC_HEADERS_PAUTA.map(h => h === 'Slug' ? cluster.pillar.slug : '');
  const abaPauta = abaPautaFake(TOPC_HEADERS_PAUTA, [linhaExistente]);

  const api = load([scripts.codigo, scripts.planoSeo, scripts.clusterSeo], {
    Utilities: { getUuid: () => 'uuid', formatDate: () => '20/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => abaPauta }) }
  });

  const resultado = api.criarPautasDoClusterLinha_(abaCluster, 2);

  assert.equal(resultado.criadas, 3);
  assert.equal(resultado.jaExistiam, 1);
});
