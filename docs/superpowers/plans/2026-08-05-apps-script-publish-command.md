# Apps Script Publish Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o comando `6. Publicar artigo no site`, sem confirmação manual, usando o endpoint HMAC de publicação e mantendo o servidor como autoridade final.

**Architecture:** A nova lógica ficará em `automation/apps-script/Publish.js`, separada do arquivo editorial grande. O comando fará pré-validações da pauta, chamará o cliente HMAC já existente com corpo JSON `{}` e aceitará HTTP 200 como sucesso do contrato atual de publicação. O menu existente será encadeado como `upload -> publish -> addToUi`.

**Tech Stack:** Google Apps Script V8, `SpreadsheetApp`, `UrlFetchApp`, cliente HMAC existente `topcEnviarAssinado_`, Node.js 24 `node:test`, clasp 3.3.

## Global Constraints

- Não mostrar diálogo de confirmação.
- Processar somente a linha ativa de `Pauta editorial`.
- Exigir ID, Slug, Link final e `Status das imagens = Concluído`.
- Usar `sourceKey = pauta-{ID}`.
- Usar POST `/api/automation/articles/{sourceKey}/publish`.
- Usar corpo JSON mínimo e determinístico `{}`.
- Aceitar HTTP 200 como sucesso; qualquer outro código é erro.
- Nunca registrar segredo HMAC ou assinatura.
- Não alterar colunas da planilha nesta versão.
- Não inventar URL pública quando a API não a devolver.
- O site permanece responsável pela promoção atômica do snapshot publicado.

---

### Task 1: Comando de publicação e pré-validações

**Files:**
- Create: `automation/apps-script/Publish.js`
- Create: `automation/tests/apps-script-publish.test.mjs`

**Interfaces:**
- Consumes: `topcEnviarAssinado_(path, sourceKey, body, contentType)`, `topcMontarEnvelopeSelecionado_()`, `topcObterMidiasConcluidas_(linha, slug)` e Google Sheets.
- Produces: `publicarArtigoSiteSelecionado()`, `topcObterContextoPublicacao_(aba, linha)`, `topcValidarPrePublicacao_(contexto, envelope, midias)`, `topcValidarRespostaPublicacao_(codigo, sourceKey, texto)`.

- [ ] **Step 1: Escrever os testes RED**

Criar `automation/tests/apps-script-publish.test.mjs` com `node:test`, `assert/strict`, `fs` e `vm`. Os testes devem carregar `Publish.js` e cobrir:

```js
test('rejeita pauta sem Status das imagens Concluído', () => {
  assert.throws(() => api.topcValidarPrePublicacao_(
    {
      id: '1',
      slug: 'guia-completo-potes-hermeticos',
      linkFinal: 'https://docs.google.com/open?id=doc',
      statusImagens: 'Pendente'
    },
    { document: { blocks: [{ type: 'paragraph', text: 'conteúdo' }] } },
    []
  ), /Status das imagens/);
});

test('aceita contexto pronto para publicação', () => {
  assert.doesNotThrow(() => api.topcValidarPrePublicacao_(
    {
      id: '1',
      slug: 'guia-completo-potes-hermeticos',
      linkFinal: 'https://docs.google.com/open?id=doc',
      statusImagens: 'Concluído'
    },
    {
      document: {
        blocks: [
          { type: 'paragraph', text: 'conteúdo' },
          { type: 'image', mediaKey: 'capa.webp', alt: 'Capa' }
        ]
      }
    },
    [{ mediaKey: 'capa.webp' }]
  ));
});
```

Adicionar casos independentes para ID ausente, slug ausente, Link final ausente, documento sem blocos, mídia concluída sem bloco `image`, HTTP 401 e HTTP 409. Confirmar que o erro HTTP contém no máximo 500 caracteres do corpo.

- [ ] **Step 2: Executar RED**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Expected: FAIL porque `automation/apps-script/Publish.js` ainda não existe.

- [ ] **Step 3: Implementar as validações puras**

Criar `Publish.js` com validação equivalente a:

```js
function topcValidarPrePublicacao_(contexto, envelope, midias) {
  if (!contexto.id) throw new Error('A pauta não possui ID.');
  if (!contexto.slug) throw new Error('A pauta não possui Slug.');
  if (!contexto.linkFinal) throw new Error('A pauta não possui Link final.');
  if (contexto.statusImagens !== 'Concluído') {
    throw new Error('Status das imagens precisa estar como Concluído.');
  }

  const blocks = envelope &&
    envelope.document &&
    Array.isArray(envelope.document.blocks)
      ? envelope.document.blocks
      : [];

  if (!blocks.length) throw new Error('O rascunho não possui blocos editoriais.');

  const refs = blocks
    .filter(function(block) { return block.type === 'image'; })
    .map(function(block) { return block.mediaKey; });

  midias.forEach(function(media) {
    if (refs.indexOf(media.mediaKey) === -1) {
      throw new Error('Imagem não referenciada no envelope: ' + media.mediaKey);
    }
  });
}
```

Implementar `topcValidarRespostaPublicacao_` aceitando somente 200 e truncando o corpo de erro para 500 caracteres.

- [ ] **Step 4: Executar GREEN das validações**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Expected: todos os testes de validação passam.

- [ ] **Step 5: Escrever o teste RED do comando**

Adicionar um teste com doubles específicos de `SpreadsheetApp`, `topcMontarEnvelopeSelecionado_`, `topcObterMidiasConcluidas_` e `topcEnviarAssinado_`. Para um contexto válido, afirmar que a chamada de rede é exatamente:

```js
{
  path: '/api/automation/articles/pauta-1/publish',
  sourceKey: 'pauta-1',
  body: '{}',
  contentType: 'application/json'
}
```

O double de `SpreadsheetApp.getUi` deve lançar se for acessado, provando que não existe confirmação.

- [ ] **Step 6: Executar RED do comando**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Expected: FAIL porque `publicarArtigoSiteSelecionado` ainda não executa a publicação.

- [ ] **Step 7: Implementar o comando mínimo**

`publicarArtigoSiteSelecionado()` deve:

```js
const sourceKey = 'pauta-' + contexto.id;
const body = '{}';
const resposta = topcEnviarAssinado_(
  '/api/automation/articles/' + encodeURIComponent(sourceKey) + '/publish',
  sourceKey,
  body,
  'application/json'
);
```

Depois ler `getResponseCode()` e `getContentText()`, chamar `topcValidarRespostaPublicacao_`, registrar somente `sourceKey`, slug e resultado, e mostrar `planilha.toast(...)`. Não chamar `SpreadsheetApp.getUi().alert` ou outro diálogo.

- [ ] **Step 8: Executar GREEN e checagem sintática**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Run: `node --check automation/apps-script/Publish.js`

Expected: exit code 0 e nenhum teste falha.

- [ ] **Step 9: Commit**

```bash
git add automation/apps-script/Publish.js automation/tests/apps-script-publish.test.mjs
git commit -m "feat: publish editorial article from Apps Script"
```

---

### Task 2: Integrar o item 6 ao menu

**Files:**
- Modify: `automation/apps-script/Código.js`
- Modify: `automation/apps-script/Publish.js`
- Modify: `automation/tests/apps-script-publish.test.mjs`

**Interfaces:**
- Consumes: `topcAdicionarUploadMenu_(menu)` existente.
- Produces: `topcAdicionarPublishMenu_(menu)`, item `6. Publicar artigo no site`.

- [ ] **Step 1: Escrever teste RED do menu**

Adicionar:

```js
test('registra publicação depois do upload', () => {
  const calls = [];
  const menu = {
    addSeparator() { calls.push(['separator']); return this; },
    addItem(label, handler) { calls.push([label, handler]); return this; }
  };

  assert.strictEqual(api.topcAdicionarPublishMenu_(menu), menu);
  assert.deepEqual(calls, [
    ['separator'],
    ['6. Publicar artigo no site', 'publicarArtigoSiteSelecionado']
  ]);
});
```

- [ ] **Step 2: Executar RED do menu**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Expected: FAIL porque `topcAdicionarPublishMenu_` ainda não existe.

- [ ] **Step 3: Implementar helper do menu**

Adicionar em `Publish.js`:

```js
function topcAdicionarPublishMenu_(menu) {
  return menu
    .addSeparator()
    .addItem(
      '6. Publicar artigo no site',
      'publicarArtigoSiteSelecionado'
    );
}
```

Alterar o final de `onOpen()` em `Código.js` para:

```js
topcAdicionarPublishMenu_(
  topcAdicionarUploadMenu_(menu)
).addToUi();
```

- [ ] **Step 4: Executar verificações completas**

Run: `node --test automation/tests/apps-script-publish.test.mjs`

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Run: `node --check automation/apps-script/Publish.js`

Run: `node --check automation/apps-script/MediaUpload.js`

Run: `node --check automation/apps-script/MediaUploadCore.js`

Expected: todos terminam com exit code 0 e nenhum teste falha.

- [ ] **Step 5: Commit**

```bash
git add automation/apps-script/Código.js automation/apps-script/Publish.js automation/tests/apps-script-publish.test.mjs
git commit -m "feat: expose automatic publish command"
```

- [ ] **Step 6: Sincronizar após merge**

No PowerShell:

```powershell
cd "$HOME\Documents\top-comparativos"
git pull origin main
cd "automation\apps-script"
clasp push
```

Expected: `Pushed 5 files`, incluindo `Publish.js`.

- [ ] **Step 7: Validação integrada com o artigo atual**

Recarregar a planilha, selecionar `guia-completo-potes-hermeticos` e executar `6. Publicar artigo no site`. O registro deve mostrar HTTP 200/sucesso sem diálogo de confirmação. Repetir uma vez para validar idempotência. Depois abrir a URL pública devolvida pela API, se presente; se não estiver presente, localizar o artigo pelo blog do site sem inferir uma rota.
