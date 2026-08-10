import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
  envelope: new URL('../apps-script/EnvelopeImages.js', import.meta.url),
  upload: new URL('../apps-script/MediaUpload.js', import.meta.url),
  publish: new URL('../apps-script/Publish.js', import.meta.url),
  pesquisa: new URL('../apps-script/Pesquisa.js', import.meta.url)
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

function menuDouble(calls, nome = 'Automação SEO') {
  return {
    nome,
    addSeparator() {
      calls.push(['separator']);
      return this;
    },
    addItem(label, handler) {
      calls.push([label, handler]);
      return this;
    },
    addSubMenu(submenu) {
      calls.push(['submenu', submenu.nome]);
      return this;
    },
    addToUi() {
      calls.push(['addToUi']);
      return this;
    }
  };
}

test('o menu expõe as sete etapas do fluxo, do rascunho à publicação', () => {
  const calls = [];
  const submenus = [];

  const ui = {
    createMenu(nome) {
      if (nome === 'Automação SEO') return menuDouble(calls, nome);
      const submenu = menuDouble(submenus, nome);
      return submenu;
    }
  };

  const api = load([scripts.codigo, scripts.upload, scripts.publish], {
    SpreadsheetApp: { getUi: () => ui }
  });

  api.onOpen();

  const itens = calls.filter(call => call.length === 2 && call[0] !== 'submenu');

  assert.deepEqual(itens, [
    ['1. Pesquisar pauta selecionada', 'pesquisarPautaSelecionada'],
    ['2. Gerar artigo com Claude', 'gerarArtigoSelecionado'],
    ['3. Revisar artigo com Claude', 'revisarArtigoSelecionado'],
    ['4. Gerar imagens com Nano Banana', 'enfileirarImagensSelecionadas'],
    ['5. Enviar rascunho ao site', 'enviarRascunhoSiteSelecionado'],
    ['6. Enviar imagens ao site', 'enviarImagensSiteSelecionadas'],
    ['7. Publicar artigo no site', 'publicarArtigoSiteSelecionado']
  ]);

  assert.deepEqual(calls.at(-1), ['addToUi']);
});

test('o menu de ferramentas oferece o reparo da fila de imagens', () => {
  const submenus = [];
  const calls = [];

  const ui = {
    createMenu(nome) {
      if (nome === 'Automação SEO') return menuDouble(calls, nome);
      return menuDouble(submenus, nome);
    }
  };

  const api = load([scripts.codigo, scripts.upload, scripts.publish], {
    SpreadsheetApp: { getUi: () => ui }
  });

  api.onOpen();

  assert.deepEqual(submenus, [
    ['Testar conexão com o site', 'testarConexaoSite'],
    ['Reparar fila de imagens', 'repararFilaImagensAtual'],
    [
      'Reabrir falhas de lista selecionadas',
      'reabrirFalhasListItemSelecionadas'
    ]
  ]);

  assert.ok(
    calls.some(call => call[0] === 'submenu' && call[1] === 'Ferramentas')
  );
});

test('a pesquisa usa o endpoint de chat completions do Perplexity', () => {
  const api = load([scripts.codigo]);

  // `const` no topo do arquivo não vira propriedade do contexto.
  assert.equal(
    vm.runInContext('CONFIG.PERPLEXITY_URL', api),
    'https://api.perplexity.ai/chat/completions'
  );
});

test('o corpo da pesquisa só usa parâmetros aceitos pelo Perplexity', () => {
  const api = load([scripts.codigo]);
  const payload = api.montarPayloadPesquisa_('pergunta');

  assert.deepEqual(Object.keys(payload).sort(), [
    'max_tokens',
    'messages',
    'model',
    'return_related_questions',
    'search_mode',
    'temperature',
    'web_search_options'
  ]);

  assert.equal(payload.return_related_questions, true);
  assert.deepEqual(structuredClone(payload.web_search_options), {
    search_context_size: 'high'
  });
  assert.match(payload.messages[0].content, /português do Brasil/i);
  assert.equal(payload.messages[1].content, 'pergunta');
});

test('a geração de imagem usa v1beta e imageConfig com proporção literal', () => {
  const api = load([scripts.codigo]);

  assert.equal(
    api.montarUrlImagemGemini_(),
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      'gemini-3.1-flash-image:generateContent'
  );

  const capa = api.montarPayloadImagemGemini_('prompt', '16:9');
  const interna = api.montarPayloadImagemGemini_('prompt', '4:3');

  assert.deepEqual(structuredClone(capa.generationConfig), {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: { aspectRatio: '16:9', imageSize: '1K' }
  });

  assert.equal(interna.generationConfig.imageConfig.aspectRatio, '4:3');
  assert.equal(capa.generationConfig.responseFormat, undefined);
});

test('imagem-principal do prompt do artigo é classificada como capa', () => {
  const api = load([scripts.codigo]);

  assert.equal(api.ehNomeDeCapa_('imagem-principal-sanduicheira.webp'), true);
  assert.equal(api.ehNomeDeCapa_('capa-sanduicheira.webp'), true);
  assert.equal(api.ehNomeDeCapa_('editorial-2-sanduicheira.webp'), false);
});

test('a pesquisa não libera uma trava que nunca foi adquirida', () => {
  const alertas = [];
  let liberou = false;

  const aba = {
    getActiveCell: () => ({ getRow: () => 2 }),
    getLastColumn: () => 8,
    getRange: () => ({
      getDisplayValue: () => 'valor',
      getDisplayValues: () => [
        [
          'Título',
          'Tipo',
          'Palavra-chave principal',
          'Intenção',
          'Categoria',
          'Status',
          'Link da pesquisa',
          'Observações'
        ]
      ],
      setValue: () => {}
    })
  };

  const api = load([scripts.codigo, scripts.pesquisa], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getActiveSheet: () => aba }),
      getUi: () => ({ alert: mensagem => alertas.push(mensagem) }),
      flush: () => {}
    },
    LockService: {
      getDocumentLock: () => ({
        waitLock: () => {
          throw new Error('Tempo esgotado ao aguardar a trava.');
        },
        releaseLock: () => {
          liberou = true;
        }
      })
    }
  });

  api.pesquisarPautaSelecionada();

  assert.equal(liberou, false);
  assert.match(alertas.at(-1), /Tempo esgotado/);
});
