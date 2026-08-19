import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
  planoSeo: new URL('../apps-script/PlanoSeo.js', import.meta.url),
  slugAuto: new URL('../apps-script/SlugAuto.js', import.meta.url)
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

const pautaBase = {
  titulo: 'Melhor sanduicheira 2026',
  tipo: 'Comparativo',
  palavraChave: 'sanduicheira',
  intencao: 'Comercial',
  categoria: 'Casa e cozinha',
  slug: 'melhor-sanduicheira',
  pilar: ''
};

test('montarPromptArtigo_ sem plano usa a pesquisa como fonte principal, igual antes', () => {
  const api = load([scripts.codigo]);

  const prompt = api.montarPromptArtigo_(pautaBase, 'texto da pesquisa');

  assert.match(prompt, /Use a pesquisa abaixo como fonte principal do artigo\./);
  assert.doesNotMatch(prompt, /PLANO SEO APROVADO/);
  assert.match(prompt, /texto da pesquisa/);
});

test('montarPromptArtigo_ com plano instrui a usá-lo como fonte principal e a pesquisa como apoio', () => {
  const api = load([scripts.codigo]);

  const prompt = api.montarPromptArtigo_(pautaBase, 'texto da pesquisa', 'texto do plano SEO');

  assert.match(prompt, /PLANO SEO APROVADO \(fonte principal/);
  assert.match(prompt, /texto do plano SEO/);
  assert.match(prompt, /Use o plano SEO acima como fonte principal do artigo\./);
  assert.match(prompt, /use a pesquisa abaixo só como apoio factual/);
  // A pesquisa continua presente, só não é mais a fonte primária.
  assert.match(prompt, /texto da pesquisa/);
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
    getName: () => 'Pauta editorial',
    _valores: valores
  };
}

function baseColunas(overrides = {}) {
  return {
    'ID': '1',
    'Título': 'Melhor sanduicheira 2026',
    'Tipo': 'Comparativo',
    'Pilar relacionado': '',
    'Palavra-chave principal': 'sanduicheira',
    'Intenção': 'Comercial',
    'Categoria': 'Casa e cozinha',
    'Status': '',
    'Slug': 'melhor-sanduicheira',
    'Link da pesquisa': 'https://docs.google.com/document/d/pesquisa123/edit',
    'Link do artigo': '',
    'Observações': '',
    'Link do plano SEO': '',
    'Status do plano': '',
    ...overrides
  };
}

test('gerarArtigoLinha_ para com erro quando existe plano SEO não aprovado', () => {
  const api = load([scripts.codigo, scripts.planoSeo, scripts.slugAuto]);

  const aba = abaFake(baseColunas({
    'Link do plano SEO': 'https://docs.google.com/document/d/plano123/edit',
    'Status do plano': 'Plano gerado'
  }));

  assert.throws(
    () => api.gerarArtigoLinha_(aba, 2),
    /plano SEO.*Plano gerado.*não.*Aprovado/s
  );
});

test('gerarArtigoLinha_ segue o fluxo legado quando não existe plano (Link do plano SEO vazio)', () => {
  const chamadasClaude = [];

  const api = load([scripts.codigo, scripts.planoSeo, scripts.slugAuto], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ toast: () => {} }),
      flush: () => {}
    },
    LockService: {
      getDocumentLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
    },
    Utilities: { formatDate: () => '19/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    DocumentApp: {
      ParagraphHeading: { TITLE: 'TITLE', HEADING1: 'H1', HEADING2: 'H2', HEADING3: 'H3' },
      openById: (id) => ({
        getBody: () => ({ getText: () => 'x'.repeat(200) }),
        getUrl: () => 'https://docs.google.com/document/d/' + id + '/edit'
      }),
      create: () => ({
        getBody: () => ({
          appendParagraph: () => ({ setHeading: () => {}, setForegroundColor: () => {} }),
          appendHorizontalRule: () => {}
        }),
        saveAndClose: () => {},
        getId: () => 'novoDoc'
      })
    },
    DriveApp: {
      getFolderById: () => ({ getFoldersByName: () => ({ hasNext: () => true, next: () => ({}) }) }),
      getFileById: () => ({ moveTo: () => {} })
    }
  });

  api.lerDocumentoGoogle_ = (url) => 'conteudo-de:' + url;
  api.gerarArtigoNoClaude_ = (pauta, pesquisa, plano) => {
    chamadasClaude.push({ pesquisa, plano });
    return 'artigo gerado';
  };

  const aba = abaFake(baseColunas());

  api.gerarArtigoLinha_(aba, 2);

  assert.equal(chamadasClaude.length, 1);
  assert.equal(chamadasClaude[0].plano, '');
  assert.match(chamadasClaude[0].pesquisa, /^conteudo-de:/);
});

test('gerarArtigoLinha_ lê o Doc do plano aprovado e passa como fonte pro Claude', () => {
  const chamadasClaude = [];
  const lidos = [];

  const api = load([scripts.codigo, scripts.planoSeo, scripts.slugAuto], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ toast: () => {} }),
      flush: () => {}
    },
    LockService: {
      getDocumentLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
    },
    Utilities: { formatDate: () => '19/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    DocumentApp: {
      ParagraphHeading: { TITLE: 'TITLE', HEADING1: 'H1', HEADING2: 'H2', HEADING3: 'H3' },
      openById: (id) => ({
        getUrl: () => 'https://docs.google.com/document/d/' + id + '/edit'
      }),
      create: () => ({
        getBody: () => ({
          appendParagraph: () => ({ setHeading: () => {}, setForegroundColor: () => {} }),
          appendHorizontalRule: () => {}
        }),
        saveAndClose: () => {},
        getId: () => 'novoDoc'
      })
    },
    DriveApp: {
      getFolderById: () => ({ getFoldersByName: () => ({ hasNext: () => true, next: () => ({}) }) }),
      getFileById: () => ({ moveTo: () => {} })
    }
  });

  api.lerDocumentoGoogle_ = (url) => {
    lidos.push(url);
    return 'conteudo-de:' + url;
  };
  api.gerarArtigoNoClaude_ = (pauta, pesquisa, plano) => {
    chamadasClaude.push({ pesquisa, plano });
    return 'artigo gerado';
  };

  const aba = abaFake(baseColunas({
    'Link do plano SEO': 'https://docs.google.com/document/d/plano123/edit',
    'Status do plano': 'Aprovado'
  }));

  api.gerarArtigoLinha_(aba, 2);

  assert.equal(chamadasClaude.length, 1);
  assert.match(chamadasClaude[0].plano, /^conteudo-de:.*plano123/);
  assert.match(chamadasClaude[0].pesquisa, /^conteudo-de:.*pesquisa123/);
  assert.deepEqual(
    lidos.sort(),
    [
      'https://docs.google.com/document/d/pesquisa123/edit',
      'https://docs.google.com/document/d/plano123/edit'
    ].sort()
  );
});
