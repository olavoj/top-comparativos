# Apps Script Media Upload Design

## Objetivo

Adicionar ao menu de automação editorial um comando separado, “Enviar imagens ao site”, que envie ao site as imagens concluídas da pauta selecionada sem publicar o artigo.

## Escopo

A primeira versão processa somente a linha ativa da aba `Pauta editorial`. Ela reutiliza os dados da aba `Fila de imagens`, o segredo HMAC já configurado nas propriedades do Apps Script e o endpoint de mídia já implantado no site.

Não faz parte desta etapa publicar o artigo, gerar novas imagens, alterar o documento editorial ou unir automaticamente o upload ao envio do rascunho.

## Fluxo

1. Validar que a aba ativa é `Pauta editorial` e que uma linha de artigo está selecionada.
2. Ler o ID da pauta e formar o `sourceKey` no padrão `pauta-{ID}`.
3. Obter o slug e as mídias concluídas com `topcObterMidiasConcluidas_`.
4. Montar novamente o envelope e confirmar que cada `mediaKey` da fila aparece em um bloco `image` do rascunho.
5. Para cada mídia, abrir o arquivo pelo `Arquivo ID` no Google Drive e obter os bytes e o MIME type.
6. Aceitar somente JPEG, PNG e WebP, com limite máximo de 10 MiB por arquivo.
7. Calcular o SHA-256 hexadecimal dos bytes exatos.
8. Assinar os mesmos bytes com o protocolo HMAC existente e enviar um POST para `/api/automation/articles/{sourceKey}/media`.
9. Enviar os cabeçalhos `x-media-key`, `x-media-sha256`, `x-media-role`, `x-media-position` e `content-type`.
10. Interpretar HTTP 201 como mídia criada e HTTP 200 como mídia reutilizada.
11. Registrar o resultado de cada arquivo e apresentar um resumo final não bloqueante.

## Componentes

- `enviarImagensSiteSelecionadas`: comando público chamado pelo menu.
- `topcEnviarImagemSite_`: envia uma mídia e valida a resposta HTTP.
- `topcEnviarBytesAssinados_`: variante binária do cliente HMAC; calcula o hash e assina os bytes exatos enviados.
- Funções puras auxiliares para validar MIME, tamanho, cabeçalhos e construir a rota.

## Segurança e idempotência

O segredo HMAC permanece apenas em `PropertiesService` e nunca é registrado. O corpo assinado é exatamente o vetor de bytes enviado por `UrlFetchApp`. O nome do arquivo continua sujeito ao formato de basename seguro já aplicado pela fila. Reexecutar o comando é seguro: o servidor pode retornar HTTP 200 quando o mesmo conteúdo já estiver armazenado.

## Erros

O comando interrompe no primeiro arquivo inválido ou resposta diferente de 200/201. A mensagem identifica o `mediaKey`, o código HTTP e uma resposta truncada, sem incluir segredo ou assinatura. Arquivos com MIME não permitido, tamanho zero, mais de 10 MiB, ID ausente ou referência ausente no envelope são rejeitados antes do envio.

## Testes

Os testes locais devem cobrir:

- construção do canonical HMAC para bytes;
- hash SHA-256 hexadecimal de bytes conhecidos;
- validação de MIME e limite de 10 MiB;
- cabeçalhos de capa e imagem interna;
- aceitação de HTTP 200 e 201;
- rejeição de mídia não referenciada no envelope;
- interrupção e mensagem segura em erro HTTP.

A validação integrada final será feita no Apps Script com a pauta atual: quatro arquivos devem ser enviados ou reutilizados e o preview deve renderizar as quatro imagens.
