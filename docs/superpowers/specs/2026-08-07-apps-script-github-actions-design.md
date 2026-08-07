# Apps Script GitHub Actions Deploy — Design

## Objetivo
Permitir deploy manual dos arquivos em `automation/apps-script/` para o Google Apps Script sem depender de Node.js/clasp instalado na máquina local.

## Arquitetura
- GitHub Actions com gatilho exclusivamente `workflow_dispatch` no MVP.
- Runner Ubuntu instala Node.js LTS e `@google/clasp`.
- A autenticação do clasp é reconstruída em `~/.clasprc.json` a partir do GitHub Secret `CLASPRC_JSON`.
- O workflow executa `clasp push` dentro de `automation/apps-script`, usando o `.clasp.json` já versionado.
- Nenhum deploy ocorre automaticamente em `push` ou `pull_request`.

## Segurança
- Credenciais do Google nunca entram no repositório.
- `CLASPRC_JSON` existe somente como GitHub Actions Secret.
- O workflow não imprime o conteúdo do segredo nos logs.
- O deploy é iniciado manualmente pelo proprietário do repositório.

## Fluxo
1. Código é alterado e commitado no GitHub.
2. Usuário abre Actions > Deploy Apps Script > Run workflow.
3. Runner faz checkout.
4. Configura Node.js.
5. Instala clasp.
6. Materializa `~/.clasprc.json` usando `CLASPRC_JSON`.
7. Executa `clasp push` em `automation/apps-script`.
8. Action termina com sucesso ou apresenta o erro do clasp nos logs.

## Critério de sucesso
Um Run workflow concluído com sucesso atualiza o projeto Google Apps Script indicado em `automation/apps-script/.clasp.json`, sem exigir Node.js ou clasp na máquina do usuário.
