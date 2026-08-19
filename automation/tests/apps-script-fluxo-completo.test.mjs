import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
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

// Planilha em memória mínima o bastante para obterColunas_/obterValor_/
// atualizarValor_, que é tudo que topcContinuarFluxoAutomaticoSeAtivo_
// precisa da aba "Pauta editorial".
function abaDupla(headers, linhaValores) {
  const linhas = { 1: headers.slice(), 2: linhaValores.slice() };

  return {
    getLastColumn: () => headers.length,
    getRange(row, col, numRows, numCols) {
      if (numRows === undefined) {
        return {
          getDisplayValue: () => String(linhas[row][col - 1] ?? ''),
          setValue: valor => { linhas[row][col - 1] = valor; }
        };
      }

      return {
        getDisplayValues: () => [linhas[row].slice(col - 1, col - 1 + numCols)]
      };
    }
  };
}

function propertiesServiceDupla(inicial = {}) {
  const props = { ...inicial };

  return {
    getScriptProperties: () => ({
      getProperty: chave => props[chave] ?? null,
      setProperty: (chave, valor) => { props[chave] = valor; },
      deleteProperty: chave => { delete props[chave]; }
    }),
    props
  };
}

const HEADERS = [
  'ID', 'Título', 'Status', 'Slug', 'Link da pesquisa', 'Link do artigo',
  'Link da revisão', 'Link final', 'Status das imagens', 'Observações',
  'Versão no site'
];

function valoresBase() {
  return [
    '1', 'Guia', 'Na fila', 'guia', 'https://docs.google.com/d1',
    'https://docs.google.com/d2', 'https://docs.google.com/d3',
    'https://docs.google.com/d4', 'Concluído', '', 'v1'
  ];
}

test('continua sozinho até publicar quando o fluxo automático está marcado e as imagens terminam sem falhas', () => {
  const chamadas = [];
  const aba = abaDupla(HEADERS, valoresBase());
  const propertiesService = propertiesServiceDupla({
    AUTO_FLUXO_guia: 'true'
  });

  const api = load([scripts.codigo, scripts.planoSeo], {
    PropertiesService: propertiesService,
    Utilities: {
      formatDate: () => '11/08/2026 10:00',
      getUuid: () => 'uuid'
    },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' }
  });

  // Sobrescreve as implementações reais (que chamam DocumentApp/UrlFetchApp)
  // depois do carregamento: declarações de função no mesmo arquivo
  // vencem qualquer stub passado no contexto inicial do vm.
  api.enviarRascunhoSiteLinha_ = (a, linha) => chamadas.push(['rascunho', linha]);
  api.enviarImagensSiteLinha_ = (a, linha) => chamadas.push(['imagens', linha]);
  api.publicarArtigoSiteLinha_ = (a, linha) => chamadas.push(['publicar', linha]);

  api.topcContinuarFluxoAutomaticoSeAtivo_('guia', aba, 2, 'Concluído');

  assert.deepEqual(chamadas, [
    ['rascunho', 2],
    ['imagens', 2],
    ['publicar', 2]
  ]);

  assert.equal(propertiesService.props.AUTO_FLUXO_guia, undefined);
  assert.match(aba.getRange(2, 10).getDisplayValue(), /concluiu a publicação/);
});

test('não continua quando a fila de imagens termina com pendências', () => {
  const chamadas = [];
  const aba = abaDupla(HEADERS, valoresBase());
  const propertiesService = propertiesServiceDupla({
    AUTO_FLUXO_guia: 'true'
  });

  const api = load([scripts.codigo, scripts.planoSeo], {
    PropertiesService: propertiesService,
    Utilities: { formatDate: () => '11/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' }
  });

  api.enviarRascunhoSiteLinha_ = () => chamadas.push('rascunho');
  api.enviarImagensSiteLinha_ = () => chamadas.push('imagens');
  api.publicarArtigoSiteLinha_ = () => chamadas.push('publicar');

  api.topcContinuarFluxoAutomaticoSeAtivo_(
    'guia',
    aba,
    2,
    'Concluído com pendências'
  );

  assert.deepEqual(chamadas, []);
  assert.equal(propertiesService.props.AUTO_FLUXO_guia, undefined);
  assert.match(
    aba.getRange(2, 10).getDisplayValue(),
    /interrompido: imagens terminaram com pendências/
  );
});

test('não faz nada quando a linha não está marcada para fluxo automático', () => {
  const chamadas = [];
  const aba = abaDupla(HEADERS, valoresBase());
  const propertiesService = propertiesServiceDupla({});

  const api = load([scripts.codigo, scripts.planoSeo], {
    PropertiesService: propertiesService
  });

  api.enviarRascunhoSiteLinha_ = () => chamadas.push('rascunho');
  api.enviarImagensSiteLinha_ = () => chamadas.push('imagens');
  api.publicarArtigoSiteLinha_ = () => chamadas.push('publicar');

  api.topcContinuarFluxoAutomaticoSeAtivo_('guia', aba, 2, 'Concluído');

  assert.deepEqual(chamadas, []);
  assert.equal(aba.getRange(2, 10).getDisplayValue(), '');
});

function scriptAppDupla() {
  const triggers = [];

  return {
    newTrigger(handler) {
      const gatilho = { handler, timeBased: () => gatilho, after: () => gatilho };
      gatilho.create = () => { triggers.push({ handler }); return gatilho; };
      return gatilho;
    },
    getProjectTriggers: () => triggers.map(t => ({
      getHandlerFunction: () => t.handler
    })),
    deleteTrigger: () => { triggers.length = 0; },
    triggers
  };
}

test('o fluxo completo pula etapas já feitas, enfileira imagens e marca continuação automática', () => {
  const chamadas = [];
  const alertas = [];
  const toasts = [];
  const valores = valoresBase();
  valores[8] = 'Na fila'; // Status das imagens ainda não concluído
  const aba = abaDupla(HEADERS, valores);
  aba.getName = () => 'Pauta editorial';
  aba.getActiveCell = () => ({ getRow: () => 2 });

  const planilha = {
    getActiveSheet: () => aba,
    getSheetByName: () => aba,
    toast: (...args) => toasts.push(args)
  };

  const propertiesService = propertiesServiceDupla({});
  const scriptApp = scriptAppDupla();

  const api = load([scripts.codigo, scripts.planoSeo], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => planilha,
      getUi: () => ({ alert: msg => alertas.push(msg) })
    },
    PropertiesService: propertiesService,
    ScriptApp: scriptApp
  });

  api.pesquisarPautaLinha_ = () => chamadas.push('pesquisa');
  api.gerarArtigoLinha_ = () => chamadas.push('artigo');
  api.revisarArtigoLinha_ = () => chamadas.push('revisao');
  api.enfileirarImagensLinha_ = () => chamadas.push('imagens');
  api.enviarRascunhoSiteLinha_ = () => chamadas.push('rascunho');
  api.enviarImagensSiteLinha_ = () => chamadas.push('imagens-site');
  api.publicarArtigoSiteLinha_ = () => chamadas.push('publicar');

  api.executarFluxoCompletoSelecionado();

  // Link da pesquisa, do artigo e da revisão já estavam preenchidos na
  // linha de teste, então só a etapa de imagens (ainda "Na fila") roda,
  // numa única execução (nada fica agendado para depois).
  assert.deepEqual(chamadas, ['imagens']);
  assert.equal(propertiesService.props.AUTO_FLUXO_guia, 'true');
  assert.equal(propertiesService.props.AUTO_FLUXO_LINHA, undefined);
  assert.equal(scriptApp.triggers.length, 0);
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /segundo plano/);
  assert.equal(toasts.length, 1);
  assert.match(toasts[0][0], /sozinhos/);
});

test('roda uma etapa por vez e agenda a próxima em vez de empilhar tudo numa execução', () => {
  const chamadas = [];
  const valores = valoresBase();
  valores[4] = ''; // Link da pesquisa vazio: só essa etapa deve rodar agora
  valores[5] = '';
  valores[6] = '';
  const aba = abaDupla(HEADERS, valores);
  aba.getName = () => 'Pauta editorial';
  aba.getActiveCell = () => ({ getRow: () => 2 });

  const planilha = {
    getActiveSheet: () => aba,
    getSheetByName: () => aba,
    toast: () => {}
  };

  const propertiesService = propertiesServiceDupla({});
  const scriptApp = scriptAppDupla();

  const api = load([scripts.codigo], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => planilha,
      getUi: () => ({ alert: () => {} })
    },
    PropertiesService: propertiesService,
    ScriptApp: scriptApp
  });

  api.pesquisarPautaLinha_ = () => chamadas.push('pesquisa');
  api.gerarArtigoLinha_ = () => chamadas.push('artigo');
  api.revisarArtigoLinha_ = () => chamadas.push('revisao');
  api.enfileirarImagensLinha_ = () => chamadas.push('imagens');

  api.executarFluxoCompletoSelecionado();

  // Só a pesquisa roda nesta execução; artigo e revisão ficam para
  // execuções futuras disparadas pelo gatilho agendado.
  assert.deepEqual(chamadas, ['pesquisa']);
  assert.equal(propertiesService.props.AUTO_FLUXO_LINHA, '2');
  assert.equal(scriptApp.triggers.length, 1);
  assert.equal(scriptApp.triggers[0].handler, 'avancarFluxoCompletoAutomatico');
});

test('recusa iniciar um segundo fluxo automático enquanto outra linha está em andamento', () => {
  const alertas = [];
  const aba = abaDupla(HEADERS, valoresBase());
  aba.getName = () => 'Pauta editorial';
  aba.getActiveCell = () => ({ getRow: () => 2 });

  const planilha = { getActiveSheet: () => aba, getSheetByName: () => aba, toast: () => {} };
  const propertiesService = propertiesServiceDupla({ AUTO_FLUXO_LINHA: '5' });
  const scriptApp = scriptAppDupla();

  const api = load([scripts.codigo], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => planilha,
      getUi: () => ({ alert: msg => alertas.push(msg) })
    },
    PropertiesService: propertiesService,
    ScriptApp: scriptApp
  });

  api.executarFluxoCompletoSelecionado();

  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /linha 5/);
  assert.equal(propertiesService.props.AUTO_FLUXO_LINHA, '5');
});

test('registra e limpa a falha quando uma das etapas 5 a 7 quebra', () => {
  const aba = abaDupla(HEADERS, valoresBase());
  const propertiesService = propertiesServiceDupla({
    AUTO_FLUXO_guia: 'true'
  });

  const api = load([scripts.codigo, scripts.planoSeo], {
    PropertiesService: propertiesService,
    Utilities: { formatDate: () => '11/08/2026 10:00' },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' }
  });

  api.enviarRascunhoSiteLinha_ = () => {};
  api.enviarImagensSiteLinha_ = () => {
    throw new Error('Falha ao enviar imagem X.');
  };
  api.publicarArtigoSiteLinha_ = () => {
    throw new Error('não deveria chegar aqui');
  };

  api.topcContinuarFluxoAutomaticoSeAtivo_('guia', aba, 2, 'Concluído');

  assert.equal(propertiesService.props.AUTO_FLUXO_guia, undefined);
  assert.equal(aba.getRange(2, 3).getDisplayValue(), 'Erro');
  assert.match(
    aba.getRange(2, 10).getDisplayValue(),
    /Falha ao enviar imagem X\./
  );
});
