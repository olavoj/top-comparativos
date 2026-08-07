# Apps Script GitHub Actions Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar deploy manual do Apps Script pelo GitHub Actions usando clasp e autenticação armazenada em GitHub Secret.

**Architecture:** Um workflow `workflow_dispatch` executa em Ubuntu, instala Node.js e `@google/clasp`, grava `secrets.CLASPRC_JSON` em `~/.clasprc.json` e executa `clasp push` no diretório `automation/apps-script`. O `.clasp.json` existente determina o projeto Apps Script de destino.

**Tech Stack:** GitHub Actions, Node.js LTS, `@google/clasp`, Google Apps Script.

## Global Constraints
- Deploy somente manual no MVP.
- Não versionar credenciais Google.
- Usar o `.clasp.json` existente em `automation/apps-script/`.
- Não imprimir `CLASPRC_JSON` nos logs.

---

### Task 1: Workflow manual de deploy

**Files:**
- Create: `.github/workflows/deploy-apps-script.yml`

**Interfaces:**
- Consumes: GitHub Secret `CLASPRC_JSON`; `automation/apps-script/.clasp.json`.
- Produces: deploy dos arquivos Apps Script por `clasp push`.

- [ ] **Step 1: Criar workflow exclusivamente manual**

```yaml
name: Deploy Apps Script

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install clasp
        run: npm install --global @google/clasp

      - name: Configure clasp authentication
        env:
          CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
        run: |
          test -n "$CLASPRC_JSON" || { echo "Missing CLASPRC_JSON secret"; exit 1; }
          printf '%s' "$CLASPRC_JSON" > "$HOME/.clasprc.json"
          chmod 600 "$HOME/.clasprc.json"

      - name: Push Apps Script
        working-directory: automation/apps-script
        run: clasp push
```

- [ ] **Step 2: Validar sintaxe e gatilho**

Confirmar que o arquivo contém somente `workflow_dispatch` em `on` e que `clasp push` roda em `automation/apps-script`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-apps-script.yml
git commit -m "ci: add manual Apps Script deploy"
```

### Task 2: Configuração e primeiro deploy

**Files:**
- No repository file changes required.

**Interfaces:**
- Consumes: conteúdo válido de `~/.clasprc.json` obtido de uma sessão autenticada do clasp.
- Produces: GitHub Secret `CLASPRC_JSON` e primeiro workflow run.

- [ ] **Step 1: Criar o GitHub Secret**

Em GitHub > Settings > Secrets and variables > Actions > New repository secret, criar `CLASPRC_JSON` com o conteúdo integral do arquivo `~/.clasprc.json` de uma máquina onde `clasp login` tenha sido concluído.

- [ ] **Step 2: Executar deploy manual**

Em GitHub > Actions > Deploy Apps Script > Run workflow, executar na branch `main`.

- [ ] **Step 3: Verificar resultado**

O job `Push Apps Script` deve terminar com exit code 0. Se falhar por autenticação, corrigir somente `CLASPRC_JSON`; não adicionar tokens ao repositório.
