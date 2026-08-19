// Estruturas editoriais por tipo de pauta.
// Escopo global compartilhado com Código.js (sem imports, ambiente Apps Script).
// Depende de topcSlugificar_, definida em Código.js.

const TOPC_ESTRUTURAS = {
  Pilar: {
    tamanho: 'Entre 2.500 e 3.500 palavras',
    papel:
      'Este é o POST PILAR do cluster. Ele cobre a categoria inteira e ' +
      'serve de porta de entrada. Os artigos satélites vão linkar para cá.',
    esqueleto: `
# [Título do guia]

[Introdução: o problema que o leitor tem, em 2 ou 3 parágrafos. Sem
lista de tópicos, sem "neste guia você vai aprender".]

## Como escolher [categoria]

[Os critérios que importam de verdade. Explique cada um e diga quando
ele NÃO importa. Esta é a seção mais valiosa do pilar.]

## [Subtema 1 do cluster]

[Visão geral do subtema, com 2 a 4 parágrafos. Termine com um
LINK-INTERNO para o satélite que aprofunda o assunto.]

[LINK-INTERNO: slug-do-satelite-1]

## [Subtema 2 do cluster]

[Mesmo formato.]

[LINK-INTERNO: slug-do-satelite-2]

## [Subtema 3 do cluster]

[Mesmo formato.]

## Erros comuns na hora de comprar

[3 a 5 erros concretos. Sem moralismo, sem "muitas pessoas acabam".]

## Perguntas frequentes

[6 a 8 perguntas. Respostas de 2 a 4 frases.]
`
  },

  Comparativo: {
    tamanho: 'Entre 1.400 e 2.200 palavras',
    papel:
      'Este é um SATÉLITE de comparação direta. Deve linkar para o pilar ' +
      'do cluster ao menos uma vez, no início ou no meio do texto.',
    esqueleto: `
# [Título do comparativo]

[Resposta direta logo no primeiro parágrafo: qual escolher e para quem.
O leitor que parar aqui já foi atendido.]

## O que separa os dois

[2 ou 3 diferenças que realmente mudam a decisão. Não liste specs.]

## Tabela comparativa

[Tabela apenas com atributos que diferem entre os produtos. Se um
atributo é igual nos dois, ele não entra na tabela.]

## [Produto A]

[O que ele faz bem, onde ele falha, para quem serve.]

## [Produto B]

[Mesmo formato.]

## Qual escolher

[Recomendação por perfil de uso. Dois ou três perfis, não mais.]

[LINK-INTERNO: ${'${pauta.pilarSlug}'}]
`
  },

  Review: {
    tamanho: 'Entre 1.200 e 1.800 palavras',
    papel:
      'Este é um SATÉLITE de produto único. Deve linkar para o pilar ' +
      'do cluster e para ao menos um comparativo do mesmo cluster.',
    esqueleto: `
# [Título do review]

[Para quem esse produto serve, no primeiro parágrafo. E para quem não
serve, no segundo.]

## Ficha técnica relevante

[Só o que muda a decisão de compra. Nunca a ficha completa do fabricante.]

## [Aspecto principal do produto]

[Análise do que mais importa nessa categoria.]

## [Aspecto secundário]

## Limitações

[Onde o produto decepciona ou não atende. Seja específico. Um review sem
limitações não tem credibilidade.]

## Alternativas

[LINK-INTERNO: ${'${pauta.pilarSlug}'}]
`
  },

  Lista: {
    tamanho: 'Entre 1.500 e 2.400 palavras',
    papel:
      'Este é um SATÉLITE de seleção. Deve linkar para o pilar do cluster.',
    esqueleto: `
# [Título da lista]

[Critério de seleção em 1 ou 2 parágrafos: por que esses e não outros.]

## Como selecionamos

[Os critérios objetivos aplicados. Curto, 1 parágrafo.]

## [Produto 1] — [melhor para X]

[Por que ele lidera esse perfil. Onde ele perde.]

## [Produto 2] — [melhor para Y]

## [Produto 3] — [melhor para Z]

[Entre 4 e 7 itens no total. Cada um com um perfil de uso distinto:
se dois itens servem ao mesmo perfil, um deles não deveria estar aqui.]

## Resumo por perfil

[LINK-INTERNO: ${'${pauta.pilarSlug}'}]
`
  }
};

function topcObterEstrutura_(tipo) {
  const normalizado = String(tipo || '').trim();

  if (TOPC_ESTRUTURAS[normalizado]) {
    return TOPC_ESTRUTURAS[normalizado];
  }

  const chave = Object.keys(TOPC_ESTRUTURAS).find(function (nome) {
    return normalizado.toLowerCase().indexOf(nome.toLowerCase()) !== -1;
  });

  if (!chave) {
    throw new Error(
      'Tipo de pauta não reconhecido: "' + normalizado + '". ' +
      'Use um destes: ' + Object.keys(TOPC_ESTRUTURAS).join(', ') + '.'
    );
  }

  return TOPC_ESTRUTURAS[chave];
}

// Regras de estilo compartilhadas por todos os tipos.
const TOPC_REGRAS_ESTILO = `
ANTIPADRÕES PROIBIDOS

- Regra de três decorativa: "prático, versátil e acessível".
  Use dois adjetivos ou quatro, nunca três em sequência.
- Paralelismo negativo: "não é apenas X, é Y" / "mais que X, é Y".
- Atribuição vaga: "especialistas apontam", "estudos mostram",
  "é amplamente reconhecido". Cite a fonte ou corte a frase.
- Abertura de enciclopédia: "No mundo de hoje", "Nos dias atuais",
  "Quando se trata de", "Com o avanço da tecnologia".
- Fechamento de resumo: "Em resumo", "Em suma", "Portanto, fica claro",
  "Vale lembrar que".
- Gerúndio analítico raso: "ajudando a garantir", "permitindo que",
  "refletindo a importância de".
- Vocabulário inflado: crucial, fundamental, essencial, robusto,
  versátil, aprimorar, elevar, transformar, otimizar.
- Travessão: no máximo um no artigo inteiro.
- Encerrar toda seção com uma frase-conclusão. Termine seco.

VARIAÇÃO OBRIGATÓRIA

- Alterne o comprimento das frases. Inclua ao menos cinco frases
  com menos de oito palavras.
- Nem todo H2 precisa de H3 abaixo.
- Não abra dois parágrafos seguidos com a mesma estrutura sintática.
- Quando faltar dado confiável, diga isso. "Não encontrei medição
  independente do consumo" é melhor que preencher com genérico.
- Use FAQ apenas quando o tema gerar dúvidas reais e específicas.
  Se as perguntas ficarem óbvias, corte a seção inteira.
`;

const TOPC_REGRAS_EDITORIAIS = `
REGRAS EDITORIAIS

- Escreva em português do Brasil.
- Não copie frases das fontes.
- Não faça enchimento para atingir o tamanho. Se o tema não sustenta
  o número de palavras, entregue menos e sinalize no fim.
- Não invente produtos, preços, ASINs ou especificações.
- Não afirme que testamos produtos fisicamente.
- Não use "testamos", "comprovamos", "nossa equipe usou", "em nossos
  testes" ou qualquer variação que sugira experiência direta.
- Não atribua o texto a uma pessoa nem crie assinatura de autor.
- Diferencie informação confirmada de hipótese.
- Não prometa resultados absolutos.
- Não crie links de afiliado.
- Não transforme opinião de outro site em fato.
- Não inclua preço, pois muda.
- O texto será submetido a revisão humana antes de publicar.
`;

function montarPromptArtigo_(pauta, pesquisa, plano) {
  const estrutura = topcObterEstrutura_(pauta.tipo);
  const pilarSlug = topcSlugificar_(pauta.pilar || '');

  const esqueleto = estrutura.esqueleto.replace(
    /\$\{pauta\.pilarSlug\}/g,
    pilarSlug || 'slug-do-pilar'
  );

  // Com plano aprovado, ele é a fonte principal de ângulo editorial e
  // diferenciais — a pesquisa vira apoio para fatos e fontes, não a
  // base da estrutura (que continua vindo do esqueleto por tipo de
  // pauta acima). Sem plano (pauta legada), o comportamento não muda:
  // a pesquisa continua sendo a única fonte, como sempre foi.
  const secaoPlano = plano
    ? `
PLANO SEO APROVADO (fonte principal de ângulo e diferenciais — siga o
título recomendado, a intenção de busca e os diferenciais definidos
aqui; use a pesquisa abaixo só como apoio factual. A estrutura de
seções continua sendo a do esqueleto por tipo de pauta, mais abaixo)

${plano}
`
    : '';

  const instrucaoFonte = plano
    ? 'Use o plano SEO acima como fonte principal de ângulo e ' +
      'diferenciais do artigo. Se ele recomendar um título ou slug ' +
      'diferente do informado abaixo, use o do plano.'
    : 'Use a pesquisa abaixo como fonte principal do artigo.';

  return `
Você é o redator do Top Comparativos, um site brasileiro de conteúdo
informativo, reviews e comparativos.

Escreva um artigo original, útil e editorialmente responsável.

PAPEL DESTE ARTIGO NO CLUSTER

${estrutura.papel}

INFORMAÇÕES DA PAUTA

Título inicial: ${pauta.titulo}
Tipo: ${pauta.tipo}
Palavra-chave principal: ${pauta.palavraChave}
Intenção: ${pauta.intencao}
Categoria: ${pauta.categoria}
Slug: ${pauta.slug}
Pilar relacionado: ${pauta.pilar || 'Este artigo é o pilar'}
Tamanho esperado: ${estrutura.tamanho}
${secaoPlano}
${instrucaoFonte}

PESQUISA EDITORIAL

${pesquisa}

METADADOS (entregue antes do artigo)

TÍTULO SEO:
[Até 60 caracteres]

META DESCRIPTION:
[Entre 140 e 160 caracteres]

SLUG:
${pauta.slug}

PALAVRA-CHAVE PRINCIPAL:
${pauta.palavraChave}

PALAVRAS-CHAVE SECUNDÁRIAS:
[Liste termos relacionados]

ESTRUTURA DO ARTIGO

Siga o esqueleto abaixo. Os colchetes são instruções, não devem
aparecer no texto final. Adapte os títulos ao tema, mas mantenha a
ordem e a função de cada seção.

${esqueleto}

MARCADORES

[IMAGEM: imagem-principal-${pauta.slug}.webp]

Insira o marcador de imagem principal logo após a introdução e
sugira imagens adicionais apenas onde ajudarem o leitor.

${TOPC_REGRAS_ESTILO}

${TOPC_REGRAS_EDITORIAIS}

AVISO EDITORIAL:
Este conteúdo tem caráter informativo. Verifique sempre as orientações
do fabricante antes de utilizar qualquer produto.

FONTES PARA REVISÃO:
[Liste as URLs presentes na pesquisa]
`;
}
