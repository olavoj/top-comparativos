# Apps Script Publish Command Design

## Objetivo

Adicionar ao menu `Automação SEO` o comando `6. Publicar artigo no site`, sem janela de confirmação. O comando deve publicar automaticamente a pauta selecionada somente quando as validações locais e as validações autoritativas do site forem aprovadas.

## Escopo

A primeira versão publica somente a linha ativa da aba `Pauta editorial`. Ela usa o rascunho que já foi enviado ao site e as mídias que já foram processadas pelo comando de upload. Não recria o rascunho, não gera imagens, não altera conteúdo editorial e não encadeia ainda as etapas anteriores.

A ausência de confirmação é intencional: clicar no comando inicia a tentativa de publicação imediatamente.

## Estratégia

Será usada validação dupla.

O Apps Script executa um pré-check barato para impedir chamadas claramente inválidas. O site continua sendo a autoridade final: somente o endpoint de publicação pode promover o snapshot de rascunho para publicado.

Essa divisão permite, no futuro, chamar a mesma função automaticamente depois do upload de imagens, sem criar uma segunda lógica de publicação.

## Pré-validações no Apps Script

Antes da rede, o comando deve:

1. exigir a aba `Pauta editorial` e uma linha de artigo;
2. exigir `ID`, `Slug` e `Link final`;
3. exigir `Status das imagens` igual a `Concluído`;
4. formar o `sourceKey` como `pauta-{ID}`;
5. montar o envelope atual e garantir que ele tenha conteúdo editorial válido;
6. obter as mídias concluídas da pauta e garantir que cada `mediaKey` retornada esteja referenciada por um bloco `image` do envelope.

O Apps Script não tenta provar que os objetos já existem no armazenamento do site. Essa verificação pertence ao servidor e evita duplicar estado entre Google Sheets e o banco do site.

## Chamada de publicação

A função pública será `publicarArtigoSiteSelecionado()`.

Ela fará POST autenticado por HMAC para:

`/api/automation/articles/{sourceKey}/publish`

O corpo será JSON determinístico e mínimo. A implementação deve confirmar o contrato atual da rota antes de codificar o payload e usar o mesmo cliente HMAC já utilizado pelo envio de rascunho. O `sourceKey` do cabeçalho e da rota deve ser idêntico.

## Resultado

Somente respostas de sucesso definidas pelo contrato da rota serão aceitas. Em sucesso, o comando deve:

- registrar no Cloud Logging o `sourceKey`, slug e resultado da publicação;
- mostrar um `toast` não bloqueante informando que o artigo foi publicado;
- não modificar colunas da planilha nesta versão, evitando conflito com validações existentes de `Status`.

A URL pública será registrada somente se a API a devolver explicitamente. O cliente não deve inventar um padrão de URL.

## Erros e atomicidade

Qualquer falha nas pré-validações interrompe antes da rede.

Qualquer HTTP de erro gera exceção com código, `sourceKey` e resposta truncada. Segredo HMAC e assinatura nunca entram em logs ou mensagens.

Se o site rejeitar conteúdo, mídia, links internos ou concorrência, nada deve ser marcado como publicado no Apps Script. A promoção do snapshot continua atômica no servidor.

Reexecutar o comando deve ser seguro conforme o contrato idempotente da rota de publicação.

## Menu

O menu passa a ter:

`6. Publicar artigo no site` → `publicarArtigoSiteSelecionado`

O novo item fica depois de `5. Enviar imagens ao site`.

## Testes

Os testes locais devem cobrir:

- seleção fora de `Pauta editorial`;
- ausência de ID, slug, Link final e Status das imagens;
- rejeição quando `Status das imagens` não for `Concluído`;
- formação exata de `sourceKey` e rota de publish;
- uso do cliente HMAC sem registrar segredo ou assinatura;
- aceitação somente dos códigos de sucesso do contrato da rota;
- erro HTTP com corpo truncado;
- registro do item 6 no menu após o item 5;
- ausência de diálogo de confirmação.

A validação integrada final usa a pauta atual `guia-completo-potes-hermeticos`: o comando deve publicar o artigo e uma segunda execução deve permanecer segura.
