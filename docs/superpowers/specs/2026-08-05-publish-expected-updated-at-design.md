# Publicação por versão do rascunho

Data: 2026-08-05

## Objetivo

Corrigir o comando "6. Publicar artigo no site" para cumprir o contrato da rota `POST /api/automation/articles/{sourceKey}/publish`, que exige exatamente `{"expectedUpdatedAt":"..."}`.

## Fonte da versão

A resposta de sucesso do envio de rascunho já retorna `article.updatedAt`. O Apps Script deve persistir esse valor na mesma linha da aba `Pauta editorial`, em uma coluna `Versão no site`.

Se a coluna ainda não existir, o fluxo de envio do rascunho deve criá-la uma única vez no final do cabeçalho e gravar o valor na linha selecionada.

## Publicação

`publicarArtigoSiteSelecionado` deve:

1. Ler `Versão no site` da linha selecionada.
2. Bloquear antes da chamada HTTP quando a versão estiver vazia.
3. Enviar `JSON.stringify({ expectedUpdatedAt: contexto.versaoSite })` usando o HMAC já existente.
4. Manter as validações atuais de ID, slug, Link final, imagens concluídas, blocos e referências de mídia.
5. Tratar HTTP 200 como sucesso e preservar os erros retornados pelo Site.

A publicação não deve reenviar o rascunho automaticamente e não deve adivinhar uma versão.

## Fluxo esperado

Enviar rascunho -> resposta com `updatedAt` -> gravar `Versão no site` -> upload/validação de mídia -> publicar usando a mesma versão.

## Compatibilidade

Para pautas enviadas antes desta alteração, `Versão no site` estará vazia. O usuário deverá executar "Enviar rascunho ao site" uma vez para registrar a versão; depois o fluxo volta a ser automático.

## Testes

Os testes devem demonstrar primeiro a falha atual e depois validar:

- o envio do rascunho persiste o `article.updatedAt` na linha;
- a publicação é bloqueada sem `Versão no site`;
- o corpo assinado contém exatamente `expectedUpdatedAt`;
- nenhum campo extra é enviado;
- o fluxo existente de mídia e menu continua funcionando.
