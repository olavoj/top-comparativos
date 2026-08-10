# Correção de capa e metadados editoriais

Data: 2026-08-09

## Objetivo

Corrigir dois defeitos do pipeline editorial que afetam artigos publicados:

1. a imagem principal pode ser tratada como imagem interna quando a fila registra `Tipo imagem = Interna`, fazendo o artigo ficar sem capa no site;
2. o bloco `PALAVRAS-CHAVE SECUNDÁRIAS:` do documento revisado pode conter várias linhas, mas o normalizador atual consome apenas a primeira e publica as demais no início do artigo.

A correção deve funcionar para o artigo atual e para novas pautas, sem exigir regeneração de imagens.

## Escopo

A mudança fica restrita ao Apps Script e aos testes de regressão associados. Não haverá alteração no contrato da API do site, no HMAC, no formato do envelope, no fluxo de publicação ou na geração de imagens pelo Gemini além da classificação da mídia principal.

## Classificação da capa

A função que transforma linhas concluídas da `Fila de imagens` em mídias do envelope deve continuar respeitando `Tipo imagem = Capa` quando esse valor já estiver presente.

Como fallback para filas antigas ou inconsistentes, um arquivo cujo basename comece com `imagem-principal-` deve ser classificado como `role = cover`, mesmo que `Tipo imagem` esteja como `Interna`.

Todas as demais mídias continuam como `inline`.

A posição permanece:

- `cover`: `position = 0`;
- `inline`: posições sequenciais a partir de zero.

O fallback deve ser determinístico e não depender do slug específico do artigo.

## Normalização de metadados da revisão

Depois do marcador `=== CONTEÚDO PARA PUBLICAÇÃO ===`, o normalizador continua reconhecendo os rótulos editoriais existentes, incluindo `TÍTULO SEO:`, `META DESCRIPTION:`, `SLUG:`, `PALAVRA-CHAVE PRINCIPAL:` e `PALAVRAS-CHAVE SECUNDÁRIAS:`.

Para rótulos de valor único, o comportamento atual permanece: consumir a próxima linha de parágrafo como valor.

Para `PALAVRAS-CHAVE SECUNDÁRIAS:`, o normalizador deve consumir todas as linhas consecutivas de texto até encontrar o H1 que inicia o artigo. Essas linhas são metadados e nunca devem ser adicionadas aos blocos públicos.

O H1 e todo o conteúdo a partir dele permanecem no fluxo normal do artigo. Imagens que aparecem no trecho de metadados continuam preservadas conforme a lógica existente.

## Compatibilidade

Documentos sem o marcador de revisão mantêm o comportamento legado.

Documentos com uma única palavra-chave secundária continuam produzindo o mesmo conteúdo público.

Filas que já usam `Tipo imagem = Capa` continuam funcionando sem mudança.

Filas antigas em que `imagem-principal-*` esteja marcada como `Interna` passam a gerar corretamente uma mídia `cover`.

## Fluxo esperado para o artigo atual

1. Montar novamente o envelope a partir do Google Docs final.
2. A mídia `imagem-principal-sanduicheira-eletrica.jpg` deve aparecer como `cover`.
3. Nenhuma das palavras-chave secundárias deve aparecer como bloco do artigo.
4. Reenviar o rascunho ao site para registrar a versão corrigida.
5. Reenviar as imagens ao site usando as mesmas media keys normalizadas.
6. Publicar a nova versão.
7. Verificar visualmente a página pública: capa presente e início do artigo começando no conteúdo editorial, sem lista de palavras-chave.

## Testes

Adicionar regressões que comprovem:

- `Tipo imagem = Capa` continua gerando `role = cover`;
- `Tipo imagem = Interna` com nome `imagem-principal-*.jpg` gera `role = cover`;
- uma mídia interna comum continua `inline`;
- múltiplas linhas após `PALAVRAS-CHAVE SECUNDÁRIAS:` são removidas dos blocos públicos;
- o H1 e o primeiro parágrafo real permanecem no conteúdo;
- documento sem marcador de revisão mantém o comportamento legado;
- testes existentes de envelope, upload de mídia e publicação continuam passando.

## Critérios de sucesso

A correção está concluída quando os testes passam, a mudança chega ao `main`, o Apps Script é implantado com sucesso e o artigo da sanduicheira pode ser reenviado/publicado com capa e início do conteúdo corretos, sem regenerar as imagens existentes.
