# Fluxo da planilha editorial

Menu `Automação SEO`, sempre com uma célula da linha da pauta selecionada
na aba `Pauta editorial`.

## Rodar o fluxo inteiro com um clique

O item `▶ Rodar fluxo completo (1-7)` roda as sete etapas em sequência
para a linha selecionada, sem publicar clique a clique. Cada etapa roda
numa execução separada, encadeada por um gatilho de poucos segundos, em
vez de tudo numa chamada só: pesquisa, geração de artigo e revisão usam
prompts grandes no Perplexity/Claude, e empilhar as três facilmente
estoura o limite de 6 minutos de execução do Apps Script (conta
gratuita), matando o fluxo no meio sem nenhuma imagem sequer chegar a
ser enfileirada. Rodando uma etapa por vez, cada chamada de API tem seu
próprio orçamento de tempo.

1. Executa pesquisa, artigo e revisão, uma etapa por clique de gatilho
   (pula qualquer etapa cujo link já esteja preenchido, então também
   serve para retomar uma pauta parada no meio).
2. Prepara a fila de imagens (etapa 4) — a fila roda em segundo plano,
   uma imagem por minuto, como já acontecia.
3. Quando a última imagem da fila termina, o script continua sozinho:
   envia o rascunho ao site, envia as imagens e **publica o artigo**,
   sem nenhum clique adicional.

Não precisa manter a planilha aberta enquanto o fluxo roda: os gatilhos
disparam no servidor. Só é possível ter uma linha em fluxo automático
por vez; tentar iniciar uma segunda antes da primeira terminar mostra um
aviso pedindo para aguardar.

Isso significa que o artigo pode ir do zero até publicado no site sem
revisão humana no meio do caminho. Os prompts de geração e revisão do
Claude continuam pedindo cautela editorial (não inventar dados, sinalizar
pontos a verificar), mas ninguém confere o texto antes de ir ao ar nesse
modo. Para manter a revisão humana, continue usando os itens 1 a 4 e só
rode 5, 6 e 7 manualmente depois de ler o documento final.

Se a fila de imagens terminar com falhas (`Concluído com pendências`), o
fluxo automático para antes de publicar: repare a fila
(`Ferramentas > Reparar fila de imagens`) e rode os passos 5 a 7 manualmente
depois. O andamento e qualquer erro do fluxo automático aparecem na coluna
`Observações` da linha.

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
