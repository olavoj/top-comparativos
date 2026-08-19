import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPublish(extras = {}) {
  const path = new URL('../apps-script/Publish.js', import.meta.url);
  const context = vm.createContext({ ...extras });
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
    filename: String(path)
  });
  return context;
}

const validContext = {
  id: '1',
  slug: 'guia-completo-potes-hermeticos',
  linkFinal: 'https://docs.google.com/open?id=doc',
  statusImagens: 'Concluído',
  versaoSite: '2026-08-05T21:59:46.49759321611Z'
};

const validEnvelope = {
  document: {
    blocks: [
      { type: 'paragraph', text: 'conteúdo' },
      { type: 'image', mediaKey: 'capa.webp', alt: 'Capa' }
    ]
  }
};

function versionSheet(headers) {
  const values = new Map();
  const formats = new Map();
  return {
    values,
    formats,
    getLastColumn: () => headers.length,
    getRange(row, column) {
      return {
        getDisplayValues: () => [headers],
        setNumberFormat(format) {
          formats.set(`${row}:${column}`, format);
          return this;
        },
        setValue(value) {
          values.set(`${row}:${column}`, value);
          if (row === 1 && column > headers.length) headers.push(value);
        }
      };
    }
  };
}

test('grava a versão retornada pelo site na coluna existente', () => {
  const api = loadPublish();
  const sheet = versionSheet(['ID', 'Versão no site']);

  api.topcPersistirVersaoSite_(
    sheet,
    2,
    '2026-08-05T21:59:46.49759321611Z'
  );

  assert.equal(
    sheet.values.get('2:2'),
    '2026-08-05T21:59:46.49759321611Z'
  );
});

test('cria a coluna Versão no site uma única vez quando ausente', () => {
  const api = loadPublish();
  const sheet = versionSheet(['ID']);

  api.topcPersistirVersaoSite_(
    sheet,
    2,
    '2026-08-05T21:59:46.49759321611Z'
  );

  assert.equal(sheet.values.get('1:2'), 'Versão no site');
  assert.equal(
    sheet.values.get('2:2'),
    '2026-08-05T21:59:46.49759321611Z'
  );
});

test('rejeita versão vazia antes de alterar a planilha', () => {
  const api = loadPublish();
  const sheet = versionSheet(['ID']);

  assert.throws(
    () => api.topcPersistirVersaoSite_(sheet, 2, '   '),
    /versão/i
  );
  assert.equal(sheet.values.size, 0);
});

test('rejeita pauta sem Status das imagens Concluído', () => {
  const api = loadPublish();
  assert.throws(() => api.topcValidarPrePublicacao_(
    { ...validContext, statusImagens: 'Pendente' },
    validEnvelope,
    [{ mediaKey: 'capa.webp' }]
  ), /Status das imagens/);
});

test('grava a versão como texto simples', () => {
  const api = loadPublish();
  const sheet = versionSheet(['ID', 'Versão no site']);

  api.topcPersistirVersaoSite_(
    sheet,
    2,
    '2026-08-05T21:59:46.49759321611Z'
  );

  assert.equal(sheet.formats.get('2:2'), '@');
});

test('rejeita versão convertida em data pela planilha', () => {
  const api = loadPublish();

  assert.throws(() => api.topcValidarPrePublicacao_(
    { ...validContext, versaoSite: '05/08/2026 21:59:46' },
    validEnvelope,
    [{ mediaKey: 'capa.webp' }]
  ), /ISO-8601/);
});

test('aceita versões ISO com e sem fração de segundo', () => {
  const api = loadPublish();

  for (const versao of [
    '2026-08-05T21:59:46Z',
    '2026-08-05T21:59:46.497Z',
    '2026-08-05T21:59:46.49759321611Z',
    '2026-08-05T18:59:46-03:00'
  ]) {
    assert.equal(api.topcVersaoSiteValida_(versao), true, versao);
  }

  for (const versao of ['', '05/08/2026', '2026-08-05', 'ontem']) {
    assert.equal(api.topcVersaoSiteValida_(versao), false, versao);
  }
});

test('explica o editorial_publish_invalid devolvido pelo site', () => {
  const api = loadPublish();

  assert.throws(
    () => api.topcValidarRespostaPublicacao_(
      422,
      'pauta-11',
      '{"error":"editorial_publish_invalid"}'
    ),
    error =>
      error.message.includes('HTTP 422') &&
      error.message.includes('editorial_publish_invalid') &&
      /Vers.o no site/.test(error.message) &&
      error.message.includes('Diagnosticar publicação')
  );
});

test('preserva a resposta crua quando o código é desconhecido', () => {
  const api = loadPublish();

  assert.throws(
    () => api.topcValidarRespostaPublicacao_(500, 'pauta-11', 'boom'),
    error =>
      error.message.includes('HTTP 500') &&
      error.message.includes('boom')
  );
});

test('resume o envelope e aponta o que falta para publicar', () => {
  const api = loadPublish();

  const resumo = api.topcResumirPublicacao_(
    validContext,
    { ...validEnvelope, sources: [{ url: 'https://exemplo.com' }], products: [] },
    [{ mediaKey: 'capa.webp', role: 'cover' }]
  );

  assert.equal(resumo.sourceKey, 'pauta-1');
  assert.equal(resumo.versaoValida, true);
  assert.equal(resumo.fontes, 1);
  assert.equal(resumo.produtos, 0);
  assert.deepEqual(resumo.imagensNoEnvelope, ['capa.webp']);
  assert.ok(resumo.pendencias.some(item => /produto/.test(item)));
});

test('aponta imagem concluída que ficou fora do envelope', () => {
  const api = loadPublish();

  const resumo = api.topcResumirPublicacao_(
    validContext,
    { ...validEnvelope, sources: [{ url: 'https://exemplo.com' }] },
    [
      { mediaKey: 'capa.webp', role: 'cover' },
      { mediaKey: 'perdida.webp', role: 'inline' }
    ]
  );

  assert.ok(
    resumo.pendencias.some(item => item.includes('perdida.webp'))
  );
});

test('rejeita publicação sem Versão no site', () => {
  const api = loadPublish();
  assert.throws(() => api.topcValidarPrePublicacao_(
    { ...validContext, versaoSite: '' },
    validEnvelope,
    [{ mediaKey: 'capa.webp' }]
  ), /Versão no site/);
});

for (const [name, patch, message] of [
  ['rejeita ID ausente', { id: '' }, /ID/],
  ['rejeita slug ausente', { slug: '' }, /Slug/],
  ['rejeita Link final ausente', { linkFinal: '' }, /Link final/]
]) {
  test(name, () => {
    const api = loadPublish();
    assert.throws(() => api.topcValidarPrePublicacao_(
      { ...validContext, ...patch },
      validEnvelope,
      [{ mediaKey: 'capa.webp' }]
    ), message);
  });
}

test('rejeita rascunho sem blocos', () => {
  const api = loadPublish();
  assert.throws(() => api.topcValidarPrePublicacao_(
    validContext,
    { document: { blocks: [] } },
    []
  ), /blocos editoriais/);
});

test('rejeita mídia concluída sem referência no envelope', () => {
  const api = loadPublish();
  assert.throws(() => api.topcValidarPrePublicacao_(
    validContext,
    validEnvelope,
    [{ mediaKey: 'outra.webp' }]
  ), /não referenciada/);
});

test('aceita contexto pronto para publicação', () => {
  const api = loadPublish();
  assert.doesNotThrow(() => api.topcValidarPrePublicacao_(
    validContext,
    validEnvelope,
    [{ mediaKey: 'capa.webp' }]
  ));
});

test('aceita apenas HTTP 200 e trunca resposta de erro', () => {
  const api = loadPublish();
  assert.doesNotThrow(() =>
    api.topcValidarRespostaPublicacao_(200, 'pauta-1', '{}')
  );
  for (const code of [201, 401, 409]) {
    assert.throws(
      () => api.topcValidarRespostaPublicacao_(code, 'pauta-1', 'x'.repeat(800)),
      error => error.message.includes('HTTP ' + code) && error.message.length < 600
    );
  }
});

test('publica automaticamente pela rota HMAC sem abrir confirmação', () => {
  let request;
  let toast;
  const headers = [
    'ID', 'Título', 'Tipo', 'Pilar relacionado', 'Palavra-chave principal',
    'Intenção', 'Categoria', 'Status', 'Prioridade', 'Data prevista', 'Slug',
    'Link da pesquisa', 'Link do artigo', 'Link da revisão', 'Link final',
    'Status das imagens', 'Responsável', 'Observações', 'Versão no site'
  ];
  const values = [
    '1', 'Guia', 'Pilar', '', 'potes', 'Informacional', 'Casa', '', '', '',
    'guia-completo-potes-hermeticos', '', '', '',
    'https://docs.google.com/open?id=doc', 'Concluído', 'Olavo', '',
    '2026-08-05T21:59:46.49759321611Z'
  ];
  const sheet = {
    getName: () => 'Pauta editorial',
    getActiveCell: () => ({ getRow: () => 2 }),
    getLastColumn: () => headers.length,
    getRange: row => ({
      getDisplayValues: () => [row === 1 ? headers : values]
    })
  };
  const spreadsheet = {
    getActiveSheet: () => sheet,
    toast: (...args) => { toast = args; }
  };
  const api = loadPublish({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      getUi: () => { throw new Error('não deve abrir confirmação'); }
    },
    topcMontarEnvelopeLinha_: () => structuredClone(validEnvelope),
    topcObterMidiasConcluidas_: () => [{ mediaKey: 'capa.webp' }],
    topcEnviarAssinado_: (path, sourceKey, body, contentType) => {
      request = { path, sourceKey, body, contentType };
      return {
        getResponseCode: () => 200,
        getContentText: () => '{"published":true}'
      };
    },
    Logger: { log: () => {} }
  });

  api.publicarArtigoSiteSelecionado();

  assert.deepEqual(request, {
    path: '/api/automation/articles/pauta-1/publish',
    sourceKey: 'pauta-1',
    body: '{"expectedUpdatedAt":"2026-08-05T21:59:46.49759321611Z"}',
    contentType: 'application/json'
  });
  assert.match(toast[0], /publicado/i);
});

test('registra publicação depois do upload no menu', () => {
  const api = loadPublish();
  const calls = [];
  const menu = {
    addSeparator() {
      calls.push(['separator']);
      return this;
    },
    addItem(label, handler) {
      calls.push([label, handler]);
      return this;
    }
  };

  assert.strictEqual(api.topcAdicionarPublishMenu_(menu), menu);
  assert.deepEqual(calls, [
    ['separator'],
    ['7. Publicar artigo no site', 'publicarArtigoSiteSelecionado']
  ]);
});
