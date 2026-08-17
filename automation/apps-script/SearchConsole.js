// Puxa dados do Google Search Console direto pela Search Console API,
// usando o serviço avançado do Apps Script (sem depender de conectores
// de terceiros). Requer habilitar o serviço avançado "Search Console
// API" no projeto (Serviços > Search Console API) e a mesma API no
// projeto do Google Cloud vinculado ao script.

const SEARCH_CONSOLE_CONFIG = {
  SITE_URL: '', // ex.: 'https://www.topcomparativos.com/' ou 'sc-domain:topcomparativos.com'
  SEMANAS: 3,
  DIAS_DE_ATRASO: 3, // o GSC costuma levar 2-3 dias para consolidar os dados mais recentes
  DIMENSOES: ['date', 'query', 'page'],
  ABA: 'Search Console'
};

function topcFormatarDataISO_(data) {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return ano + '-' + mes + '-' + dia;
}

function topcIntervaloUltimasSemanas_(hoje, semanas, diasDeAtraso) {
  const fim = new Date(Date.UTC(
    hoje.getUTCFullYear(),
    hoje.getUTCMonth(),
    hoje.getUTCDate()
  ));
  fim.setUTCDate(fim.getUTCDate() - diasDeAtraso);

  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - (semanas * 7 - 1));

  return {
    inicio: topcFormatarDataISO_(inicio),
    fim: topcFormatarDataISO_(fim)
  };
}

function topcMontarRequisicaoSearchConsole_(intervalo, dimensoes) {
  return {
    startDate: intervalo.inicio,
    endDate: intervalo.fim,
    dimensions: dimensoes,
    rowLimit: 25000
  };
}

function topcMontarLinhasSearchConsole_(dimensoes, linhasApi) {
  const cabecalho = dimensoes.concat(
    ['clicks', 'impressions', 'ctr', 'position']
  );

  const linhas = (linhasApi || []).map(function (linha) {
    return linha.keys.concat([
      linha.clicks,
      linha.impressions,
      linha.ctr,
      linha.position
    ]);
  });

  return [cabecalho].concat(linhas);
}

function topcEscreverDadosSearchConsole_(planilha, nomeAba, linhas) {
  let aba = planilha.getSheetByName(nomeAba);

  if (!aba) {
    aba = planilha.insertSheet(nomeAba);
  }

  aba.clearContents();

  if (linhas.length) {
    aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
    aba.setFrozenRows(1);
  }

  return aba;
}

function topcPuxarDadosSearchConsole_() {
  const siteUrl = String(SEARCH_CONSOLE_CONFIG.SITE_URL || '').trim();

  if (!siteUrl) {
    throw new Error(
      'Defina SEARCH_CONSOLE_CONFIG.SITE_URL em SearchConsole.js com a ' +
      'propriedade exata cadastrada no Search Console (ex.: ' +
      '"https://www.topcomparativos.com/" ou ' +
      '"sc-domain:topcomparativos.com").'
    );
  }

  const intervalo = topcIntervaloUltimasSemanas_(
    new Date(),
    SEARCH_CONSOLE_CONFIG.SEMANAS,
    SEARCH_CONSOLE_CONFIG.DIAS_DE_ATRASO
  );

  const requisicao = topcMontarRequisicaoSearchConsole_(
    intervalo,
    SEARCH_CONSOLE_CONFIG.DIMENSOES
  );

  const resposta = SearchConsole.Searchanalytics.query(requisicao, siteUrl);

  const linhas = topcMontarLinhasSearchConsole_(
    SEARCH_CONSOLE_CONFIG.DIMENSOES,
    resposta.rows
  );

  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  topcEscreverDadosSearchConsole_(
    planilha,
    SEARCH_CONSOLE_CONFIG.ABA,
    linhas
  );

  const mensagem = (linhas.length - 1) + ' linha(s) de ' + intervalo.inicio +
    ' a ' + intervalo.fim + ' gravadas na aba "' +
    SEARCH_CONSOLE_CONFIG.ABA + '".';

  planilha.toast(mensagem, 'Search Console', 15);

  return { intervalo: intervalo, linhas: linhas.length - 1 };
}

function puxarDadosSearchConsoleUltimasSemanas() {
  return topcPuxarDadosSearchConsole_();
}
