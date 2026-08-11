import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const codigoPath = new URL('../apps-script/Código.js', import.meta.url);
const validacaoPath = new URL(
  '../apps-script/ValidacaoCluster.js',
  import.meta.url
);

function load(paths, extras = {}) {
  const context = vm.createContext({ ...extras });

  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }

  return context;
}

// topcSlugificar_ vive em Código.js. ValidacaoCluster.js é carregado
// sozinho aqui (sem Código.js), então extraímos a função real de lá e a
// injetamos no contexto, do mesmo jeito que o escopo global do Apps
// Script faria em produção.
function obterTopcSlugificar_() {
  return load([codigoPath]).topcSlugificar_;
}

function carregarApi() {
  return load([validacaoPath], { topcSlugificar_: obterTopcSlugificar_() });
}

const HEADERS = ['Título', 'Tipo', 'Status', 'Slug'];

function abaDouble(linhas) {
  return {
    getLastRow: () => linhas.length + 1,
    getLastColumn: () => HEADERS.length,
    getRange(linha, coluna, numLinhas) {
      return {
        getDisplayValues: () => {
          if (linha === 1) return [HEADERS];
          return linhas.slice(linha - 2, linha - 2 + numLinhas);
        }
      };
    }
  };
}

test('topcValidarPilarDaPauta_ rejeita satélite cujo pilar não existe na aba', () => {
  const api = carregarApi();
  const aba = abaDouble([]);

  const pauta = {
    tipo: 'Comparativo',
    pilar: 'Guia de Sanduicheiras'
  };

  assert.throws(
    () => api.topcValidarPilarDaPauta_(aba, pauta),
    /O pilar "Guia de Sanduicheiras" não existe na aba Pauta editorial/
  );
});

test('topcValidarPilarDaPauta_ rejeita quando o pilar referenciado tem Tipo errado', () => {
  const api = carregarApi();
  const aba = abaDouble([
    ['Guia de Sanduicheiras', 'Comparativo', 'Publicado', 'guia-de-sanduicheiras']
  ]);

  const pauta = {
    tipo: 'Review',
    pilar: 'Guia de Sanduicheiras'
  };

  assert.throws(
    () => api.topcValidarPilarDaPauta_(aba, pauta),
    /está marcada como "Comparativo", não como Pilar/
  );
});

test('topcValidarPilarDaPauta_ rejeita quando o pilar ainda não foi gerado', () => {
  const api = carregarApi();
  const aba = abaDouble([
    ['Guia de Sanduicheiras', 'Pilar', 'Pesquisando', 'guia-de-sanduicheiras']
  ]);

  const pauta = {
    tipo: 'Lista',
    pilar: 'Guia de Sanduicheiras'
  };

  assert.throws(
    () => api.topcValidarPilarDaPauta_(aba, pauta),
    /está com status "Pesquisando"/
  );
});

test('topcValidarPilarDaPauta_ rejeita satélite sem "Pilar relacionado"', () => {
  const api = carregarApi();
  const aba = abaDouble([]);

  const pauta = {
    tipo: 'Review',
    pilar: ''
  };

  assert.throws(
    () => api.topcValidarPilarDaPauta_(aba, pauta),
    /Pauta satélite sem "Pilar relacionado"/
  );
});

test('topcValidarPilarDaPauta_ rejeita pauta Pilar com "Pilar relacionado" preenchido', () => {
  const api = carregarApi();
  const aba = abaDouble([]);

  const pauta = {
    tipo: 'Pilar',
    pilar: 'Outro Pilar Qualquer'
  };

  assert.throws(
    () => api.topcValidarPilarDaPauta_(aba, pauta),
    /Uma pauta do tipo Pilar não pode ter "Pilar relacionado" preenchido/
  );
});

test('topcValidarPilarDaPauta_ aceita satélite cujo pilar existe, tem o Tipo certo e já foi gerado', () => {
  const api = carregarApi();
  const aba = abaDouble([
    ['Guia de Sanduicheiras', 'Pilar', 'Em revisão', 'guia-de-sanduicheiras']
  ]);

  const pauta = {
    tipo: 'Comparativo',
    pilar: 'Guia de Sanduicheiras'
  };

  assert.doesNotThrow(() => api.topcValidarPilarDaPauta_(aba, pauta));
});

test('topcValidarPilarDaPauta_ aceita pauta Pilar sem "Pilar relacionado"', () => {
  const api = carregarApi();
  const aba = abaDouble([]);

  const pauta = {
    tipo: 'Pilar',
    pilar: ''
  };

  assert.doesNotThrow(() => api.topcValidarPilarDaPauta_(aba, pauta));
});
