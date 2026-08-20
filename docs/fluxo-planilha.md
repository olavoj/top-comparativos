# Fluxo da planilha editorial

Menu `Automação SEO`, sempre com uma célula da linha da pauta selecionada
na aba `Pauta editorial` — exceto os comandos `0` e `0b`, que rodam na
aba `Clusters SEO` (ver "Cluster SEO (opcional)" abaixo).

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

## Cluster SEO (opcional)

Ponto de partida antes de qualquer pauta existir: uma palavra-chave-semente
vira um plano de cluster (1 página pilar + 3 a 25 páginas satélites), que
depois cria as linhas correspondentes na aba `Pauta editorial` de uma vez.

Na aba `Clusters SEO` (criada automaticamente ao abrir a planilha),
preencha `Palavra-chave semente` e `Link da pesquisa` (um Doc com pesquisa
sobre o tema, no mesmo formato usado pelos passos `1`/`1b`) numa linha nova
e rode `0. Gerar cluster SEO`. O Claude retorna a arquitetura do cluster —
pilar, satélites, mapa de palavras-chave por página, análise da SERP,
regras de linkagem interna, diferenciais, fontes e riscos — validada campo
a campo com tool use forçado, igual ao plano SEO por artigo. Um Doc
"Cluster SEO — &lt;semente&gt;" é criado e `Status do cluster` vira
`Cluster gerado`.

A aprovação é manual: revise o Doc e edite `Status do cluster` para
`Aprovado`. Rodar `0` de novo sobre um cluster já aprovado gera um cluster
novo e limpa a aprovação anterior, mesma regra do plano SEO por artigo.

Com o cluster aprovado, rode `0b. Criar pautas do cluster aprovado`: cria
uma linha em `Pauta editorial` por página do cluster (`Tipo`, `Pilar
relacionado`, `Palavra-chave principal`, `Intenção`, `Categoria` e `Slug`
já preenchidos), pulando qualquer slug que já exista na aba — pode rodar
o comando mais de uma vez sem duplicar pautas. Cada linha criada segue o
fluxo normal a partir do passo `1`.

Ficam de fora do plano de cluster o calendário de publicação e as metas de
tráfego/afiliado: são úteis como leitura humana num plano manual, mas
nenhuma etapa da automação agiria sobre eles.

## Plano SEO (opcional)

O item `1c. Analisar SEO e gerar plano` lê a pesquisa da linha (`Link da
pesquisa`, seja do passo 1 ou do 1b) e pede ao Claude uma análise
estruturada — intenção de busca, mapa de palavras-chave, estrutura de
H2/H3, diferenciais, fontes e riscos — usando *tool use* forçado em vez
de texto livre. A resposta é validada campo a campo antes de qualquer
gravação; se vier incompleta ou em formato errado, a etapa para com
`Status do plano = Erro` e nada é criado.

Se a validação passar, um Doc "Plano SEO — &lt;título&gt;" é criado e
`Status do plano` vira `Plano gerado`. A aprovação é manual: edite essa
coluna para `Aprovado` depois de revisar o Doc. Enquanto não estiver
`Aprovado`, o `▶ Rodar fluxo completo (1-7)` para antes de gerar o
artigo e avisa qual é o status atual — pautas sem plano (coluna nunca
preenchida) seguem o fluxo de sempre, sem essa exigência.

Rodar `1c` de novo sobre uma pauta já aprovada gera um plano novo e
**limpa a aprovação anterior** (`Status do plano` volta para
`Plano gerado`, `Aprovado por`/`Aprovado em` ficam vazios) — a aprovação
vale para o conteúdo que foi revisado, não para qualquer coisa que venha
depois com o mesmo nome de coluna.

Com o plano aprovado, o passo `2. Gerar artigo com Claude` passa a usar
o **plano como fonte principal** — título recomendado, outline de
H2/H3, ângulo editorial e diferenciais — em vez de só a pesquisa bruta;
a pesquisa continua entrando no prompt, mas como apoio factual. Se
existir um plano para a linha e ele **não** estiver `Aprovado`, o passo
2 para com erro em vez de gerar o artigo, tanto rodando o item de menu
diretamente quanto via fluxo completo. Pautas sem plano (coluna nunca
preenchida) seguem exatamente como antes, só com a pesquisa.

## Colunas obrigatórias na aba `Pauta editorial`

`ID`, `Título`, `Tipo`, `Pilar relacionado`, `Palavra-chave principal`,
`Intenção`, `Categoria`, `Status`, `Slug`, `Link da pesquisa`,
`Link do artigo`, `Link da revisão`, `Link final`, `Status das imagens`,
`Observações`, `Versão no site`.

As colunas `Versão no site` (passo 5) e `Link do plano SEO`,
`Status do plano`, `Aprovado por`, `Aprovado em`, `Hash do plano`
(comando `1c`) são criadas automaticamente na primeira vez que o
comando correspondente roda, se ainda não existirem. As demais
precisam existir com o nome exato: os comandos localizam as colunas
pelo texto do cabeçalho.

## Gerar imagens manualmente (sem crédito no Gemini)

`Ferramentas > Pausar geração automática de imagens (Gemini)` pausa a fila
sem desligar o passo 4: `4. Gerar imagens com Nano Banana` continua criando
os marcadores no documento final e as linhas na aba `Fila de imagens` —
inclusive o prompt de cada imagem, pronto na coluna `Prompt` — mas não
instala mais o gatilho que chama a API do Gemini a cada minuto. `Status das
imagens` fica em `Na fila (geração pausada)` em vez de `Na fila`.

Fluxo com o modo pausado ativo:

1. Rode o passo 4 normalmente. A fila é criada, mas nada é gerado sozinho.
2. Abra a aba `Fila de imagens`, copie o texto da coluna `Prompt` de cada
   linha da pauta e gere a imagem em outra ferramenta.
3. Suba a imagem gerada numa pasta do Drive e pegue o ID do arquivo (na
   URL: `drive.google.com/file/d/ID_DO_ARQUIVO/view`).
4. Na mesma linha da fila, cole esse ID na coluna `ID do arquivo` (coluna
   M). Não precisa mexer em `Status` nem `Tentativas` — eles já ficam
   `Pendente` com a fila pausada.
5. Quando `Ferramentas > Retomar geração automática de imagens (Gemini)`
   rodar de novo (ou depois de repor crédito), o gatilho volta a
   processar a fila: qualquer linha com `ID do arquivo` preenchido pula o
   Gemini e só insere a imagem no documento; linhas sem ID tentam gerar
   pelo Gemini normalmente.

Use `Ferramentas > Reparar fila de imagens` a qualquer momento para
reabrir tarefas que ficaram `Falha`/`Erro temporário` (elas voltam para
`Pendente`) — com o modo pausado ativo, isso não reinstala o gatilho; use
"Retomar" para isso.

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

**"A Versão no site não está no formato ISO-8601"** — a planilha converteu
o texto da versão em data. Formate a coluna `Versão no site` como texto
simples (`Formatar > Número > Texto simples`) e refaça o passo 5.

**`HTTP 422: {"error":"editorial_publish_invalid"}`** — quem recusou foi o
site, não a planilha: o rascunho chegou lá, mas não passou na validação
editorial dele. O passo 7 não tem como saber o motivo exato, porque o site
devolve só o código. Verifique nesta ordem:

1. **Versão desatualizada.** O site troca a versão do artigo a cada
   gravação. Se o passo 7 já rodou antes, ou se houve qualquer alteração
   depois do passo 5, a `Versão no site` da planilha ficou velha. Refaça
   5, 6 e 7 nessa ordem — sem pular o 5.
2. **Artigo já publicado.** Confira a URL pública antes de repetir: uma
   publicação bem-sucedida também invalida a versão registrada.
3. **Exigências editoriais do site.** Rode
   `Ferramentas > Diagnosticar publicação` e leia o log: ele mostra
   fontes, produtos, capa, imagens do envelope e a versão enviada, sem
   publicar nada. O envelope hoje sempre envia `products: []`, e a
   validação de publicação do site exige pelo menos dois produtos com
   link de afiliado.

## Ferramentas

| Comando | Para quê |
|---------|----------|
| Testar conexão com o site | Valida o HMAC |
| Diagnosticar imagens da pauta | "Imagem não referenciada no envelope" |
| Diagnosticar publicação | Falhas do passo 7; não publica nada |
| Reparar fila de imagens | Fila parada em `Concluído com pendências` |
| Reabrir falhas de lista selecionadas | Imagens que falharam dentro de listas |
| Puxar dados do Search Console (últimas 3 semanas) | Desempenho das URLs publicadas |
| Pausar/Retomar geração automática de imagens (Gemini) | Ver "Gerar imagens manualmente" acima |

## Pesquisa ampliada (opcional)

O item `1b. Pesquisar (ampliada)` roda seis consultas ao Perplexity em vez
de uma — palavra-chave principal, variação comercial, informacional, de
comparação, de perguntas e de alternativas/problemas — e grava um único
Doc com os resultados brutos de cada consulta separados (URL, título,
domínio, data), sem misturar interpretação. Escreve na mesma coluna
`Link da pesquisa` que o passo 1 normal, então pode ser usada no lugar
dele a qualquer momento: o resto do fluxo não diferencia qual dos dois
gerou o documento.

Use quando quiser uma base de pesquisa mais ampla antes de aprovar um
plano de conteúdo; para pautas simples, o passo 1 original continua
suficiente e mais barato (uma chamada em vez de seis).

## Propriedades do script

`PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` e
`AUTOMATION_HMAC_SECRET`, em Configurações do projeto > Propriedades do
script. `Ferramentas > Testar conexão com o site` valida o HMAC.
