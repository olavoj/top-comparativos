# Editorial Cover and Metadata Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a classificação da imagem principal como capa e impedir que múltiplas palavras-chave secundárias vazem para o conteúdo público.

**Architecture:** Manter o fluxo atual e corrigir dois pontos isolados. `ZZMediaKeyFix.js` continuará sendo a fonte efetiva das mídias concluídas e ganhará um fallback determinístico de capa pelo basename `imagem-principal-*`; `EditorialNormalize.js` passará a consumir o bloco multilinha de palavras-chave secundárias até o H1. Testes Node/vm cobrirão as regressões antes das mudanças de produção.

**Tech Stack:** Google Apps Script JavaScript, Node.js `node:test`, `vm`, GitHub Actions/clasp.

## Global Constraints

- Não alterar contrato da API do site, HMAC, formato do envelope ou geração Gemini.
- Não regenerar imagens existentes.
- `Tipo imagem = Capa` continua tendo precedência normal.
- `imagem-principal-*` é fallback de capa para filas antigas/inconsistentes.
- Documentos sem `=== CONTEÚDO PARA PUBLICAÇÃO ===` mantêm comportamento legado.

---

### Task 1: Regressão da classificação de capa

**Files:**
- Modify: `automation/tests/apps-script-media-key-override.test.mjs`
- Modify: `automation/apps-script/ZZMediaKeyFix.js`

**Interfaces:**
- Consumes: linhas da `Fila de imagens` e `DriveApp.getFileById()`.
- Produces: `topcObterMidiasConcluidas_(linhaPauta, slug)` com objetos `{mediaKey,fileId,role,position,alt}`.

- [ ] **Step 1: Escrever testes falhando**

Adicionar casos que simulem: `Tipo imagem=Capa`; `Tipo imagem=Interna` com `imagem-principal-artigo.jpg`; e imagem interna comum. Esperar respectivamente `cover`, `cover`, `inline`, com `position=0` para capa.

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `node --test automation/tests/apps-script-media-key-override.test.mjs`
Expected: FAIL no caso `Interna + imagem-principal-*`, hoje classificado como `inline`.

- [ ] **Step 3: Implementar fallback mínimo**

Em `ZZMediaKeyFix.js`, substituir a decisão de role por lógica equivalente a:

```js
const tipoImagem = String(row[colunas['Tipo imagem']] || '').trim().toLowerCase();
const ehImagemPrincipal = /^imagem-principal-/i.test(nomeArquivoFila);
const role = tipoImagem === 'capa' || ehImagemPrincipal ? 'cover' : 'inline';
```

Preservar normalização de MIME/mediaKey e posições existentes.

- [ ] **Step 4: Executar teste e confirmar sucesso**

Run: `node --test automation/tests/apps-script-media-key-override.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add automation/tests/apps-script-media-key-override.test.mjs automation/apps-script/ZZMediaKeyFix.js
git commit -m "fix: recognize principal image as cover"
```

### Task 2: Regressão de palavras-chave secundárias multilinha

**Files:**
- Modify: `automation/tests/apps-script-editorial-normalize.test.mjs`
- Modify: `automation/apps-script/EditorialNormalize.js`

**Interfaces:**
- Consumes: `{title, excerpt, blocks, sources}`.
- Produces: `topcNormalizarRevisaoEditorial_(resultado)` sem metadados editoriais nos blocos públicos.

- [ ] **Step 1: Escrever teste falhando**

Criar documento com marcador, rótulos de valor único, `PALAVRAS-CHAVE SECUNDÁRIAS:`, três parágrafos de keywords, depois um bloco H1 e o primeiro parágrafo real. Verificar que nenhuma keyword aparece em `blocks`, enquanto H1 e primeiro parágrafo permanecem.

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `node --test automation/tests/apps-script-editorial-normalize.test.mjs`
Expected: FAIL porque a segunda keyword atualmente inicia o conteúdo público.

- [ ] **Step 3: Implementar consumo multilinha até H1**

Ao detectar `PALAVRAS-CHAVE SECUNDÁRIAS:`, avançar pelos parágrafos seguintes enquanto ainda estiver no trecho de metadados e parar quando o próximo bloco representar o H1. Preservar imagens conforme a lógica atual. Não incluir as keywords em `conteudo`.

Para manter o reconhecimento isolado e testável, usar helper equivalente a:

```js
function topcEhInicioH1_(bloco) {
  return bloco && (bloco.type === 'heading' || bloco.type === 'h1') &&
    (!bloco.level || Number(bloco.level) === 1);
}
```

Adaptar o helper ao formato real já usado pelos testes/blocos do projeto, sem alterar o contrato externo.

- [ ] **Step 4: Confirmar compatibilidade legado**

Manter/expandir testes para documento sem marcador e documento com uma única keyword secundária.

- [ ] **Step 5: Executar testes**

Run: `node --test automation/tests/apps-script-editorial-normalize.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add automation/tests/apps-script-editorial-normalize.test.mjs automation/apps-script/EditorialNormalize.js
git commit -m "fix: strip multiline editorial keywords"
```

### Task 3: Verificação integrada e entrega

**Files:**
- Verify: `automation/tests/*.test.mjs`
- Verify: `.github/workflows/*`

**Interfaces:**
- Produces: branch testada e pronta para integração em `main`.

- [ ] **Step 1: Rodar toda a suíte**

Run: `node --test automation/tests/*.test.mjs`
Expected: todos os testes PASS.

- [ ] **Step 2: Revisar diff contra main**

Confirmar que mudanças funcionais ficam restritas a classificação de capa e normalização de metadados; documentação de spec/plano é permitida.

- [ ] **Step 3: Abrir PR para main**

PR deve resumir os dois bugs, testes e indicar que nenhuma imagem precisa ser regenerada.

- [ ] **Step 4: Confirmar checks e integrar**

Aguardar checks aplicáveis; com tudo verde, integrar a branch em `main`.

- [ ] **Step 5: Confirmar deploy do Apps Script**

Verificar o workflow de deploy associado ao commit integrado e confirmar sucesso do `clasp push`.

- [ ] **Step 6: Reprocessar o artigo atual na ordem**

No Apps Script: enviar rascunho ao site, enviar imagens ao site, publicar artigo no site. Verificar depois a página pública: capa presente e início sem palavras-chave secundárias.
