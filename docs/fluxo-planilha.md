# Fluxo da planilha editorial

Menu `Automação SEO`, sempre com uma célula da linha da pauta selecionada
na aba `Pauta editorial`.

| # | Comando | Lê | Escreve |
|---|---------|----|---------|
| 1 | Pesquisar pauta selecionada | Título, Palavra-chave principal | Link da pesquisa, Status |
| 2 | Gerar artigo com Claude | Link da pesquisa | Slug (se vazio), Link do artigo, Status |
| 3 | Revisar artigo com Claude | Link da pesquisa, Link do artigo | Link da revisão, Status |
| 4 | Gerar imagens com Nano Banana | Link da revisão, Slug | Link final, Status das imagens, aba `Fila de imagens` |
| 5 | Enviar rascunho ao site | ID, Slug, Link final, Intenção | Versão no site |
| 6 | Enviar imagens ao site | ID, Slug, `Fila de imagens` | — |
| 7 | Publicar artigo no site | ID, Slug, Link final, Versão no site, Status das imagens | — |

A ordem importa. O passo 5 cria o artigo no site e grava `Versão no site`;
sem ele o passo 6 não tem artigo a que anexar as imagens e o passo 7 falha
com "A pauta não possui Versão no site".

Depois de qualquer correção no documento final, refaça 5, 6 e 7 nessa
ordem: o passo 7 publica exatamente a versão registrada no passo 5.

## Colunas obrigatórias na aba `Pauta editorial`

`ID`, `Título`, `Tipo`, `Pilar relacionado`, `Palavra-chave principal`,
`Intenção`, `Categoria`, `Status`, `Slug`, `Link da pesquisa`,
`Link do artigo`, `Link da revisão`, `Link final`, `Status das imagens`,
`Observações`, `Versão no site`.

A coluna `Versão no site` é criada automaticamente no passo 5 quando ainda
não existe. As demais precisam existir com o nome exato: os comandos
localizam as colunas pelo texto do cabeçalho.

## Erros comuns

**"Esta linha ainda não possui um link de pesquisa"** — o passo 1 não
gravou nada. Verifique se a coluna se chama exatamente `Link da pesquisa`.

**"Status das imagens precisa estar como Concluído"** — a fila terminou
com falhas e ficou em `Concluído com pendências`. Use
`Ferramentas > Reparar fila de imagens` e aguarde o gatilho reprocessar.

**"Imagem não referenciada no envelope"** — o documento final não contém
a imagem correspondente à linha concluída da fila. Confirme que a imagem
foi mesmo inserida no documento antes de repetir os passos 5 a 7.

**"A pauta não possui Versão no site"** — falta executar o passo 5.

## Propriedades do script

`PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` e
`AUTOMATION_HMAC_SECRET`, em Configurações do projeto > Propriedades do
script. `Ferramentas > Testar conexão com o site` valida o HMAC.
