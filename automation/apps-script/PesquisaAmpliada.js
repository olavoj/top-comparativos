// Comando "1b. Pesquisar (ampliada)".
// Amplia a pesquisa de uma pauta em várias variações de palavra-chave
// (comercial, informacional, comparação, perguntas, alternativas),
// preservando cada resultado bruto (URL, título, domínio, data) separado
// da interpretação — que só acontece na etapa de análise SEO, não aqui.
//
// Escreve na mesma coluna "Link da pesquisa" que a pesquisa simples
// (Pesquisa.js), então serve como alternativa "drop-in" para a etapa 1:
// o restante do fluxo (geração de artigo, "Rodar fluxo completo") não
// precisa saber qual das duas gerou o documento.

const TOPC_VARIACOES_PESQUISA = [
  {
    tipo: 'principal',
    rotulo: 'Palavra-chave principal',
    montarQuery: function (pauta) { return pauta.palavraChave; }
  },
  {
    tipo: 'comercial',
    rotulo: 'Variação comercial',
    montarQuery: function (pauta) {
      return 'melhor ' + pauta.palavraChave + ' para comprar em 2026, preço e onde comprar';
    }
  },
  {
    tipo: 'informacional',
    rotulo: 'Variação informacional',
    montarQuery: function (pauta) {
      return 'o que é ' + pauta.palavraChave + ', como funciona e como escolher';
    }
  },
  {
    tipo: 'comparacao',
    rotulo: 'Variação de comparação',
    montarQuery: function (pauta) {
      return pauta.palavraChave + ' comparação entre marcas e modelos';
    }
  },
  {
    tipo: 'perguntas',
    rotulo: 'Variação de perguntas',
    montarQuery: function (pauta) {
      return 'principais dúvidas e perguntas frequentes sobre ' + pauta.palavraChave;
    }
  },
  {
    tipo: 'alternativas',
    rotulo: 'Variação de alternativas e problemas',
    montarQuery: function (pauta) {
      return 'alternativas a ' + pauta.palavraChave + ' e problemas comuns relatados por quem usa';
    }
  }
];

function montarVariacoesPesquisa_(pauta) {
  return TOPC_VARIACOES_PESQUISA.map(function (definicao) {
    return {
      tipo: definicao.tipo,
      rotulo: definicao.rotulo,
      query: definicao.montarQuery(pauta)
    };
  });
}

function montarPromptVariacaoPesquisa_(pauta, variacao) {
  return `
Pesquise na web resultados relevantes para a consulta abaixo, no contexto
de um artigo do site brasileiro Top Comparativos.

PAUTA: ${pauta.titulo}
CONSULTA A PESQUISAR: ${variacao.query}

Responda em português do Brasil com um resumo curto (até 5 frases) dos
achados mais relevantes para essa consulta específica. Não escreva o
artigo. Não invente preços, especificações ou avaliações. Diferencie
informação confirmada de hipótese quando relevante.
`;
}

function montarPayloadVariacaoPesquisa_(pauta, variacao) {
  return {
    model: CONFIG.PERPLEXITY_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Você é um pesquisador editorial brasileiro especializado em SEO, ' +
          'comparativos de produtos e conteúdo para afiliados. Responda ' +
          'sempre em português do Brasil. Não invente preços, ' +
          'especificações, avaliações, testes ou características.'
      },
      {
        role: 'user',
        content: montarPromptVariacaoPesquisa_(pauta, variacao)
      }
    ],
    temperature: 0.2,
    max_tokens: 1200,
    search_mode: 'web',
    web_search_options: {
      search_context_size: 'medium'
    }
  };
}

function topcExtrairDominio_(url) {
  try {
    return String(url).replace(/^https?:\/\//i, '').split('/')[0];
  } catch (erro) {
    return '';
  }
}

function pesquisarVariacaoNoPerplexity_(pauta, variacao) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('PERPLEXITY_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade PERPLEXITY_API_KEY não foi encontrada.'
    );
  }

  const payload = montarPayloadVariacaoPesquisa_(pauta, variacao);

  const resposta = UrlFetchApp.fetch(CONFIG.PERPLEXITY_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const codigo = resposta.getResponseCode();
  const textoResposta = resposta.getContentText();
  let dados;

  try {
    dados = JSON.parse(textoResposta);
  } catch (erro) {
    throw new Error(
      'A API retornou uma resposta inválida para "' + variacao.rotulo +
      '". Código HTTP: ' + codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem =
      dados.error?.message ||
      dados.detail?.[0]?.msg ||
      textoResposta;

    throw new Error(
      'Erro do Perplexity em "' + variacao.rotulo + '" (' + codigo + '): ' +
      mensagem
    );
  }

  const buscas = Array.isArray(dados.search_results) ? dados.search_results : [];

  const resultados = buscas.map(function (item, indice) {
    const url = String(item.url || '').trim();

    return {
      query: variacao.query,
      url: url,
      titulo: String(item.title || '').trim(),
      dominio: topcExtrairDominio_(url),
      dataPublicacao: String(item.date || '').trim(),
      dataAtualizacao: String(item.last_updated || '').trim(),
      dataColeta: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      ordem: indice + 1
    };
  });

  return {
    tipo: variacao.tipo,
    rotulo: variacao.rotulo,
    query: variacao.query,
    resumo: dados.choices?.[0]?.message?.content || '',
    resultados: resultados,
    citacoes: dados.citations || []
  };
}

function pesquisarVariacoesPerplexity_(pauta, variacoes) {
  return variacoes.map(function (variacao) {
    return pesquisarVariacaoNoPerplexity_(pauta, variacao);
  });
}

function criarDocumentoPesquisaEstruturada_(pauta, variacoesResultados) {
  const documento = DocumentApp.create(
    'Pesquisa SEO (ampliada) — ' + pauta.titulo
  );

  const corpo = documento.getBody();

  corpo.appendParagraph('Pesquisa editorial SEO — ampliada')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);

  corpo.appendParagraph(pauta.titulo)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  corpo.appendParagraph('Palavra-chave principal: ' + pauta.palavraChave);
  corpo.appendParagraph('Tipo: ' + (pauta.tipo || 'Não informado'));
  corpo.appendParagraph(
    'Intenção informada na pauta: ' + (pauta.intencao || 'Não informada')
  );
  corpo.appendParagraph(
    'Categoria: ' + (pauta.categoria || 'Não informada')
  );

  corpo.appendHorizontalRule();

  variacoesResultados.forEach(function (variacao) {
    corpo.appendParagraph(variacao.rotulo)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

    corpo.appendParagraph('Consulta: ' + variacao.query);

    if (variacao.resumo) {
      corpo.appendParagraph(variacao.resumo);
    }

    if (variacao.resultados.length) {
      corpo.appendParagraph('Resultados brutos')
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);

      variacao.resultados.forEach(function (resultado) {
        corpo.appendListItem(
          resultado.ordem + '. ' + (resultado.titulo || resultado.url) +
          ' — ' + resultado.dominio +
          (resultado.dataPublicacao ? ' — ' + resultado.dataPublicacao : '') +
          ' — ' + resultado.url
        );
      });
    } else {
      corpo.appendParagraph('Nenhum resultado estruturado retornado para esta consulta.');
    }

    corpo.appendHorizontalRule();
  });

  documento.saveAndClose();
  moverParaPastaProducao_(documento.getId());

  return DocumentApp.openById(documento.getId());
}

function pesquisarPautaAmpliadaSelecionada() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione qualquer célula da linha da pauta que deseja pesquisar.'
    );
    return;
  }

  try {
    pesquisarPautaAmpliadaLinha_(aba, linha);
  } catch (erro) {
    SpreadsheetApp.getUi().alert(
      'Não foi possível concluir a pesquisa ampliada:\n\n' + erro.message
    );
  }
}

// Núcleo sem UI, mesmo padrão de pesquisarPautaLinha_ (Pesquisa.js): usado
// pelo comando de menu e, futuramente, pelo fluxo completo automático.
function pesquisarPautaAmpliadaLinha_(aba, linha) {
  const colunas = obterColunas_(aba);
  validarColunas_(colunas, [
    'Título',
    'Tipo',
    'Palavra-chave principal',
    'Intenção',
    'Categoria',
    'Status',
    'Link da pesquisa',
    'Observações'
  ]);

  const pauta = {
    titulo: obterValor_(aba, linha, colunas, 'Título'),
    tipo: obterValor_(aba, linha, colunas, 'Tipo'),
    palavraChave: obterValor_(aba, linha, colunas, 'Palavra-chave principal'),
    intencao: obterValor_(aba, linha, colunas, 'Intenção'),
    categoria: obterValor_(aba, linha, colunas, 'Categoria'),
    pilar: obterValor_(aba, linha, colunas, 'Pilar relacionado')
  };

  if (!pauta.titulo || !pauta.palavraChave) {
    throw new Error('Preencha pelo menos Título e Palavra-chave principal.');
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(aba, linha, colunas, 'Status', 'Pesquisando (ampliada)...');
    SpreadsheetApp.flush();

    const variacoes = montarVariacoesPesquisa_(pauta);
    const resultados = pesquisarVariacoesPerplexity_(pauta, variacoes);
    const documento = criarDocumentoPesquisaEstruturada_(pauta, resultados);

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Link da pesquisa',
      documento.getUrl()
    );

    atualizarValor_(aba, linha, colunas, 'Status', 'Pesquisa pronta');

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Pesquisa ampliada (' + variacoes.length + ' variações) criada em ' +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        )
    );

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Pesquisa ampliada concluída: ' + documento.getUrl(),
      'Top Comparativos',
      8
    );

    return documento;
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status', 'Erro');
    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro na pesquisa ampliada: ' + erro.message
    );

    throw erro;
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}
