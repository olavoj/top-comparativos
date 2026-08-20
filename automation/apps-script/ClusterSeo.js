// Etapa 0 do fluxo editorial: uma palavra-chave-semente vira um plano de
// cluster (pilar + páginas satélites) antes de qualquer pauta existir.
// Mesmo princípio do plano SEO por artigo (AnaliseSeo.js/PlanoSeo.js):
// tool use forçado no Claude, validação campo a campo, Doc legível e
// aprovação manual via coluna de status — só que aqui a aprovação libera
// a criação em massa de linhas na aba "Pauta editorial", não a geração
// de um artigo.
//
// Fica de fora do schema tudo que o resto da automação não consome
// (calendário de publicação, KPIs de tráfego/afiliado): são úteis como
// leitura humana, mas nenhuma etapa do fluxo agiria sobre eles, e cada
// campo a mais é mais uma chance de o Claude falhar a validação.

const TOPC_CLUSTER_TIPOS_SATELITE = ['Satélite', 'Review', 'Comparativo'];

const TOPC_PAGE_SCHEMA_CLUSTER = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type', 'title', 'slug', 'primary_keyword', 'intent',
    'category', 'funnel_stage', 'objective', 'keyword_map'
  ],
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    slug: { type: 'string' },
    primary_keyword: { type: 'string' },
    intent: { type: 'string' },
    category: { type: 'string' },
    funnel_stage: { type: 'string' },
    objective: { type: 'string' },
    keyword_map: {
      type: 'object',
      additionalProperties: false,
      required: ['secondary', 'questions'],
      properties: {
        secondary: { type: 'array', items: { type: 'string' } },
        questions: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};

const TOPC_TOOL_CLUSTER_SEO = {
  name: 'registrar_cluster_seo',
  description:
    'Registra o plano de cluster de conteúdo (página pilar + páginas ' +
    'satélites) a partir de uma palavra-chave-semente e da pesquisa ' +
    'fornecida.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'seed_keyword', 'language', 'country', 'pillar', 'satellites',
      'serp_analysis', 'internal_linking', 'differentiation', 'sources',
      'risks', 'human_review'
    ],
    properties: {
      seed_keyword: { type: 'string' },
      language: { type: 'string' },
      country: { type: 'string' },
      pillar: TOPC_PAGE_SCHEMA_CLUSTER,
      satellites: { type: 'array', items: TOPC_PAGE_SCHEMA_CLUSTER },
      serp_analysis: {
        type: 'object',
        additionalProperties: false,
        required: ['formats', 'patterns', 'content_gaps', 'competitor_urls'],
        properties: {
          formats: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          content_gaps: { type: 'array', items: { type: 'string' } },
          competitor_urls: { type: 'array', items: { type: 'string' } }
        }
      },
      internal_linking: { type: 'array', items: { type: 'string' } },
      differentiation: { type: 'array', items: { type: 'string' } },
      sources: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      human_review: { type: 'array', items: { type: 'string' } }
    }
  }
};

function montarPromptClusterSeo_(seedKeyword, pesquisaTexto) {
  return `
Você é um estrategista de SEO editorial brasileiro especializado em sites
de afiliado. A partir da palavra-chave-semente e da pesquisa abaixo,
registre um plano de cluster de conteúdo usando a ferramenta
"registrar_cluster_seo".

PALAVRA-CHAVE-SEMENTE
${seedKeyword}

PESQUISA COLETADA
${pesquisaTexto}

REGRAS OBRIGATÓRIAS

- Um cluster tem exatamente uma página pilar ("pillar", type "Pilar") e
  de 3 a 25 páginas satélites ("satellites"), cada uma com type
  "Satélite", "Review" ou "Comparativo".
- Cada satélite precisa ter um "slug" único dentro do cluster e distinto
  do slug do pilar.
- Não recomende duas páginas satélites para a mesma intenção de busca e a
  mesma palavra-chave principal — isso é canibalização, não cobertura.
- Não invente volume de busca, dificuldade de palavra-chave, preço de
  produto ou qualquer métrica que não esteja na pesquisa fornecida.
- Não copie textos, títulos ou estruturas de páginas concorrentes — só
  descreva padrões observados em "serp_analysis".
- "internal_linking" é uma lista curta de regras de linkagem entre pilar
  e satélites (texto livre, uma regra por item) — não precisa cobrir
  todas as páginas, só os links mais importantes.
- Se o tema envolver saúde, finanças, segurança ou outro assunto
  sensível, inclua isso explicitamente em "human_review".
- Se a pesquisa fornecida não tiver base suficiente para alguma seção,
  registre um array vazio nessa seção em vez de inventar conteúdo — não
  deixe de chamar a ferramenta.
`;
}

function analisarClusterSeoNoClaude_(seedKeyword, pesquisaTexto) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('A propriedade ANTHROPIC_API_KEY não foi encontrada.');
  }

  const payload = {
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    tools: [TOPC_TOOL_CLUSTER_SEO],
    tool_choice: { type: 'tool', name: TOPC_TOOL_CLUSTER_SEO.name },
    messages: [
      {
        role: 'user',
        content: montarPromptClusterSeo_(seedKeyword, pesquisaTexto)
      }
    ]
  };

  const resposta = UrlFetchApp.fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const codigo = resposta.getResponseCode();
  const textoResposta = resposta.getContentText();
  let dados;

  try {
    dados = JSON.parse(textoResposta);
  } catch (erro) {
    throw new Error(
      'VALIDATION_ERROR: o Claude retornou uma resposta inválida. HTTP: ' +
      codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem = dados.error?.message || textoResposta;
    throw new Error('Erro da API do Claude (' + codigo + '): ' + mensagem);
  }

  const blocos = dados.content || [];

  const blocoFerramenta = blocos.filter(function (bloco) {
    return bloco.type === 'tool_use' &&
      bloco.name === TOPC_TOOL_CLUSTER_SEO.name;
  })[0];

  if (!blocoFerramenta || !blocoFerramenta.input) {
    throw new Error(
      'VALIDATION_ERROR: o Claude não retornou o cluster no formato de ' +
      'ferramenta esperado.'
    );
  }

  const cluster = blocoFerramenta.input;

  validarClusterSeo_(cluster);

  return cluster;
}

function validarClusterSeo_(cluster) {
  const problemas = [];

  function exigirString(valor, caminho) {
    if (typeof valor !== 'string' || !valor.trim()) {
      problemas.push(caminho + ' precisa ser uma string não vazia.');
    }
  }

  function exigirArrayDeStrings(valor, caminho) {
    if (!Array.isArray(valor)) {
      problemas.push(caminho + ' precisa ser um array (pode ser vazio).');
      return;
    }

    valor.forEach(function (item, indice) {
      if (typeof item !== 'string') {
        problemas.push(caminho + '[' + indice + '] precisa ser string.');
      }
    });
  }

  function validarPagina(pagina, caminho, tiposAceitos) {
    if (!pagina || typeof pagina !== 'object') {
      problemas.push(caminho + ' precisa ser um objeto.');
      return;
    }

    if (tiposAceitos.indexOf(pagina.type) === -1) {
      problemas.push(
        caminho + '.type precisa ser um de: ' + tiposAceitos.join(', ') +
        ' (recebido: ' + JSON.stringify(pagina.type) + ')'
      );
    }

    ['title', 'slug', 'primary_keyword', 'intent', 'category', 'funnel_stage', 'objective']
      .forEach(function (campo) {
        exigirString(pagina[campo], caminho + '.' + campo);
      });

    if (!pagina.keyword_map || typeof pagina.keyword_map !== 'object') {
      problemas.push(caminho + '.keyword_map precisa ser um objeto.');
    } else {
      exigirArrayDeStrings(pagina.keyword_map.secondary, caminho + '.keyword_map.secondary');
      exigirArrayDeStrings(pagina.keyword_map.questions, caminho + '.keyword_map.questions');
    }
  }

  if (!cluster || typeof cluster !== 'object') {
    throw new Error('VALIDATION_ERROR: o cluster retornado não é um objeto.');
  }

  exigirString(cluster.seed_keyword, 'seed_keyword');
  exigirString(cluster.language, 'language');
  exigirString(cluster.country, 'country');

  validarPagina(cluster.pillar, 'pillar', ['Pilar']);

  if (!Array.isArray(cluster.satellites)) {
    problemas.push('satellites precisa ser um array.');
  } else if (cluster.satellites.length < 3 || cluster.satellites.length > 25) {
    problemas.push(
      'satellites precisa ter entre 3 e 25 páginas (recebido: ' +
      cluster.satellites.length + ').'
    );
  } else {
    const slugsVistos = {};

    if (cluster.pillar && typeof cluster.pillar.slug === 'string') {
      slugsVistos[cluster.pillar.slug.trim().toLowerCase()] = true;
    }

    cluster.satellites.forEach(function (satelite, indice) {
      const caminho = 'satellites[' + indice + ']';
      validarPagina(satelite, caminho, TOPC_CLUSTER_TIPOS_SATELITE);

      const slug = String((satelite && satelite.slug) || '').trim().toLowerCase();

      if (slug) {
        if (slugsVistos[slug]) {
          problemas.push(caminho + '.slug duplicado no cluster: "' + slug + '".');
        }
        slugsVistos[slug] = true;
      }
    });
  }

  if (!cluster.serp_analysis || typeof cluster.serp_analysis !== 'object') {
    problemas.push('serp_analysis precisa ser um objeto.');
  } else {
    ['formats', 'patterns', 'content_gaps', 'competitor_urls'].forEach(function (campo) {
      exigirArrayDeStrings(cluster.serp_analysis[campo], 'serp_analysis.' + campo);
    });
  }

  exigirArrayDeStrings(cluster.internal_linking, 'internal_linking');
  exigirArrayDeStrings(cluster.differentiation, 'differentiation');
  exigirArrayDeStrings(cluster.sources, 'sources');
  exigirArrayDeStrings(cluster.risks, 'risks');
  exigirArrayDeStrings(cluster.human_review, 'human_review');

  if (problemas.length) {
    throw new Error(
      'VALIDATION_ERROR: o cluster SEO retornado é inválido — ' +
      problemas.join(' | ')
    );
  }
}

function topcAdicionarPaginaAoDoc_(corpo, pagina) {
  corpo.appendParagraph(pagina.title)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  corpo.appendParagraph('Tipo: ' + pagina.type);
  corpo.appendParagraph('Slug: ' + pagina.slug);
  corpo.appendParagraph('Palavra-chave principal: ' + pagina.primary_keyword);
  corpo.appendParagraph('Intenção: ' + pagina.intent);
  corpo.appendParagraph('Categoria: ' + pagina.category);
  corpo.appendParagraph('Estágio do funil: ' + pagina.funnel_stage);
  corpo.appendParagraph('Objetivo: ' + pagina.objective);
  topcListarSeNaoVazio_(corpo, 'Palavras-chave secundárias', pagina.keyword_map.secondary);
  topcListarSeNaoVazio_(corpo, 'Perguntas', pagina.keyword_map.questions);
}

function criarDocumentoCluster_(seedKeyword, cluster) {
  const documento = DocumentApp.create('Cluster SEO — ' + seedKeyword);
  const corpo = documento.getBody();

  corpo.appendParagraph('Cluster SEO')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);
  corpo.appendParagraph(seedKeyword)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  corpo.appendParagraph('Idioma / país: ' + cluster.language + ' / ' + cluster.country);

  corpo.appendHorizontalRule();

  corpo.appendParagraph('Página pilar')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcAdicionarPaginaAoDoc_(corpo, cluster.pillar);

  corpo.appendParagraph('Páginas satélites (' + cluster.satellites.length + ')')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  cluster.satellites.forEach(function (satelite) {
    topcAdicionarPaginaAoDoc_(corpo, satelite);
  });

  corpo.appendParagraph('Análise da SERP')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Formatos predominantes', cluster.serp_analysis.formats);
  topcListarSeNaoVazio_(corpo, 'Padrões dos concorrentes', cluster.serp_analysis.patterns);
  topcListarSeNaoVazio_(corpo, 'Lacunas de conteúdo', cluster.serp_analysis.content_gaps);
  topcListarSeNaoVazio_(corpo, 'URLs de concorrentes', cluster.serp_analysis.competitor_urls);

  corpo.appendParagraph('Linkagem interna')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Regras', cluster.internal_linking);

  corpo.appendParagraph('Diferenciação e riscos')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Diferenciais', cluster.differentiation);
  topcListarSeNaoVazio_(corpo, 'Fontes', cluster.sources);
  topcListarSeNaoVazio_(corpo, 'Riscos', cluster.risks);
  topcListarSeNaoVazio_(corpo, 'Pontos que exigem revisão humana', cluster.human_review);

  documento.saveAndClose();
  moverParaPastaProducao_(documento.getId());

  return DocumentApp.openById(documento.getId());
}

const TOPC_ABA_CLUSTERS_SEO = 'Clusters SEO';

const TOPC_COLUNAS_CLUSTER_SEO = [
  'ID',
  'Palavra-chave semente',
  'Link da pesquisa',
  'Status do cluster',
  'Link do cluster SEO',
  'Dados do cluster (JSON)',
  'Hash do cluster',
  'Aprovado por',
  'Aprovado em',
  'Pautas criadas',
  'Observações'
];

function obterOuCriarAbaClustersSeo_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(TOPC_ABA_CLUSTERS_SEO);

  if (!aba) {
    aba = planilha.insertSheet(TOPC_ABA_CLUSTERS_SEO);
    aba.getRange(1, 1, 1, TOPC_COLUNAS_CLUSTER_SEO.length)
      .setValues([TOPC_COLUNAS_CLUSTER_SEO]);
    aba.setFrozenRows(1);
  }

  return aba;
}

function gravarClusterLinha_(aba, linha, colunas, cluster, documento) {
  const hash = topcSha256Hex_(JSON.stringify(cluster));
  const statusAnterior = obterValor_(aba, linha, colunas, 'Status do cluster');

  atualizarValor_(aba, linha, colunas, 'Link do cluster SEO', documento.getUrl());
  atualizarValor_(aba, linha, colunas, 'Status do cluster', 'Cluster gerado');
  atualizarValor_(aba, linha, colunas, 'Dados do cluster (JSON)', JSON.stringify(cluster));
  atualizarValor_(aba, linha, colunas, 'Hash do cluster', hash);

  // Mesmo raciocínio de gravarPlanoLinha_ (PlanoSeo.js): regenerar o
  // cluster invalida qualquer aprovação anterior, que valia para um
  // conjunto de páginas diferente deste.
  if (statusAnterior === 'Aprovado' || statusAnterior === 'Rejeitado') {
    atualizarValor_(aba, linha, colunas, 'Aprovado por', '');
    atualizarValor_(aba, linha, colunas, 'Aprovado em', '');
  }

  return hash;
}

function gerarClusterSeoSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== TOPC_ABA_CLUSTERS_SEO || linha <= 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da linha do cluster na aba "' +
      TOPC_ABA_CLUSTERS_SEO + '".'
    );
    return;
  }

  try {
    gerarClusterSeoLinha_(aba, linha);
  } catch (erro) {
    SpreadsheetApp.getUi().alert(
      'Não foi possível gerar o cluster SEO:\n\n' + erro.message
    );
  }
}

// Núcleo sem UI, mesmo padrão de analisarSeoLinha_ (PlanoSeo.js).
function gerarClusterSeoLinha_(aba, linha) {
  topcGarantirColunasCluster_(aba);

  const colunas = obterColunas_(aba);

  validarColunas_(colunas, ['Palavra-chave semente', 'Link da pesquisa']);

  const seedKeyword = obterValor_(aba, linha, colunas, 'Palavra-chave semente');
  const linkPesquisa = obterValor_(aba, linha, colunas, 'Link da pesquisa');

  if (!seedKeyword) {
    throw new Error('Esta linha ainda não possui "Palavra-chave semente".');
  }

  if (!linkPesquisa) {
    throw new Error('Esta linha ainda não possui "Link da pesquisa".');
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(aba, linha, colunas, 'Status do cluster', 'Analisando...');
    SpreadsheetApp.flush();

    const pesquisaTexto = lerDocumentoGoogle_(linkPesquisa);
    const cluster = analisarClusterSeoNoClaude_(seedKeyword, pesquisaTexto);
    const documento = criarDocumentoCluster_(seedKeyword, cluster);
    const hash = gravarClusterLinha_(aba, linha, colunas, cluster, documento);

    atualizarValor_(
      aba, linha, colunas, 'Observações',
      'Cluster SEO gerado em ' +
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') +
        ' com ' + cluster.satellites.length +
        ' satélite(s). Aguardando aprovação (Status do cluster).'
    );

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Cluster SEO gerado: ' + documento.getUrl(),
      'Top Comparativos',
      8
    );

    return { documento: documento, cluster: cluster, hash: hash };
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status do cluster', 'Erro');
    atualizarValor_(
      aba, linha, colunas, 'Observações',
      'Erro ao gerar cluster SEO: ' + erro.message
    );
    throw erro;
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}

function topcGarantirColunasCluster_(aba) {
  TOPC_COLUNAS_CLUSTER_SEO.forEach(function (nomeColuna) {
    topcGarantirColuna_(aba, nomeColuna);
  });
}

const TOPC_COLUNAS_PAUTA_EDITORIAL = [
  'ID', 'Título', 'Tipo', 'Pilar relacionado', 'Palavra-chave principal',
  'Intenção', 'Categoria', 'Status', 'Slug', 'Link da pesquisa',
  'Link do artigo', 'Link da revisão', 'Link final', 'Status das imagens',
  'Observações', 'Versão no site'
];

function topcObterSlugsExistentes_(abaPauta, colunas) {
  const ultimaLinha = abaPauta.getLastRow();
  const slugs = {};

  if (ultimaLinha < 2 || !colunas['Slug']) {
    return slugs;
  }

  abaPauta
    .getRange(2, colunas['Slug'], ultimaLinha - 1, 1)
    .getDisplayValues()
    .forEach(function (linha) {
      const slug = String(linha[0] || '').trim().toLowerCase();
      if (slug) slugs[slug] = true;
    });

  return slugs;
}

function topcMontarLinhaPautaDoCluster_(pagina, pilarTitulo, seedKeyword, agora) {
  return {
    'ID': Utilities.getUuid(),
    'Título': pagina.title,
    'Tipo': pagina.type,
    'Pilar relacionado': pagina.type === 'Pilar' ? '' : pilarTitulo,
    'Palavra-chave principal': pagina.primary_keyword,
    'Intenção': pagina.intent,
    'Categoria': pagina.category,
    'Status': '',
    'Slug': pagina.slug,
    'Observações':
      'Criado pelo cluster "' + seedKeyword + '" em ' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '.'
  };
}

function criarPautasDoClusterSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== TOPC_ABA_CLUSTERS_SEO || linha <= 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da linha do cluster na aba "' +
      TOPC_ABA_CLUSTERS_SEO + '".'
    );
    return;
  }

  try {
    const resultado = criarPautasDoClusterLinha_(aba, linha);

    SpreadsheetApp.getUi().alert(
      resultado.criadas + ' pauta(s) criada(s) na aba "Pauta editorial".' +
      (resultado.jaExistiam
        ? ' ' + resultado.jaExistiam + ' slug(s) já existiam e foram pulados.'
        : '')
    );
  } catch (erro) {
    SpreadsheetApp.getUi().alert(
      'Não foi possível criar as pautas do cluster:\n\n' + erro.message
    );
  }
}

// Núcleo sem UI: lê o cluster aprovado da linha e cria uma linha em
// "Pauta editorial" por página do cluster (pilar + satélites) que ainda
// não tenha slug cadastrado — evita duplicar pautas se o comando for
// executado mais de uma vez sobre o mesmo cluster.
function criarPautasDoClusterLinha_(abaCluster, linha) {
  const colunas = obterColunas_(abaCluster);

  validarColunas_(colunas, [
    'Palavra-chave semente', 'Status do cluster', 'Dados do cluster (JSON)'
  ]);

  const status = obterValor_(abaCluster, linha, colunas, 'Status do cluster');

  if (status !== 'Aprovado') {
    throw new Error(
      'O cluster desta linha está com status "' + (status || '(vazio)') +
      '", não "Aprovado". Aprove o cluster (coluna "Status do cluster") ' +
      'antes de criar as pautas.'
    );
  }

  const dadosJson = obterValor_(abaCluster, linha, colunas, 'Dados do cluster (JSON)');

  if (!dadosJson) {
    throw new Error('Esta linha não possui "Dados do cluster (JSON)".');
  }

  const cluster = JSON.parse(dadosJson);
  const seedKeyword = obterValor_(abaCluster, linha, colunas, 'Palavra-chave semente');

  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaPauta = planilha.getSheetByName('Pauta editorial');

  if (!abaPauta) {
    throw new Error('A aba "Pauta editorial" não foi encontrada.');
  }

  const colunasPauta = obterColunas_(abaPauta);
  validarColunas_(colunasPauta, TOPC_COLUNAS_PAUTA_EDITORIAL);

  const slugsExistentes = topcObterSlugsExistentes_(abaPauta, colunasPauta);
  const agora = new Date();
  const paginas = [cluster.pillar].concat(cluster.satellites);

  const linhasNovas = [];
  let jaExistiam = 0;

  paginas.forEach(function (pagina) {
    const slug = String(pagina.slug || '').trim().toLowerCase();

    if (slug && slugsExistentes[slug]) {
      jaExistiam += 1;
      return;
    }

    const dadosLinha = topcMontarLinhaPautaDoCluster_(
      pagina, cluster.pillar.title, seedKeyword, agora
    );

    linhasNovas.push(
      TOPC_COLUNAS_PAUTA_EDITORIAL.map(function (nomeColuna) {
        return dadosLinha[nomeColuna] !== undefined ? dadosLinha[nomeColuna] : '';
      })
    );

    if (slug) slugsExistentes[slug] = true;
  });

  if (linhasNovas.length) {
    abaPauta
      .getRange(abaPauta.getLastRow() + 1, 1, linhasNovas.length, TOPC_COLUNAS_PAUTA_EDITORIAL.length)
      .setValues(linhasNovas);
  }

  atualizarValor_(abaCluster, linha, colunas, 'Status do cluster', 'Pautas criadas');
  atualizarValor_(abaCluster, linha, colunas, 'Pautas criadas', linhasNovas.length);
  atualizarValor_(
    abaCluster, linha, colunas, 'Observações',
    linhasNovas.length + ' pauta(s) criada(s) em ' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') +
      (jaExistiam ? '. ' + jaExistiam + ' slug(s) já existiam e foram pulados.' : '.')
  );

  return { criadas: linhasNovas.length, jaExistiam: jaExistiam };
}
