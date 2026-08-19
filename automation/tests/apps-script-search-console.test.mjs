import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/SearchConsole.js', import.meta.url);

function load(globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
    filename: String(path)
  });
  return context;
}

test('calcula o intervalo das últimas 3 semanas com atraso de coleta', () => {
  const { topcIntervaloUltimasSemanas_ } = load();
  const hoje = new Date('2026-08-17T12:00:00Z');

  const intervalo = topcIntervaloUltimasSemanas_(hoje, 3, 3);

  assert.equal(intervalo.fim, '2026-08-14');
  assert.equal(intervalo.inicio, '2026-07-25');
});

test('monta a requisição com as dimensões configuradas', () => {
  const { topcMontarRequisicaoSearchConsole_ } = load();

  const requisicao = topcMontarRequisicaoSearchConsole_(
    { inicio: '2026-07-25', fim: '2026-08-14' },
    ['date', 'query', 'page']
  );

  assert.deepEqual(structuredClone(requisicao), {
    startDate: '2026-07-25',
    endDate: '2026-08-14',
    dimensions: ['date', 'query', 'page'],
    rowLimit: 25000
  });
});

test('converte as linhas da API em linhas de planilha com cabeçalho', () => {
  const { topcMontarLinhasSearchConsole_ } = load();

  const linhas = topcMontarLinhasSearchConsole_(
    ['date', 'query'],
    [
      {
        keys: ['2026-08-01', 'melhor aspirador de pó'],
        clicks: 12,
        impressions: 340,
        ctr: 0.0352941176,
        position: 8.4
      }
    ]
  );

  assert.deepEqual(structuredClone(linhas), [
    ['date', 'query', 'clicks', 'impressions', 'ctr', 'position'],
    ['2026-08-01', 'melhor aspirador de pó', 12, 340, 0.0352941176, 8.4]
  ]);
});

test('lida com resposta sem linhas', () => {
  const { topcMontarLinhasSearchConsole_ } = load();

  const linhas = topcMontarLinhasSearchConsole_(['date'], undefined);

  assert.deepEqual(structuredClone(linhas), [['date', 'clicks', 'impressions', 'ctr', 'position']]);
});

test('escreve linhas na aba, recriando-a quando necessário', () => {
  const { topcEscreverDadosSearchConsole_ } = load();

  const valoresGravados = [];
  const abaFalsa = {
    clearContents() {},
    getRange(linha, coluna, numLinhas, numColunas) {
      return {
        setValues(valores) {
          valoresGravados.push(...valores);
          assert.equal(valores.length, numLinhas);
          assert.equal(valores[0].length, numColunas);
        }
      };
    },
    setFrozenRows() {}
  };

  const planilhaFalsa = {
    getSheetByName() { return abaFalsa; },
    insertSheet() { throw new Error('não deveria criar aba nova'); }
  };

  topcEscreverDadosSearchConsole_(planilhaFalsa, 'Search Console', [
    ['date', 'clicks'],
    ['2026-08-01', 12]
  ]);

  assert.deepEqual(valoresGravados, [
    ['date', 'clicks'],
    ['2026-08-01', 12]
  ]);
});

test('consulta a Search Console API com o token OAuth do script', () => {
  const chamadas = [];

  const { topcConsultarSearchConsoleApi_ } = load({
    ScriptApp: { getOAuthToken: () => 'token-falso' },
    UrlFetchApp: {
      fetch(url, opcoes) {
        chamadas.push([url, opcoes]);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ rows: [] })
        };
      }
    }
  });

  const resultado = topcConsultarSearchConsoleApi_(
    'https://www.topcomparativos.com/',
    { startDate: '2026-07-25', endDate: '2026-08-14' }
  );

  assert.deepEqual(structuredClone(resultado), { rows: [] });
  assert.equal(chamadas.length, 1);

  const [url, opcoes] = chamadas[0];
  assert.equal(
    url,
    'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
    'https%3A%2F%2Fwww.topcomparativos.com%2F/searchAnalytics/query'
  );
  assert.equal(opcoes.method, 'post');
  assert.equal(opcoes.headers.Authorization, 'Bearer token-falso');
  assert.deepEqual(
    JSON.parse(opcoes.payload),
    { startDate: '2026-07-25', endDate: '2026-08-14' }
  );
});

test('lança erro com a mensagem da API quando a resposta falha', () => {
  const { topcConsultarSearchConsoleApi_ } = load({
    ScriptApp: { getOAuthToken: () => 'token-falso' },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 403,
        getContentText: () => JSON.stringify({
          error: { message: 'Search Console API não ativada.' }
        })
      })
    }
  });

  assert.throws(
    () => topcConsultarSearchConsoleApi_('https://www.topcomparativos.com/', {}),
    /Search Console API não ativada\./
  );
});
