# Apps Script Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um comando separado que envie ao site as imagens concluídas da pauta selecionada, sem publicar o artigo.

**Architecture:** A lógica pura de validação e montagem de metadados ficará em `automation/apps-script/MediaUploadCore.js`, reutilizável pelo Apps Script e testável com Node. `Código.js` continuará responsável por Google Sheets, Drive, HMAC, HTTP e mensagens ao usuário. O upload será sequencial e idempotente.

**Tech Stack:** Google Apps Script V8, `UrlFetchApp`, `DriveApp`, `Utilities`, Node.js 24 `node:test`, clasp 3.3.

## Global Constraints

- Processar somente a linha ativa da aba `Pauta editorial`.
- Usar `sourceKey` no padrão `pauta-{ID}`.
- Aceitar somente `image/jpeg`, `image/png` e `image/webp`.
- Rejeitar arquivo vazio ou maior que 10 MiB antes da rede.
- Assinar e enviar exatamente os mesmos bytes.
- Aceitar somente HTTP 200 ou 201 como sucesso.
- Nunca registrar segredo HMAC ou assinatura.
- Interromper no primeiro erro e não publicar o artigo.
- Manter reexecução segura para mídias já armazenadas.

---

### Task 1: Núcleo puro de validação e metadados

**Files:**
- Create: `automation/apps-script/MediaUploadCore.js`
- Create: `automation/tests/apps-script-media-upload.test.mjs`

**Interfaces:**
- Consumes: `media` com `mediaKey`, `role`, `position`, `fileId`; MIME type, tamanho e lista de media keys do envelope.
- Produces: `topcValidarUploadMidia_(media, mimeType, size, referencedMediaKeys)`, `topcMontarCabecalhosMidia_(media, sha256)` e `topcMontarCanonical_(timestamp, requestId, sourceKey, bodyHash)`.

- [ ] **Step 1: Escrever testes RED do núcleo**

Criar `automation/tests/apps-script-media-upload.test.mjs` usando `node:test`, `assert/strict`, `fs` e `vm`. Carregar `MediaUploadCore.js` em um contexto e verificar literalmente:

```js
test('monta canonical HMAC com quatro linhas', () => {
  assert.equal(
    api.topcMontarCanonical_('1700000000', 'req-1', 'pauta-1', 'abc123'),
    '1700000000\nreq-1\npauta-1\nabc123'
  );
});

test('aceita WebP referenciado e monta cabeçalhos inline', () => {
  assert.doesNotThrow(() =>
    api.topcValidarUploadMidia_(
      { mediaKey: 'foto.webp', role: 'inline', position: 2, fileId: 'drive-1' },
      'image/webp',
      1024,
      ['foto.webp']
    )
  );
  assert.deepEqual(
    api.topcMontarCabecalhosMidia_(
      { mediaKey: 'foto.webp', role: 'inline', position: 2 },
      'a'.repeat(64)
    ),
    {
      'x-media-key': 'foto.webp',
      'x-media-sha256': 'a'.repeat(64),
      'x-media-role': 'inline',
      'x-media-position': '2'
    }
  );
});
```

Adicionar casos separados para MIME inválido, zero bytes, `10 * 1024 * 1024 + 1`, media key não referenciada, role inválida e SHA fora de `^[a-f0-9]{64}$`.

- [ ] **Step 2: Executar RED**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Expected: FAIL porque `automation/apps-script/MediaUploadCore.js` ainda não existe.

- [ ] **Step 3: Implementar o núcleo mínimo**

Criar `MediaUploadCore.js` com:

```js
const TOPC_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const TOPC_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function topcMontarCanonical_(timestamp, requestId, sourceKey, bodyHash) {
  return [timestamp, requestId, sourceKey, bodyHash].join('\n');
}

function topcValidarUploadMidia_(media, mimeType, size, referencedMediaKeys) {
  if (!media || !media.fileId) throw new Error('Arquivo ID ausente.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(media.mediaKey || '')) {
    throw new Error('mediaKey inválida.');
  }
  if (TOPC_MEDIA_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error('MIME de imagem não permitido: ' + mimeType);
  }
  if (!Number.isInteger(size) || size <= 0 || size > TOPC_MEDIA_MAX_BYTES) {
    throw new Error('Tamanho de imagem inválido: ' + size);
  }
  if (media.role !== 'cover' && media.role !== 'inline') {
    throw new Error('Papel de imagem inválido.');
  }
  if (!Number.isInteger(media.position) || media.position < 0) {
    throw new Error('Posição de imagem inválida.');
  }
  if (referencedMediaKeys.indexOf(media.mediaKey) === -1) {
    throw new Error('Imagem não referenciada no envelope: ' + media.mediaKey);
  }
}

function topcMontarCabecalhosMidia_(media, sha256) {
  if (!/^[a-f0-9]{64}$/.test(sha256 || '')) {
    throw new Error('SHA-256 inválido.');
  }
  return {
    'x-media-key': media.mediaKey,
    'x-media-sha256': sha256,
    'x-media-role': media.role,
    'x-media-position': String(media.position)
  };
}
```

- [ ] **Step 4: Executar GREEN**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Expected: todos os testes da Task 1 passam.

- [ ] **Step 5: Commit**

```bash
git add automation/apps-script/MediaUploadCore.js automation/tests/apps-script-media-upload.test.mjs
git commit -m "test: define Apps Script media upload contract"
```

---

### Task 2: Cliente HMAC binário e comando de upload

**Files:**
- Modify: `automation/apps-script/Código.js`
- Modify: `automation/tests/apps-script-media-upload.test.mjs`

**Interfaces:**
- Consumes: helpers da Task 1, `topcObterMidiasConcluidas_`, `topcMontarEnvelopeSelecionado_`, `TOPC_SITE_AUTOMATION.BASE_URL` e `AUTOMATION_HMAC_SECRET`.
- Produces: `enviarImagensSiteSelecionadas()`, `topcEnviarImagemSite_(sourceKey, media, referencedMediaKeys)`, `topcEnviarBytesAssinados_(path, sourceKey, bytes, contentType, mediaHeaders)` e `topcSha256BytesHex_(bytes)`.

- [ ] **Step 1: Escrever testes RED do cliente binário**

No mesmo teste, carregar também `Código.js` em `vm` com doubles específicos para `Utilities`, `PropertiesService` e `UrlFetchApp`. Testar que `topcEnviarBytesAssinados_`:

- calcula o digest sobre o mesmo array `[0, 1, 127, -128, -1]` passado em `payload`;
- usa `topcMontarCanonical_`;
- inclui os quatro cabeçalhos HMAC e os quatro cabeçalhos de mídia;
- usa `contentType: 'image/webp'` e `muteHttpExceptions: true`;
- não converte bytes para string.

Testar também `topcValidarRespostaUpload_(200, 'foto.webp', '{}')`, `201` e rejeição de `400` com corpo truncado em 500 caracteres.

- [ ] **Step 2: Executar RED**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Expected: FAIL com `topcEnviarBytesAssinados_ is not defined`.

- [ ] **Step 3: Implementar hash e envio dos bytes**

Adicionar a `Código.js`:

```js
function topcSha256BytesHex_(bytes) {
  return topcBytesParaHex_(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
  );
}

function topcEnviarBytesAssinados_(
  path,
  sourceKey,
  bytes,
  contentType,
  mediaHeaders
) {
  const secret = PropertiesService.getScriptProperties()
    .getProperty('AUTOMATION_HMAC_SECRET');
  if (!secret) throw new Error('AUTOMATION_HMAC_SECRET não encontrado.');

  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = Utilities.getUuid();
  const bodyHash = topcSha256BytesHex_(bytes);
  const canonical = topcMontarCanonical_(
    timestamp,
    requestId,
    sourceKey,
    bodyHash
  );
  const headers = Object.assign({}, mediaHeaders, {
    'X-Automation-Timestamp': timestamp,
    'X-Automation-Request-Id': requestId,
    'X-Automation-Source-Key': sourceKey,
    'X-Automation-Signature': topcHmacSha256Hex_(canonical, secret)
  });

  return UrlFetchApp.fetch(TOPC_SITE_AUTOMATION.BASE_URL + path, {
    method: 'post',
    contentType: contentType,
    payload: bytes,
    headers: headers,
    muteHttpExceptions: true
  });
}
```

Adicionar `topcValidarRespostaUpload_` aceitando apenas 200/201 e lançando erro seguro com media key, HTTP e no máximo 500 caracteres da resposta.

- [ ] **Step 4: Implementar o envio individual**

`topcEnviarImagemSite_` deve abrir `DriveApp.getFileById(media.fileId)`, obter `blob.getBytes()` e `blob.getContentType()`, validar antes da rede, calcular SHA, montar headers e chamar:

```js
'/api/automation/articles/' +
  encodeURIComponent(sourceKey) +
  '/media'
```

Retornar `{ mediaKey, status: codigo === 201 ? 'created' : 'reused' }`.

- [ ] **Step 5: Implementar o comando público**

`enviarImagensSiteSelecionadas()` deve validar a aba/linha, ler `ID` e `Slug`, formar `sourceKey`, obter mídias, montar o envelope, extrair media keys dos blocos `image` e enviar sequencialmente. Registrar cada resultado e terminar com `SpreadsheetApp.getActiveSpreadsheet().toast`, sem `alert`.

- [ ] **Step 6: Executar GREEN e regressão sintática**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Run: `node --check automation/apps-script/Código.js`

Run: `node --check automation/apps-script/MediaUploadCore.js`

Expected: todos terminam com exit code 0.

- [ ] **Step 7: Commit**

```bash
git add automation/apps-script/Código.js automation/tests/apps-script-media-upload.test.mjs
git commit -m "feat: upload editorial media from Apps Script"
```

---

### Task 3: Menu, sincronização e validação integrada

**Files:**
- Modify: `automation/apps-script/Código.js`
- Modify: `automation/tests/apps-script-media-upload.test.mjs`

**Interfaces:**
- Consumes: `enviarImagensSiteSelecionadas()`.
- Produces: item `5. Enviar imagens ao site` no menu `Automação SEO`.

- [ ] **Step 1: Escrever teste RED do menu**

Criar um double encadeável de `SpreadsheetApp.getUi().createMenu()`, executar `onOpen()` e afirmar que foi registrado exatamente:

```js
['5. Enviar imagens ao site', 'enviarImagensSiteSelecionadas']
```

- [ ] **Step 2: Executar RED**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Expected: FAIL porque o item 5 ainda não existe.

- [ ] **Step 3: Adicionar item ao menu**

Antes de `.addToUi()`, adicionar:

```js
.addSeparator()
.addItem(
  '5. Enviar imagens ao site',
  'enviarImagensSiteSelecionadas'
)
```

- [ ] **Step 4: Executar todas as verificações locais**

Run: `node --test automation/tests/apps-script-media-upload.test.mjs`

Run: `node --check automation/apps-script/Código.js`

Run: `node --check automation/apps-script/MediaUploadCore.js`

Expected: todos terminam com exit code 0 e nenhum teste falha.

- [ ] **Step 5: Commit**

```bash
git add automation/apps-script/Código.js automation/tests/apps-script-media-upload.test.mjs
git commit -m "feat: expose site media upload command"
```

- [ ] **Step 6: Publicar no Apps Script após merge**

No PowerShell do usuário:

```powershell
cd "$HOME\Documents\top-comparativos"
git pull origin main
cd "automation\apps-script"
clasp push
```

Expected: `Pushed 3 files`, incluindo `MediaUploadCore.js`.

- [ ] **Step 7: Executar validação integrada**

Reabrir a planilha, selecionar a linha do artigo e executar `5. Enviar imagens ao site`. O registro deve mostrar quatro resultados `created` ou `reused`, sem HTTP fora de 200/201. Reabrir o preview do artigo 3 e confirmar visualmente a capa e três imagens internas.
