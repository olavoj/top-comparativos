const CONFIG = {
  ROOT_FOLDER_ID: '1h4LpehaVjcYSNeM4ktKw6sTWGy1wQYQ3',
  PRODUCTION_FOLDER: '01 - Em produção',
  PERPLEXITY_MODEL: 'sonar-pro',
  PERPLEXITY_URL: 'https://api.perplexity.ai/chat/completions'
};

function topcAdicionarRascunhoMenu_(menu) {
  return menu
    .addSeparator()
    .addItem(
      '5. Enviar rascunho ao site',
      'enviarRascunhoSiteSelecionado'
    );
}

function topcAdicionarFerramentasMenu_(menu, ui) {
  return menu
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Ferramentas')
        .addItem('Testar conexão com o site', 'testarConexaoSite')
        .addItem(
          'Diagnosticar imagens da pauta',
          'diagnosticarImagensDaPauta'
        )
        .addItem('Reparar fila de imagens', 'repararFilaImagensAtual')
        .addItem(
          'Reabrir falhas de lista selecionadas',
          'reabrirFalhasListItemSelecionadas'
        )
    );
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  const menu = ui
    .createMenu('Automação SEO')
    .addItem(
      '1. Pesquisar pauta selecionada',
      'pesquisarPautaSelecionada'
    )
    .addItem(
      '2. Gerar artigo com Claude',
      'gerarArtigoSelecionado'
    )
    .addSeparator()
    .addItem(
      '3. Revisar artigo com Claude',
      'revisarArtigoSelecionado'
    )
    .addSeparator()
    .addItem(
      '4. Gerar imagens com Nano Banana',
      'enfileirarImagensSelecionadas'
    );

  topcAdicionarFerramentasMenu_(
    topcAdicionarPublishMenu_(
      topcAdicionarUploadMenu_(
        topcAdicionarRascunhoMenu_(menu)
      )
    ),
    ui
  ).addToUi();
}

// O comando "1. Pesquisar pauta selecionada" fica em Pesquisa.js.

function pesquisarNoPerplexity_(pauta) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('PERPLEXITY_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade PERPLEXITY_API_KEY não foi encontrada.'
    );
  }

  const prompt = montarPromptPesquisa_(pauta);
  const payload = montarPayloadPesquisa_(prompt);

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
      'A API retornou uma resposta inválida. Código HTTP: ' + codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem =
      dados.error?.message ||
      dados.detail?.[0]?.msg ||
      textoResposta;

    throw new Error(
      'Erro do Perplexity (' + codigo + '): ' + mensagem
    );
  }

  const conteudo = dados.choices?.[0]?.message?.content;

  if (!conteudo) {
    throw new Error('O Perplexity não retornou conteúdo.');
  }

  return {
    conteudo: conteudo,
    citacoes: dados.citations || [],
    resultados: dados.search_results || [],
    perguntasRelacionadas: dados.related_questions || []
  };
}

// A API do Perplexity rejeita campos desconhecidos no corpo. Só entram
// aqui parâmetros aceitos por /chat/completions; o idioma é pedido no
// prompt, não em um campo próprio.
function montarPayloadPesquisa_(prompt) {
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
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: 5000,
    search_mode: 'web',
    return_related_questions: true,
    web_search_options: {
      search_context_size: 'high'
    }
  };
}

function montarPromptPesquisa_(pauta) {
  return `
Realize uma pesquisa editorial completa para um artigo do site brasileiro
Top Comparativos.

DADOS DA PAUTA
Título: ${pauta.titulo}
Palavra-chave principal principal: ${pauta.palavraChave}
Tipo de artigo: ${pauta.tipo || 'Não informado'}
Intenção de busca: ${pauta.intencao || 'Não informada'}
Categoria: ${pauta.categoria || 'Não informada'}
Post pilar relacionado: ${pauta.pilar || 'Não informado'}

A pesquisa deve conter:

1. Resumo do tema e intenção do usuário.
2. Perfil e principais necessidades do público.
3. Perguntas mais importantes que o artigo deve responder.
4. Critérios objetivos de avaliação e comparação.
5. Produtos, marcas ou soluções relevantes encontrados.
6. Características verificáveis de cada alternativa.
7. Benefícios, limitações e situações de uso.
8. Dúvidas frequentes.
9. Estrutura recomendada de títulos H2 e H3.
10. Sugestões de conteúdos satélites e links internos.
11. Pontos que exigem verificação humana.
12. Fontes consultadas.

REGRAS

- Priorize fontes oficiais, fabricantes e publicações confiáveis.
- Diferencie informação confirmada de hipótese.
- Não invente produtos, preços, avaliações ou testes.
- Não afirme que o Top Comparativos testou fisicamente um produto.
- Considere o mercado brasileiro.
- Não escreva ainda o artigo final.
- Entregue uma pesquisa detalhada e organizada em português do Brasil.
`;
}

function criarDocumentoPesquisa_(pauta, resultado) {
  const documento = DocumentApp.create(
    'Pesquisa SEO — ' + pauta.titulo
  );

  const corpo = documento.getBody();

  corpo.appendParagraph('Pesquisa editorial SEO')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);

  corpo.appendParagraph(pauta.titulo)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  corpo.appendParagraph('Palavra-chave principal: ' + pauta.palavraChave);
  corpo.appendParagraph('Tipo: ' + (pauta.tipo || 'Não informado'));
  corpo.appendParagraph(
    'Intenção: ' + (pauta.intencao || 'Não informada')
  );
  corpo.appendParagraph(
    'Categoria: ' + (pauta.categoria || 'Não informada')
  );

  corpo.appendHorizontalRule();

  corpo.appendParagraph('Resultado da pesquisa')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  corpo.appendParagraph(resultado.conteudo);

  if (resultado.citacoes.length) {
    corpo.appendPageBreak();

    corpo.appendParagraph('Fontes retornadas pelo Perplexity')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

    resultado.citacoes.forEach(function (url, indice) {
      corpo.appendListItem((indice + 1) + '. ' + url);
    });
  }

  if (resultado.perguntasRelacionadas.length) {
    corpo.appendParagraph('Pesquisas relacionadas')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

    resultado.perguntasRelacionadas.forEach(function (pergunta) {
      corpo.appendListItem(pergunta);
    });
  }

  documento.saveAndClose();
  moverParaPastaProducao_(documento.getId());

  return DocumentApp.openById(documento.getId());
}

function moverParaPastaProducao_(arquivoId) {
  const raiz = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const pastas = raiz.getFoldersByName(CONFIG.PRODUCTION_FOLDER);

  if (!pastas.hasNext()) {
    throw new Error(
      'A pasta "' + CONFIG.PRODUCTION_FOLDER + '" não foi encontrada.'
    );
  }

  const pastaDestino = pastas.next();
  const arquivo = DriveApp.getFileById(arquivoId);

  arquivo.moveTo(pastaDestino);
}

function obterColunas_(aba) {
  const ultimaColuna = aba.getLastColumn();

  if (ultimaColuna === 0) {
    throw new Error('A planilha não possui cabeçalhos.');
  }

  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0];

  const colunas = {};

  cabecalhos.forEach(function (cabecalho, indice) {
    colunas[String(cabecalho).trim()] = indice + 1;
  });

  return colunas;
}

function validarColunas_(colunas, obrigatorias) {
  const ausentes = obrigatorias.filter(function (nome) {
    return !colunas[nome];
  });

  if (ausentes.length) {
    throw new Error(
      'Colunas não encontradas: ' + ausentes.join(', ')
    );
  }
}

function obterValor_(aba, linha, colunas, nome) {
  if (!colunas[nome]) {
    return '';
  }

  return aba
    .getRange(linha, colunas[nome])
    .getDisplayValue()
    .trim();
}

function atualizarValor_(aba, linha, colunas, nome, valor) {
  if (colunas[nome]) {
    aba.getRange(linha, colunas[nome]).setValue(valor);
  }
}
function gerarArtigoSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da linha que contém a pesquisa.'
    );
    return;
  }

  const colunas = obterColunas_(aba);

  validarColunas_(colunas, [
    'Título',
    'Tipo',
    'Palavra-chave principal',
    'Intenção',
    'Categoria',
    'Status',
    'Slug',
    'Link da pesquisa',
    'Link do artigo',
    'Observações'
  ]);

  // O slug entra no nome das imagens e no envelope do site.
  // Sem ele, os marcadores saem quebrados mais adiante no fluxo.
  topcGarantirSlugLinha_(aba, linha);

  const pauta = {
    titulo: obterValor_(aba, linha, colunas, 'Título'),
    tipo: obterValor_(aba, linha, colunas, 'Tipo'),
    palavraChave: obterValor_(
      aba,
      linha,
      colunas,
      'Palavra-chave principal'
    ),
    intencao: obterValor_(aba, linha, colunas, 'Intenção'),
    categoria: obterValor_(aba, linha, colunas, 'Categoria'),
    slug: obterValor_(aba, linha, colunas, 'Slug'),
    linkPesquisa: obterValor_(
      aba,
      linha,
      colunas,
      'Link da pesquisa'
    ),
    pilar: obterValor_(
      aba,
      linha,
      colunas,
      'Pilar relacionado'
    )
  };

  if (!pauta.linkPesquisa) {
    SpreadsheetApp.getUi().alert(
      'Esta linha ainda não possui um link de pesquisa.'
    );
    return;
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status',
      'Gerando artigo...'
    );

    SpreadsheetApp.flush();

    const pesquisa = lerDocumentoGoogle_(pauta.linkPesquisa);
    const artigo = gerarArtigoNoClaude_(pauta, pesquisa);
    const documento = criarDocumentoArtigo_(pauta, artigo);

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Link do artigo',
      documento.getUrl()
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status',
      'Em revisão'
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Artigo gerado com Claude em ' +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ) +
        '. Revisão humana obrigatória antes da publicação.'
    );

    SpreadsheetApp.getUi().alert(
      'Artigo criado e enviado para revisão!\n\n' +
      documento.getUrl()
    );
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status', 'Erro');

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro ao gerar artigo: ' + erro.message
    );

    SpreadsheetApp.getUi().alert(
      'Não foi possível gerar o artigo:\n\n' + erro.message
    );
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}

function lerDocumentoGoogle_(url) {
  const id = extrairIdGoogle_(url);

  if (!id) {
    throw new Error('Não foi possível identificar o documento da pesquisa.');
  }

  const documento = DocumentApp.openById(id);
  const texto = documento.getBody().getText();

  if (!texto || texto.length < 100) {
    throw new Error('O documento da pesquisa está vazio ou incompleto.');
  }

  return texto;
}

function extrairIdGoogle_(url) {
  const formatos = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];

  for (let i = 0; i < formatos.length; i++) {
    const resultado = String(url).match(formatos[i]);

    if (resultado && resultado[1]) {
      return resultado[1];
    }
  }

  return null;
}

function gerarArtigoNoClaude_(pauta, pesquisa) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade ANTHROPIC_API_KEY não foi encontrada.'
    );
  }

  const prompt = montarPromptArtigo_(pauta, pesquisa);

  const payload = {
    model: 'claude-sonnet-5',
    max_tokens: 12000,
    messages: [
      {
        role: 'user',
        content: prompt
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
      'O Claude retornou uma resposta inválida. HTTP: ' + codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem =
      dados.error?.message ||
      textoResposta;

    throw new Error(
      'Erro da API do Claude (' + codigo + '): ' + mensagem
    );
  }

  const blocos = dados.content || [];

  const conteudo = blocos
    .filter(function (bloco) {
      return bloco.type === 'text';
    })
    .map(function (bloco) {
      return bloco.text;
    })
    .join('\n');

  if (!conteudo) {
    throw new Error('O Claude não retornou o artigo.');
  }

  return conteudo;
}

function montarPromptArtigo_(pauta, pesquisa) {
  const tamanho = pauta.tipo === 'Pilar'
    ? 'Entre 2.500 e 3.500 palavras'
    : 'Entre 1.200 e 2.000 palavras';

  return `
Você é o redator-chefe do Top Comparativos, um site brasileiro de
conteúdo informativo, reviews e comparativos.

Escreva um artigo original, útil e editorialmente responsável.

INFORMAÇÕES DA PAUTA

Título inicial: ${pauta.titulo}
Tipo: ${pauta.tipo}
Palavra-chave principal: ${pauta.palavraChave}
Intenção: ${pauta.intencao}
Categoria: ${pauta.categoria}
Slug: ${pauta.slug}
Pilar relacionado: ${pauta.pilar || 'Não informado'}
Tamanho esperado: ${tamanho}

PESQUISA EDITORIAL

${pesquisa}

ESTRUTURA OBRIGATÓRIA

TÍTULO SEO:
[Crie um título com até 60 caracteres]

META DESCRIPTION:
[Crie uma descrição entre 140 e 160 caracteres]

SLUG:
${pauta.slug}

PALAVRA-CHAVE PRINCIPAL:
${pauta.palavraChave}

PALAVRAS-CHAVE SECUNDÁRIAS:
[Liste termos relacionados]

# ${pauta.titulo}

[Introdução direta, natural e útil]

[Desenvolva o artigo usando H2 e H3]

[IMAGEM: imagem-principal-${pauta.slug}.webp]

[Inclua sugestões de imagens adicionais quando ajudarem o leitor]

[LINK-INTERNO: slug-do-artigo-relacionado]

## Perguntas frequentes

[Inclua de 5 a 8 perguntas e respostas]

## Conclusão

[Conclusão útil e sem pressão comercial exagerada]

AVISO EDITORIAL:
Este conteúdo tem caráter informativo. Verifique sempre as orientações
do fabricante antes de utilizar qualquer produto.

FONTES PARA REVISÃO:
[Liste as URLs presentes na pesquisa]

REGRAS EDITORIAIS

- Escreva em português do Brasil.
- Não copie frases das fontes.
- Não faça enchimento para atingir o tamanho.
- Não invente produtos, preços, ASINs ou especificações.
- Não afirme que testamos produtos fisicamente.
- Não use frases como "testamos", "comprovamos" ou "nossa equipe usou".
- Diferencie informações gerais de características específicas.
- Não prometa resultados absolutos.
- Não crie links de afiliado.
- Não transforme opiniões de outros sites em fatos.
- Evite excesso de palavras-chave.
- Use parágrafos curtos e linguagem natural.
- Use listas e tabelas somente quando facilitarem a leitura.
- Não inclua preço, pois pode mudar.
- Não publique automaticamente.
- O texto será submetido a revisão humana.
`;
}

function criarDocumentoArtigo_(pauta, conteudo) {
  const documento = DocumentApp.create(
    'Artigo — ' + pauta.titulo
  );

  const corpo = documento.getBody();

  corpo.appendParagraph('Artigo em revisão')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);

  corpo.appendParagraph(
    'Gerado automaticamente. Revisão humana obrigatória.'
  ).setForegroundColor('#b45309');

  corpo.appendHorizontalRule();

  inserirMarkdownSimples_(corpo, conteudo);

  documento.saveAndClose();

  const pastaRevisaoId = '1i_7BplN8lOJf7EHMiVhPw7ANzEeOuW32';
  const pastaRevisao = DriveApp.getFolderById(pastaRevisaoId);
  const arquivo = DriveApp.getFileById(documento.getId());

  arquivo.moveTo(pastaRevisao);

  return DocumentApp.openById(documento.getId());
}

function inserirMarkdownSimples_(corpo, conteudo) {
  const linhas = conteudo.split('\n');

  linhas.forEach(function (linha) {
    const texto = linha.trim();

    if (!texto) {
      corpo.appendParagraph('');
      return;
    }

    if (texto.startsWith('### ')) {
      corpo.appendParagraph(texto.substring(4))
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
      return;
    }

    if (texto.startsWith('## ')) {
      corpo.appendParagraph(texto.substring(3))
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      return;
    }

    if (texto.startsWith('# ')) {
      corpo.appendParagraph(texto.substring(2))
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
      return;
    }

    if (texto.startsWith('- ')) {
      corpo.appendListItem(texto.substring(2));
      return;
    }

    if (/^\d+\.\s/.test(texto)) {
      corpo.appendListItem(
        texto.replace(/^\d+\.\s/, '')
      ).setGlyphType(DocumentApp.GlyphType.NUMBER);
      return;
    }

    corpo.appendParagraph(texto);
  });
}
function revisarArtigoSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da linha que deseja revisar.'
    );
    return;
  }

  const colunas = obterColunas_(aba);

  validarColunas_(colunas, [
    'Título',
    'Tipo',
    'Palavra-chave principal',
    'Intenção',
    'Categoria',
    'Status',
    'Slug',
    'Link da pesquisa',
    'Link do artigo',
    'Link da revisão',
    'Observações'
  ]);

  const pauta = {
    titulo: obterValor_(aba, linha, colunas, 'Título'),
    tipo: obterValor_(aba, linha, colunas, 'Tipo'),
    palavraChave: obterValor_(
      aba,
      linha,
      colunas,
      'Palavra-chave principal'
    ),
    intencao: obterValor_(aba, linha, colunas, 'Intenção'),
    categoria: obterValor_(aba, linha, colunas, 'Categoria'),
    slug: obterValor_(aba, linha, colunas, 'Slug'),
    pilar: obterValor_(
      aba,
      linha,
      colunas,
      'Pilar relacionado'
    ),
    linkPesquisa: obterValor_(
      aba,
      linha,
      colunas,
      'Link da pesquisa'
    ),
    linkArtigo: obterValor_(
      aba,
      linha,
      colunas,
      'Link do artigo'
    )
  };

  if (!pauta.linkPesquisa) {
    SpreadsheetApp.getUi().alert(
      'A linha selecionada não possui Link da pesquisa.'
    );
    return;
  }

  if (!pauta.linkArtigo) {
    SpreadsheetApp.getUi().alert(
      'A linha selecionada não possui Link do artigo.'
    );
    return;
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status',
      'Revisando...'
    );

    SpreadsheetApp.flush();

    const pesquisa = lerDocumentoGoogle_(pauta.linkPesquisa);
    const artigo = lerDocumentoGoogle_(pauta.linkArtigo);

    const revisao = revisarArtigoNoClaude_(
      pauta,
      pesquisa,
      artigo
    );

    const documento = criarDocumentoRevisado_(
      pauta,
      revisao
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Link da revisão',
      documento.getUrl()
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status',
      'Em revisão'
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Revisão editorial criada em ' +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ) +
        '. Aprovação humana obrigatória antes da publicação.'
    );

    SpreadsheetApp.getUi().alert(
      'Revisão editorial concluída!\n\n' +
      documento.getUrl()
    );
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status', 'Erro');

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro na revisão: ' + erro.message
    );

    SpreadsheetApp.getUi().alert(
      'Não foi possível revisar o artigo:\n\n' +
      erro.message
    );
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}

function revisarArtigoNoClaude_(pauta, pesquisa, artigo) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade ANTHROPIC_API_KEY não foi encontrada.'
    );
  }

  const prompt = montarPromptRevisao_(
    pauta,
    pesquisa,
    artigo
  );

  const payload = {
    model: 'claude-sonnet-5',
    max_tokens: 14000,
    messages: [
      {
        role: 'user',
        content: prompt
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
      'O Claude retornou uma resposta inválida. HTTP: ' +
      codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem =
      dados.error?.message ||
      textoResposta;

    throw new Error(
      'Erro da API do Claude (' +
      codigo +
      '): ' +
      mensagem
    );
  }

  const conteudo = (dados.content || [])
    .filter(function (bloco) {
      return bloco.type === 'text';
    })
    .map(function (bloco) {
      return bloco.text;
    })
    .join('\n');

  return limparRespostaClaude_(conteudo);
}

function montarPromptRevisao_(pauta, pesquisa, artigo) {
  return `
Você é o editor-chefe do Top Comparativos.

Faça uma revisão editorial completa do artigo fornecido, usando a
pesquisa como limite factual. Preserve o significado, mas melhore
clareza, gramática, SEO, estrutura e confiabilidade.

DADOS DA PAUTA

Título: ${pauta.titulo}
Tipo: ${pauta.tipo}
Palavra-chave principal: ${pauta.palavraChave}
Intenção: ${pauta.intencao}
Categoria: ${pauta.categoria}
Slug: ${pauta.slug}
Pilar relacionado: ${pauta.pilar || 'Não informado'}

POLÍTICA EVERGREEN INTELIGENTE

Primeiro classifique o artigo:

EVERGREEN:
A intenção permanece válida ao longo dos anos, como guias, conceitos,
cuidados, tutoriais e orientações permanentes.

TEMPORAL:
A intenção depende de um período, como lançamentos, rankings anuais,
legislação, disponibilidade, preços ou comparativos de um ano específico.

Se for EVERGREEN:

- Remova anos desnecessários do título SEO e do título principal.
- Não substitua o ano antigo pelo ano atual.
- Evite expressões como "neste ano" ou "atualmente" quando não forem
  necessárias.

Se for TEMPORAL:

- Mantenha o ano apenas quando ele for essencial para a intenção.
- Inclua nas pendências que o conteúdo exigirá atualização futura.

REVISÃO OBRIGATÓRIA

- Corrija gramática, ortografia e digitação.
- Corrija especificamente "characterísticos" para "característicos".
- Melhore frases artificiais ou excessivamente genéricas.
- Remova repetições e enchimentos.
- Preserve a palavra-chave de forma natural.
- Revise título SEO e meta description.
- Mantenha apenas um H1.
- Organize o conteúdo com H2 e H3.
- Preserve a FAQ.
- Preserve as marcações [IMAGEM: ...].
- Preserve as marcações [LINK-INTERNO: ...].
- Preserve as fontes para revisão.
- Mantenha o aviso editorial.
- Sinalize afirmações que exigem verificação humana.
- Não use Markdown para negrito.
- Não utilize dois asteriscos em nenhuma parte do texto.
- Não coloque a resposta dentro de bloco de código.

NÃO É PERMITIDO

- Inventar produtos, marcas, ASINs ou preços.
- Criar links de afiliado.
- Inventar testes ou experiência prática.
- Afirmar que o Top Comparativos testou um produto.
- Adicionar fatos sem suporte na pesquisa.
- Transformar opiniões das fontes em fatos.
- Remover ressalvas de segurança.
- Alterar a intenção do artigo para forçar palavras-chave.

FORMATO OBRIGATÓRIO DA RESPOSTA

CLASSIFICAÇÃO: EVERGREEN ou TEMPORAL

TÍTULO ANTERIOR:
[Informe o título SEO anterior]

TÍTULO REVISADO:
[Informe o novo título SEO]

PRINCIPAIS CORREÇÕES:
- [Liste as alterações mais relevantes]

PENDÊNCIAS:
- [Liste imagens, links, informações ou verificações pendentes]

=== CONTEÚDO PARA PUBLICAÇÃO ===

TÍTULO SEO:
[Título final com até 60 caracteres]

META DESCRIPTION:
[Descrição entre 140 e 160 caracteres]

SLUG:
${pauta.slug}

PALAVRA-CHAVE PRINCIPAL:
${pauta.palavraChave}

PALAVRAS-CHAVE SECUNDÁRIAS:
[Lista natural e coerente]

# [Título principal do artigo]

[Artigo completo revisado com H2 e H3]

## Perguntas frequentes

[Perguntas e respostas]

## Conclusão

[Conclusão revisada]

AVISO EDITORIAL:
Este conteúdo tem caráter informativo. Verifique sempre as orientações
do fabricante antes de utilizar qualquer produto.

FONTES PARA REVISÃO:
[Preserve as fontes existentes]

PESQUISA DE REFERÊNCIA

${pesquisa}

ARTIGO ORIGINAL

${artigo}
`;
}

function limparRespostaClaude_(texto) {
  if (!texto || texto.trim().length < 500) {
    throw new Error(
      'O Claude retornou uma revisão vazia ou muito curta.'
    );
  }

  let resultado = texto
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/\*\*/g, '')
    .replace(/characterísticos/gi, 'característicos')
    .trim();

  const obrigatorios = [
    'CLASSIFICAÇÃO:',
    'TÍTULO REVISADO:',
    '=== CONTEÚDO PARA PUBLICAÇÃO ==='
  ];

  obrigatorios.forEach(function (marcador) {
    if (!resultado.includes(marcador)) {
      throw new Error(
        'A revisão não contém o marcador obrigatório: ' +
        marcador
      );
    }
  });

  resultado = aplicarRegraEvergreen_(resultado);

  return resultado;
}

function aplicarRegraEvergreen_(texto) {
  if (!/CLASSIFICAÇÃO:\s*EVERGREEN/i.test(texto)) {
    return texto;
  }

  const removerAno = function (valor) {
    return valor
      .replace(/\s*[-–—:]?\s*\b20\d{2}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  texto = texto.replace(
    /(TÍTULO REVISADO:\s*\n?)([^\n]+)/i,
    function (_, rotulo, titulo) {
      return rotulo + removerAno(titulo);
    }
  );

  texto = texto.replace(
    /(TÍTULO SEO:\s*\n?)([^\n]+)/i,
    function (_, rotulo, titulo) {
      return rotulo + removerAno(titulo);
    }
  );

  const separador = '=== CONTEÚDO PARA PUBLICAÇÃO ===';
  const posicao = texto.indexOf(separador);

  if (posicao >= 0) {
    const antes = texto.substring(0, posicao + separador.length);
    let depois = texto.substring(posicao + separador.length);

    depois = depois.replace(
      /(^#\s+[^\n]*)/m,
      function (tituloH1) {
        return removerAno(tituloH1);
      }
    );

    texto = antes + depois;
  }

  return texto;
}

function criarDocumentoRevisado_(pauta, conteudo) {
  const documento = DocumentApp.create(
    'Revisado — ' + pauta.titulo
  );

  const corpo = documento.getBody();

  corpo.appendParagraph('Revisão editorial')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);

  corpo.appendParagraph(
    'Versão revisada automaticamente. Aprovação humana obrigatória.'
  ).setForegroundColor('#b45309');

  corpo.appendHorizontalRule();

  inserirMarkdownSimples_(corpo, conteudo);

  documento.saveAndClose();

  const pastaRevisaoId =
    '1i_7BplN8lOJf7EHMiVhPw7ANzEeOuW32';

  const pastaRevisao =
    DriveApp.getFolderById(pastaRevisaoId);

  const arquivo =
    DriveApp.getFileById(documento.getId());

  arquivo.moveTo(pastaRevisao);

  return DocumentApp.openById(documento.getId());
}
function verificarGeminiApi() {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade GEMINI_API_KEY não foi encontrada.'
    );
  }

  SpreadsheetApp.getUi().alert(
    'Gemini API configurada corretamente.'
  );
}
const IMAGENS_CONFIG = {
  PASTA_IMAGENS_ID: '1Tv198KwA4_8L6XiqgbX09wcQU-Bpmx_d',
  PASTA_REVISAO_ID: '1i_7BplN8lOJf7EHMiVhPw7ANzEeOuW32',
  ABA_FILA: 'Fila de imagens',
  MODELO: 'gemini-3.1-flash-image'
};

function enfileirarImagensSelecionadas() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da pauta que deseja processar.'
    );
    return;
  }

  if (aba.getName() !== 'Pauta editorial') {
    SpreadsheetApp.getUi().alert(
      'Execute este comando na aba Pauta editorial.'
    );
    return;
  }

  const colunas = obterColunas_(aba);

  validarColunas_(colunas, [
    'Título',
    'Tipo',
    'Categoria',
    'Palavra-chave principal',
    'Slug',
    'Link da revisão',
    'Link final',
    'Status das imagens',
    'Observações'
  ]);

  const pauta = {
    linha: linha,
    titulo: obterValor_(aba, linha, colunas, 'Título'),
    tipo: obterValor_(aba, linha, colunas, 'Tipo'),
    categoria: obterValor_(aba, linha, colunas, 'Categoria'),
    palavraChave: obterValor_(
      aba,
      linha,
      colunas,
      'Palavra-chave principal'
    ),
    slug: obterValor_(aba, linha, colunas, 'Slug'),
    linkRevisao: obterValor_(
      aba,
      linha,
      colunas,
      'Link da revisão'
    ),
    observacoes: obterValor_(
      aba,
      linha,
      colunas,
      'Observações'
    )
  };

  if (!pauta.slug) {
    SpreadsheetApp.getUi().alert(
      'A pauta não possui slug.'
    );
    return;
  }

  if (!pauta.linkRevisao) {
    SpreadsheetApp.getUi().alert(
      'A pauta ainda não possui Link da revisão.'
    );
    return;
  }

  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    SpreadsheetApp.getUi().alert(
      'A propriedade GEMINI_API_KEY não foi encontrada.'
    );
    return;
  }

  try {
    const abaFila = obterOuCriarAbaFila_();

    if (existeFilaAtiva_(abaFila, pauta.slug)) {
      throw new Error(
        'Já existe uma fila ativa para este artigo.'
      );
    }

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status das imagens',
      'Preparando fila'
    );

    SpreadsheetApp.flush();

    const textoRevisao = lerDocumentoGoogle_(
      pauta.linkRevisao
    );

    const pastaArtigo = obterOuCriarPastaImagens_(
      pauta.slug
    );

    const documentoFinal = criarDocumentoFinal_(pauta);

    const marcadores = prepararMarcadoresImagens_(
      documentoFinal.getId(),
      pauta,
      textoRevisao
    );

    gravarTarefasFila_(
      abaFila,
      pauta,
      documentoFinal.getId(),
      pastaArtigo.getId(),
      marcadores
    );

    instalarGatilhoImagens_();

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Link final',
      documentoFinal.getUrl()
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status das imagens',
      'Na fila'
    );

    const novaObservacao =
      'Fila de imagens criada em ' +
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      ) +
      '. Total: ' +
      marcadores.length +
      ' imagens.';

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      pauta.observacoes
        ? pauta.observacoes + '\n' + novaObservacao
        : novaObservacao
    );

    SpreadsheetApp.getUi().alert(
      'Fila preparada com ' +
      marcadores.length +
      ' imagens.\n\nDocumento final:\n' +
      documentoFinal.getUrl()
    );
  } catch (erro) {
    atualizarValor_(
      aba,
      linha,
      colunas,
      'Status das imagens',
      'Erro ao preparar'
    );

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro ao preparar imagens: ' + erro.message
    );

    SpreadsheetApp.getUi().alert(
      'Não foi possível preparar as imagens:\n\n' +
      erro.message
    );
  }
}

function obterOuCriarAbaFila_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(
    IMAGENS_CONFIG.ABA_FILA
  );

  const cabecalhos = [
    'ID',
    'Slug',
    'Linha pauta',
    'Documento final ID',
    'Pasta ID',
    'Marcador',
    'Nome arquivo',
    'Tipo imagem',
    'Proporção',
    'Prompt',
    'Status',
    'Tentativas',
    'Arquivo ID',
    'Erro',
    'Criado em',
    'Atualizado em'
  ];

  if (!aba) {
    aba = planilha.insertSheet(
      IMAGENS_CONFIG.ABA_FILA
    );

    aba
      .getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos]);

    aba.setFrozenRows(1);
    aba.hideSheet();
  }

  return aba;
}

function existeFilaAtiva_(abaFila, slug) {
  const ultimaLinha = abaFila.getLastRow();

  if (ultimaLinha < 2) {
    return false;
  }

  const valores = abaFila
    .getRange(2, 1, ultimaLinha - 1, 16)
    .getDisplayValues();

  const estadosAtivos = [
    'Pendente',
    'Gerando',
    'Erro temporário'
  ];

  return valores.some(function (linha) {
    return (
      linha[1] === slug &&
      estadosAtivos.includes(linha[10])
    );
  });
}

function obterOuCriarPastaImagens_(slug) {
  const pastaPai = DriveApp.getFolderById(
    IMAGENS_CONFIG.PASTA_IMAGENS_ID
  );

  const encontradas = pastaPai.getFoldersByName(slug);

  if (encontradas.hasNext()) {
    return encontradas.next();
  }

  return pastaPai.createFolder(slug);
}

function criarDocumentoFinal_(pauta) {
  const revisaoId = extrairIdGoogle_(
    pauta.linkRevisao
  );

  if (!revisaoId) {
    throw new Error(
      'Não foi possível identificar o documento revisado.'
    );
  }

  const arquivoRevisao = DriveApp.getFileById(
    revisaoId
  );

  const pastaRevisao = DriveApp.getFolderById(
    IMAGENS_CONFIG.PASTA_REVISAO_ID
  );

  const copia = arquivoRevisao.makeCopy(
    'Final — ' + pauta.titulo,
    pastaRevisao
  );

  return DocumentApp.openById(copia.getId());
}

function prepararMarcadoresImagens_(
  documentoId,
  pauta,
  textoRevisao
) {
  const marcadoresExistentes =
    extrairMarcadoresImagens_(textoRevisao);

  const quantidade = calcularQuantidadeImagens_(
    pauta.tipo
  );

  const marcadores = marcadoresExistentes.slice();

  const possuiCapa = marcadores.some(function (item) {
    return ehNomeDeCapa_(item.nome);
  });

  if (!possuiCapa) {
    marcadores.unshift({
      marcador:
        '[IMAGEM: capa-' + pauta.slug + '.webp]',
      nome: 'capa-' + pauta.slug + '.webp',
      tipo: 'Capa',
      proporcao: '16:9'
    });
  }

  while (marcadores.length < quantidade) {
    const numero = marcadores.length;

    marcadores.push({
      marcador:
        '[IMAGEM: editorial-' +
        numero +
        '-' +
        pauta.slug +
        '.webp]',
      nome:
        'editorial-' +
        numero +
        '-' +
        pauta.slug +
        '.webp',
      tipo: 'Interna',
      proporcao: '4:3'
    });
  }

  if (marcadores.length > quantidade) {
    marcadores.splice(quantidade);
  }

  marcadores.forEach(function (item, indice) {
    // O prompt do artigo pede "imagem-principal-<slug>", enquanto o
    // marcador criado aqui usa "capa-<slug>". Os dois valem como capa.
    item.tipo = indice === 0 && ehNomeDeCapa_(item.nome)
      ? 'Capa'
      : 'Interna';

    item.proporcao =
      item.tipo === 'Capa' ? '16:9' : '4:3';

    item.prompt = montarPromptImagem_(
      pauta,
      item,
      indice
    );
  });

  garantirMarcadoresNoDocumento_(
    documentoId,
    marcadores
  );

  return marcadores;
}

function ehNomeDeCapa_(nome) {
  return /capa|principal|hero/i.test(String(nome || ''));
}

function extrairMarcadoresImagens_(texto) {
  const regex = /\[IMAGEM:\s*([^\]]+)\]/gi;
  const resultados = [];
  const encontrados = new Set();
  let correspondencia;

  while ((correspondencia = regex.exec(texto)) !== null) {
    const nome = correspondencia[1].trim();
    const marcador = correspondencia[0];

    if (!encontrados.has(marcador)) {
      encontrados.add(marcador);

      resultados.push({
        marcador: marcador,
        nome: nome,
        tipo: 'Interna',
        proporcao: '4:3'
      });
    }
  }

  return resultados;
}

function calcularQuantidadeImagens_(tipo) {
  const tipoNormalizado = String(tipo)
    .toLowerCase()
    .trim();

  if (tipoNormalizado === 'pilar') {
    return 5;
  }

  if (tipoNormalizado === 'satélite') {
    return 3;
  }

  if (tipoNormalizado === 'review') {
    return 3;
  }

  if (tipoNormalizado === 'comparativo') {
    return 4;
  }

  return 3;
}

function topcMapearParagrafos_(corpo) {
  const paragrafos = [];

  for (let i = 0; i < corpo.getNumChildren(); i++) {
    const filho = corpo.getChild(i);

    const ehParagrafo =
      filho.getType() === DocumentApp.ElementType.PARAGRAPH;

    paragrafos.push({
      texto: filho.getText ? filho.getText() : '',
      ehH1: ehParagrafo &&
        filho.asParagraph().getHeading() ===
          DocumentApp.ParagraphHeading.HEADING1
    });
  }

  return paragrafos;
}

function garantirMarcadoresNoDocumento_(
  documentoId,
  marcadores
) {
  const documento = DocumentApp.openById(
    documentoId
  );

  const corpo = documento.getBody();
  const textoAtual = corpo.getText();
  const paragrafos = topcMapearParagrafos_(corpo);

  const h1 = topcIndiceDoH1_(paragrafos);
  let fim = topcIndiceFimDoArtigo_(paragrafos);

  // A capa entra logo depois do H1 e as internas antes das fontes.
  // Fora desses limites a imagem fica no cabeçalho da revisão ou no
  // rodapé, e o envelope do site nunca chega a referenciá-la.
  marcadores.forEach(function (item) {
    if (textoAtual.includes(item.marcador)) {
      return;
    }

    const posicao = item.tipo === 'Capa'
      ? (h1 >= 0 ? h1 + 1 : Math.min(3, corpo.getNumChildren()))
      : fim;

    if (posicao >= 0 && posicao <= corpo.getNumChildren()) {
      corpo.insertParagraph(posicao, item.marcador);

      if (fim >= 0 && posicao <= fim) {
        fim += 1;
      }
    } else {
      corpo.appendParagraph(item.marcador);
    }
  });

  documento.saveAndClose();
}

function montarPromptImagem_(pauta, item, indice) {
  const ehIlustrativa =
    /review|comparativo/i.test(pauta.tipo);

  const funcao =
    item.tipo === 'Capa'
      ? 'imagem principal de capa'
      : 'imagem editorial interna número ' + indice;

  return `
Crie uma ${funcao} para um artigo brasileiro.

Tema do artigo: ${pauta.titulo}
Palavra-chave: ${pauta.palavraChave}
Categoria: ${pauta.categoria}
Tipo de conteúdo: ${pauta.tipo}
Referência visual: ${item.nome}
Proporção: ${item.proporcao}

Direção de arte:

- Fotografia editorial realista e elegante.
- Composição clean, moderna e natural.
- Paleta com verdes discretos, tons neutros e madeira clara.
- Iluminação natural suave.
- Imagem horizontal.
- Sem qualquer texto dentro da imagem.
- Sem logotipos, marcas ou marcas d'água.
- Sem embalagem identificável.
- Não reproduzir um produto comercial específico.
- Não criar comparações antes/depois.
- Não mostrar preços ou selos promocionais.
- Não incluir elementos enganosos.
${ehIlustrativa
  ? '- A cena deve ser genérica e claramente ilustrativa, sem tentar reproduzir produtos citados.'
  : ''}
`;
}

function gravarTarefasFila_(
  abaFila,
  pauta,
  documentoFinalId,
  pastaId,
  marcadores
) {
  const agora = new Date();

  const linhas = marcadores.map(function (item) {
    return [
      Utilities.getUuid(),
      pauta.slug,
      pauta.linha,
      documentoFinalId,
      pastaId,
      item.marcador,
      item.nome,
      item.tipo,
      item.proporcao,
      item.prompt.trim(),
      'Pendente',
      0,
      '',
      '',
      agora,
      agora
    ];
  });

  abaFila
    .getRange(
      abaFila.getLastRow() + 1,
      1,
      linhas.length,
      16
    )
    .setValues(linhas);
}
function instalarGatilhoImagens_() {
  const nomeFuncao = 'processarFilaImagens';

  const existente = ScriptApp
    .getProjectTriggers()
    .some(function (gatilho) {
      return (
        gatilho.getHandlerFunction() === nomeFuncao
      );
    });

  if (!existente) {
    ScriptApp
      .newTrigger(nomeFuncao)
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

function processarFilaImagens() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaFila = planilha.getSheetByName(
    IMAGENS_CONFIG.ABA_FILA
  );

  if (!abaFila || abaFila.getLastRow() < 2) {
    removerGatilhoSeFilaVazia_();
    return;
  }

  const tarefa = reservarProximaTarefa_(abaFila);

  if (!tarefa) {
    removerGatilhoSeFilaVazia_();
    return;
  }

  try {
    let arquivo;

    if (tarefa.arquivoId) {
      arquivo = DriveApp.getFileById(
        tarefa.arquivoId
      );
    } else {
      const imagem = gerarImagemGemini_(
        tarefa.prompt,
        tarefa.proporcao
      );

      const nomeArquivo = montarNomeArquivo_(
        tarefa.nomeArquivo,
        imagem.mimeType
      );

      imagem.blob.setName(nomeArquivo);

      const pasta = DriveApp.getFolderById(
        tarefa.pastaId
      );

      arquivo = pasta.createFile(imagem.blob);

      abaFila
        .getRange(tarefa.linhaFila, 13)
        .setValue(arquivo.getId());
    }

    inserirImagemNoDocumento_(
      tarefa,
      arquivo
    );

    abaFila
      .getRange(tarefa.linhaFila, 11)
      .setValue('Concluída');

    abaFila
      .getRange(tarefa.linhaFila, 14)
      .setValue('');

    abaFila
      .getRange(tarefa.linhaFila, 16)
      .setValue(new Date());

  } catch (erro) {
    const status =
      tarefa.tentativas >= 3
        ? 'Falha'
        : 'Erro temporário';

    abaFila
      .getRange(tarefa.linhaFila, 11)
      .setValue(status);

    abaFila
      .getRange(tarefa.linhaFila, 14)
      .setValue(
        limitarMensagemErro_(erro.message)
      );

    abaFila
      .getRange(tarefa.linhaFila, 16)
      .setValue(new Date());
  }

  finalizarLoteSePronto_(
    tarefa.slug,
    tarefa.linhaPauta
  );

  removerGatilhoSeFilaVazia_();
}

function reservarProximaTarefa_(abaFila) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const ultimaLinha = abaFila.getLastRow();

    if (ultimaLinha < 2) {
      return null;
    }

    const dados = abaFila
      .getRange(2, 1, ultimaLinha - 1, 16)
      .getDisplayValues();

    for (let i = 0; i < dados.length; i++) {
      const linha = dados[i];
      const status = linha[10];
      const tentativas = Number(linha[11] || 0);

      const podeProcessar =
        status === 'Pendente' ||
        status === 'Erro temporário';

      if (podeProcessar && tentativas < 3) {
        const linhaFila = i + 2;
        const novasTentativas = tentativas + 1;

        abaFila
          .getRange(linhaFila, 11)
          .setValue('Gerando');

        abaFila
          .getRange(linhaFila, 12)
          .setValue(novasTentativas);

        abaFila
          .getRange(linhaFila, 16)
          .setValue(new Date());

        SpreadsheetApp.flush();

        return {
          linhaFila: linhaFila,
          id: linha[0],
          slug: linha[1],
          linhaPauta: Number(linha[2]),
          documentoFinalId: linha[3],
          pastaId: linha[4],
          marcador: linha[5],
          nomeArquivo: linha[6],
          tipoImagem: linha[7],
          proporcao: linha[8],
          prompt: linha[9],
          status: 'Gerando',
          tentativas: novasTentativas,
          arquivoId: linha[12]
        };
      }
    }

    return null;
  } finally {
    lock.releaseLock();
  }
}

// A geração de imagem da Gemini API vive em v1beta e configura a
// proporção em generationConfig.imageConfig, com valores como "16:9".
// A forma antiga (responseFormat + enums ASPECT_RATIO_*) é do Vertex AI
// e faz a chamada falhar com erro de aspect_ratio.
function montarUrlImagemGemini_() {
  return (
    'https://generativelanguage.googleapis.com/' +
    'v1beta/models/' +
    IMAGENS_CONFIG.MODELO +
    ':generateContent'
  );
}

function montarPayloadImagemGemini_(prompt, proporcao) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: [
        'TEXT',
        'IMAGE'
      ],
      imageConfig: {
        aspectRatio: proporcao === '16:9' ? '16:9' : '4:3',
        imageSize: '1K'
      }
    }
  };
}

function gerarImagemGemini_(prompt, proporcao) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade GEMINI_API_KEY não foi encontrada.'
    );
  }

  const url = montarUrlImagemGemini_();
  const payload = montarPayloadImagemGemini_(prompt, proporcao);

  const resposta = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();
  let dados;

  try {
    dados = JSON.parse(texto);
  } catch (erro) {
    throw new Error(
      'A API do Gemini retornou uma resposta inválida.'
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem =
      dados.error?.message ||
      texto;

    throw new Error(
      'Erro do Gemini (' +
      codigo +
      '): ' +
      mensagem
    );
  }

  const candidatos = dados.candidates || [];
  let parteImagem = null;

  candidatos.some(function (candidato) {
    const partes =
      candidato.content?.parts || [];

    parteImagem = partes.find(function (parte) {
      return (
        parte.inlineData &&
        parte.inlineData.data
      );
    });

    return Boolean(parteImagem);
  });

  if (!parteImagem) {
    throw new Error(
      'O Gemini não retornou uma imagem.'
    );
  }

  const mimeType =
    parteImagem.inlineData.mimeType ||
    'image/png';

  const bytes = Utilities.base64Decode(
    parteImagem.inlineData.data
  );

  const blob = Utilities.newBlob(
    bytes,
    mimeType
  );

  return {
    blob: blob,
    mimeType: mimeType
  };
}

function montarNomeArquivo_(nomeOriginal, mimeType) {
  const base = String(nomeOriginal)
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const extensoes = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
  };

  const extensao =
    extensoes[mimeType] || '.png';

  return base + extensao;
}

// A inserção das imagens no documento final fica em ImageInsert.js.

function limitarMensagemErro_(mensagem) {
  return String(mensagem || 'Erro desconhecido')
    .substring(0, 500);
}

function finalizarLoteSePronto_(
  slug,
  linhaPauta
) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaFila = planilha.getSheetByName(
    IMAGENS_CONFIG.ABA_FILA
  );

  if (!abaFila || abaFila.getLastRow() < 2) {
    return;
  }

  const dados = abaFila
    .getRange(
      2,
      1,
      abaFila.getLastRow() - 1,
      16
    )
    .getDisplayValues();

  const tarefas = dados.filter(function (linha) {
    return linha[1] === slug;
  });

  const ativos = tarefas.filter(function (linha) {
    return [
      'Pendente',
      'Gerando',
      'Erro temporário'
    ].includes(linha[10]);
  });

  if (ativos.length) {
    return;
  }

  const concluidas = tarefas.filter(function (linha) {
    return linha[10] === 'Concluída';
  }).length;

  const falhas = tarefas.filter(function (linha) {
    return linha[10] === 'Falha';
  }).length;

  const abaPauta = planilha.getSheetByName(
    'Pauta editorial'
  );

  const colunas = obterColunas_(abaPauta);

  const statusFinal =
    falhas > 0
      ? 'Concluído com pendências'
      : 'Concluído';

  atualizarValor_(
    abaPauta,
    linhaPauta,
    colunas,
    'Status das imagens',
    statusFinal
  );

  const observacaoAtual = obterValor_(
    abaPauta,
    linhaPauta,
    colunas,
    'Observações'
  );

  const resumo =
    'Imagens finalizadas em ' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    ) +
    '. Geradas: ' +
    concluidas +
    '. Falhas: ' +
    falhas +
    '.';

  atualizarValor_(
    abaPauta,
    linhaPauta,
    colunas,
    'Observações',
    observacaoAtual
      ? observacaoAtual + '\n' + resumo
      : resumo
  );
}

function removerGatilhoSeFilaVazia_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaFila = planilha.getSheetByName(
    IMAGENS_CONFIG.ABA_FILA
  );

  let possuiAtivos = false;

  if (abaFila && abaFila.getLastRow() >= 2) {
    const estados = abaFila
      .getRange(
        2,
        11,
        abaFila.getLastRow() - 1,
        1
      )
      .getDisplayValues()
      .flat();

    possuiAtivos = estados.some(function (estado) {
      return [
        'Pendente',
        'Gerando',
        'Erro temporário'
      ].includes(estado);
    });
  }

  if (!possuiAtivos) {
    ScriptApp
      .getProjectTriggers()
      .filter(function (gatilho) {
        return (
          gatilho.getHandlerFunction() ===
          'processarFilaImagens'
        );
      })
      .forEach(function (gatilho) {
        ScriptApp.deleteTrigger(gatilho);
      });
  }
}
function repararFilaImagensAtual() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(IMAGENS_CONFIG.ABA_FILA);

  if (!aba || aba.getLastRow() < 2) {
    throw new Error('A fila de imagens não foi encontrada.');
  }

  const valores = aba
    .getRange(2, 1, aba.getLastRow() - 1, 16)
    .getValues();

  let reabertas = 0;

  valores.forEach(function(linha, indice) {
    const marcador = String(linha[5] || '').trim();
    const status = String(linha[10] || '').trim();

    if (marcador === '[IMAGEM: ...]') {
      aba.getRange(indice + 2, 11).setValue('Ignorada');
      aba.getRange(indice + 2, 14)
        .setValue('Marcador genérico ignorado automaticamente.');
      aba.getRange(indice + 2, 16).setValue(new Date());
      return;
    }

    // Qualquer falha volta para a fila. Restringir por mensagem de erro
    // deixava presa toda tarefa que falhasse por outro motivo.
    if (status === 'Falha' || status === 'Erro temporário') {
      aba.getRange(indice + 2, 11).setValue('Pendente');
      aba.getRange(indice + 2, 12).setValue(0);
      aba.getRange(indice + 2, 14).clearContent();
      aba.getRange(indice + 2, 16).setValue(new Date());
      reabertas += 1;
    }
  });

  instalarGatilhoImagens_();

  SpreadsheetApp.getUi().alert(
    reabertas +
    ' tarefa(s) reaberta(s). O processamento será retomado ' +
    'automaticamente em até um minuto.'
  );
}
const TOPC_SITE_AUTOMATION = {
  BASE_URL: 'https://top-comparativos-br.olavon.chatgpt.site'
};

function testarConexaoSite() {
  const sourceKey = 'teste-hmac';
  const body = JSON.stringify({});

  const resposta = topcEnviarAssinado_(
    `/api/automation/articles/${encodeURIComponent(sourceKey)}`,
    sourceKey,
    body,
    'application/json'
  );

  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();

  // 400 invalid_envelope é o resultado esperado:
  // significa que a autenticação HMAC passou e o Site chegou
  // até a validação do conteúdo.
  if (
    codigo === 400 &&
    texto.indexOf('invalid_envelope') !== -1
  ) {
    SpreadsheetApp.getUi().alert(
      'Conexão com o Top Comparativos autenticada com sucesso!'
    );
    return;
  }

  throw new Error(
    'Falha no teste do Site. HTTP ' + codigo + ': ' + texto
  );
}

function topcEnviarAssinado_(path, sourceKey, body, contentType) {
  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AUTOMATION_HMAC_SECRET');

  if (!secret) {
    throw new Error(
      'AUTOMATION_HMAC_SECRET não encontrado nas Propriedades do Script.'
    );
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = Utilities.getUuid();

  const bodyHash = topcSha256Hex_(body);

  const canonical = [
    timestamp,
    requestId,
    sourceKey,
    bodyHash
  ].join('\n');

  const signature = topcHmacSha256Hex_(
    canonical,
    secret
  );

  return UrlFetchApp.fetch(
    TOPC_SITE_AUTOMATION.BASE_URL + path,
    {
      method: 'post',
      contentType: contentType,
      payload: body,
      headers: {
        'X-Automation-Timestamp': timestamp,
        'X-Automation-Request-Id': requestId,
        'X-Automation-Source-Key': sourceKey,
        'X-Automation-Signature': signature
      },
      muteHttpExceptions: true
    }
  );
}

function topcSha256Hex_(texto) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    texto,
    Utilities.Charset.UTF_8
  );

  return topcBytesParaHex_(bytes);
}

function topcHmacSha256Hex_(texto, secret) {
  const bytes = Utilities.computeHmacSha256Signature(
    texto,
    secret,
    Utilities.Charset.UTF_8
  );

  return topcBytesParaHex_(bytes);
}

function topcBytesParaHex_(bytes) {
  return bytes.map(function(b) {
    const valor = (b + 256) % 256;
    return ('0' + valor.toString(16)).slice(-2);
  }).join('');
}
function diagnosticarHmacTopComparativos() {
  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AUTOMATION_HMAC_SECRET') || '';

  const body = '{}';
  const timestamp = '1700000000';
  const requestId = 'diagnostico-hmac';
  const sourceKey = 'teste-hmac';

  const bodyHash = topcSha256Hex_(body);

  const canonical = [
    timestamp,
    requestId,
    sourceKey,
    bodyHash
  ].join('\n');

  const signature = topcHmacSha256Hex_(
    canonical,
    secret
  );

  Logger.log(JSON.stringify({
    secretEncontrado: secret.length > 0,
    tamanhoSecret: secret.length,
    prefixoCorreto: secret.indexOf('tc_hmac_') === 0,
    contemIgual: secret.indexOf('=') !== -1,
    possuiEspacosExternos: secret !== secret.trim(),
    bodyHash: bodyHash,
    assinatura: signature,
    tamanhoAssinatura: signature.length
  }));
}
function testarMontagemRascunhoSite() {
  const envelope = topcMontarEnvelopeSelecionado_();

  Logger.log(JSON.stringify({
    titulo: envelope.title,
    slug: envelope.slug,
    blocos: envelope.document.blocks.length,
    fontes: envelope.sources.length,
    produtos: envelope.products.length,
    cluster: envelope.clusterKey,
    papel: envelope.clusterRole
  }));
}
function topcMontarEnvelopeSelecionado_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial') {
    throw new Error('Execute na aba "Pauta editorial".');
  }

  if (linha <= 1) {
    throw new Error('Selecione uma linha de artigo.');
  }

  const ultimaColuna = aba.getLastColumn();

  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0];

  const valores = aba
    .getRange(linha, 1, 1, ultimaColuna)
    .getDisplayValues()[0];

  const dados = {};

  cabecalhos.forEach(function(nome, indice) {
    dados[String(nome).trim()] = valores[indice];
  });

  const linkFinal = String(dados['Link final'] || '').trim();

  if (!linkFinal) {
    throw new Error('A linha não possui "Link final".');
  }

  const documentId = topcExtrairGoogleId_(linkFinal);
const documento = DocumentApp.openById(documentId);

const slug = String(dados['Slug'] || '').trim();

const midias = topcObterMidiasConcluidas_(linha, slug);

const resultado = topcConverterDocumentoEditorial_(
  documento,
  midias
);
  const palavraChave = String(
    dados['Palavra-chave principal'] || ''
  ).trim();

  const intencao = String(dados['Intenção'] || '').trim();
  const tipo = String(dados['Tipo'] || '').trim();
  const pilarRelacionado = String(
    dados['Pilar relacionado'] || ''
  ).trim();

  if (!slug) {
    throw new Error('A pauta não possui Slug.');
  }

  if (!palavraChave) {
    throw new Error('A pauta não possui Palavra-chave principal.');
  }

  if (!intencao) {
    throw new Error('A pauta não possui Intenção.');
  }

  const clusterRole =
    tipo.toLowerCase().indexOf('pilar') !== -1
      ? 'pillar'
      : 'satellite';

  let clusterKey;

  if (clusterRole === 'pillar') {
    clusterKey = slug;
  } else {
    if (!pilarRelacionado) {
      throw new Error(
        'Post satélite sem "Pilar relacionado".'
      );
    }

    clusterKey = topcSlugificar_(pilarRelacionado);
  }

  return {
    title: resultado.title.substring(0, 160),

    slug: slug,

    excerpt: resultado.excerpt.substring(0, 300),

    primaryKeyword: palavraChave.substring(0, 160),

    searchIntent: intencao.substring(0, 100),

    seo: {
      title: resultado.seoTitle.substring(0, 160),
      description: resultado.seoDescription.substring(0, 300)
    },

    document: {
      version: 1,
      blocks: resultado.blocks.slice(0, 200)
    },

    products: [],

    sources: resultado.sources.slice(0, 30),

    clusterKey: clusterKey.substring(0, 120),

    clusterRole: clusterRole
  };
}


function topcConverterDocumentoEditorial_(documento, midias) {
  const body = documento.getBody();
  const blocks = [];
  const sources = [];

  midias = midias || [];

  // As imagens do documento entram como posições reservadas e só são
  // ligadas às mídias da fila no fim, quando a ordem completa é conhecida.
  const imagensDoDocumento = [];
  let posicaoDaCapa = 0;

  let encontrouArtigo = false;
  let coletandoFontes = false;
  let titulo = '';
  let primeiroParagrafo = '';
  let emFaq = false;

  for (let i = 0; i < body.getNumChildren(); i++) {

    const elemento = body.getChild(i);
    const tipo = elemento.getType();

    /*
     * TABELAS
     */
    if (
      encontrouArtigo &&
      !coletandoFontes &&
      tipo === DocumentApp.ElementType.TABLE
    ) {
      const tabela = elemento.asTable();

      if (tabela.getNumRows() >= 1) {
        const headers = [];
        const rows = [];

        const primeiraLinha = tabela.getRow(0);

        for (
          let c = 0;
          c < primeiraLinha.getNumCells() && c < 12;
          c++
        ) {
          headers.push(
            primeiraLinha.getCell(c).getText().trim()
          );
        }

        for (
          let r = 1;
          r < tabela.getNumRows() && rows.length < 50;
          r++
        ) {
          const row = [];
          const linhaTabela = tabela.getRow(r);

          for (
            let c = 0;
            c < headers.length;
            c++
          ) {
            const texto =
              c < linhaTabela.getNumCells()
                ? linhaTabela.getCell(c).getText().trim()
                : '';

            row.push(texto || '-');
          }

          rows.push(row);
        }

        if (
          headers.length &&
          headers.every(function(h) {
            return h.length > 0;
          })
        ) {
          blocks.push({
            type: 'table',
            headers: headers,
            rows: rows
          });
        }
      }

      continue;
    }

    /*
     * LISTAS
     */
    if (
      encontrouArtigo &&
      !coletandoFontes &&
      tipo === DocumentApp.ElementType.LIST_ITEM
    ) {
      const items = [];

      while (
        i < body.getNumChildren() &&
        body.getChild(i).getType() ===
          DocumentApp.ElementType.LIST_ITEM
      ) {
        const texto = body
          .getChild(i)
          .asListItem()
          .getText()
          .trim();

        if (texto) {
          items.push(texto.substring(0, 1000));
        }

        i++;
      }

      i--;

      if (items.length) {
        blocks.push({
          type: 'list',
          style: 'unordered',
          items: items.slice(0, 50)
        });
      }

      continue;
    }

    if (tipo !== DocumentApp.ElementType.PARAGRAPH) {
      continue;
    }

    const paragrafo = elemento.asParagraph();

    if (
      encontrouArtigo &&
      !coletandoFontes &&
      topcParagrafoTemImagem_(paragrafo)
    ) {
      imagensDoDocumento.push({
        indice: blocks.length,
        alt: topcAltPrimeiraImagem_(paragrafo)
      });

      blocks.push(null);

      continue;
    }

    const texto = paragrafo.getText().trim();

    if (!texto) {
      continue;
    }

    const heading = paragrafo.getHeading();

    /*
     * O primeiro H1 marca o início do artigo.
     * Tudo que existe antes dele é material editorial interno.
     */
    if (
      !encontrouArtigo &&
      heading === DocumentApp.ParagraphHeading.HEADING1
    ) {
      encontrouArtigo = true;
      titulo = texto;
      posicaoDaCapa = blocks.length;

      continue;
    }

    /*
     * FONTES
     */
    if (
      texto.toUpperCase() === 'FONTES PARA REVISÃO:' ||
      texto.toUpperCase() === 'FONTES PARA REVISÃO'
    ) {
      coletandoFontes = true;
      continue;
    }

    if (coletandoFontes) {
      if (/^https?:\/\//i.test(texto)) {
        sources.push({
          label: topcNomeFonte_(texto),
          url: texto
        });
      }

      continue;
    }

    /*
     * Marcadores que serão tratados depois pelos
     * sistemas automáticos de imagens e links internos.
     */
    if (/^\[IMAGEM:/i.test(texto)) {
      continue;
    }

    if (/^\[LINK-INTERNO:/i.test(texto)) {
      continue;
    }

    /*
     * HEADINGS
     */
    if (heading === DocumentApp.ParagraphHeading.HEADING2) {

      if (
        texto.toLowerCase().indexOf(
          'perguntas frequentes'
        ) !== -1
      ) {
        emFaq = true;
      }

      blocks.push({
        type: 'heading',
        level: 2,
        text: texto.substring(0, 300)
      });

      continue;
    }

    if (heading === DocumentApp.ParagraphHeading.HEADING3) {
      blocks.push({
        type: 'heading',
        level: 3,
        text: texto.substring(0, 300)
      });

      continue;
    }

    if (heading === DocumentApp.ParagraphHeading.HEADING4) {
      blocks.push({
        type: 'heading',
        level: 4,
        text: texto.substring(0, 300)
      });

      continue;
    }

    /*
     * No FAQ, perguntas viram H3 automaticamente.
     */
    if (
      emFaq &&
      texto.endsWith('?') &&
      texto.length <= 300
    ) {
      blocks.push({
        type: 'heading',
        level: 3,
        text: texto
      });

      continue;
    }

    /*
     * PARÁGRAFOS
     */
    if (!primeiroParagrafo) {
      primeiroParagrafo = texto;
    }

    blocks.push({
      type: 'paragraph',
      text: texto.substring(0, 10000)
    });
  }

  if (!titulo) {
    throw new Error(
      'Não encontrei o H1 do artigo no Google Docs.'
    );
  }

  if (!primeiroParagrafo) {
    throw new Error(
      'Não encontrei a introdução do artigo.'
    );
  }

  const plano = topcPlanejarImagensDocumento_(
    imagensDoDocumento.map(function (item) {
      return item.alt;
    }),
    midias
  );

  imagensDoDocumento.forEach(function (item, indice) {
    const midia = plano.atribuicoes[indice];

    blocks[item.indice] = midia
      ? {
          type: 'image',
          mediaKey: midia.mediaKey,
          alt: midia.alt
        }
      : null;
  });

  // Capa que não aparece no corpo entra logo depois do H1, para que o
  // envelope sempre referencie todas as mídias concluídas da pauta.
  if (plano.capaRestante) {
    blocks.splice(posicaoDaCapa, 0, {
      type: 'image',
      mediaKey: plano.capaRestante.mediaKey,
      alt: plano.capaRestante.alt
    });
  }

  const blocosFinais = blocks.filter(function (bloco) {
    return Boolean(bloco);
  });

  if (!blocosFinais.length) {
    throw new Error(
      'Nenhum bloco editorial foi encontrado.'
    );
  }

  return topcNormalizarRevisaoEditorial_({
    title: titulo,
    excerpt: primeiroParagrafo,
    blocks: blocosFinais,
    sources: sources
  });
}


function topcAltPrimeiraImagem_(paragrafo) {
  for (let i = 0; i < paragrafo.getNumChildren(); i++) {
    const filho = paragrafo.getChild(i);

    if (filho.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      return String(filho.asInlineImage().getAltTitle() || '');
    }
  }

  return '';
}


function topcExtrairGoogleId_(url) {
  const texto = String(url || '');

  let match = texto.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (match) {
    return match[1];
  }

  match = texto.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (match) {
    return match[1];
  }

  throw new Error(
    'Não foi possível identificar o ID do Google Docs.'
  );
}


function topcSlugificar_(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120);
}


function topcNomeFonte_(url) {
  return String(url)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .substring(0, 300);
}
function enviarRascunhoSiteSelecionado() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial' || linha <= 1) {
    throw new Error('Selecione um artigo na aba "Pauta editorial".');
  }

  const headers = aba
    .getRange(1, 1, 1, aba.getLastColumn())
    .getDisplayValues()[0];

  const valores = aba
    .getRange(linha, 1, 1, aba.getLastColumn())
    .getDisplayValues()[0];

  const dados = {};

  headers.forEach(function(header, i) {
    dados[String(header).trim()] = valores[i];
  });

  const id = String(dados['ID'] || '').trim();

  if (!id) {
    throw new Error('A pauta não possui ID.');
  }

  const sourceKey = 'pauta-' + id;

  const envelope = topcMontarEnvelopeSelecionado_();
  const body = JSON.stringify(envelope);

  Logger.log(
    'Enviando rascunho: ' +
    envelope.slug +
    ' | ' +
    envelope.document.blocks.length +
    ' blocos'
  );

  const resposta = topcEnviarAssinado_(
    '/api/automation/articles/' +
      encodeURIComponent(sourceKey),
    sourceKey,
    body,
    'application/json'
  );

  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();

  Logger.log('HTTP ' + codigo);
  Logger.log(texto);

  if (codigo !== 200 && codigo !== 201) {
    throw new Error(
      'Falha ao enviar rascunho. HTTP ' +
      codigo +
      ': ' +
      texto
    );
  }

  const retorno = JSON.parse(texto);
  const article = retorno.article;

  if (!article || !article.articleId) {
    throw new Error(
      'O site não retornou os dados do artigo. Resposta: ' +
      texto.substring(0, 500)
    );
  }

  topcPersistirVersaoSite_(aba, linha, article.updatedAt);

  const preview =
    TOPC_SITE_AUTOMATION.BASE_URL +
    '/admin/artigos/' +
    article.articleId +
    '/preview';

  Logger.log('Rascunho enviado com sucesso.');
  Logger.log('Article ID: ' + article.articleId);
  Logger.log('Preview: ' + preview);

SpreadsheetApp.getActiveSpreadsheet().toast(
  'Rascunho enviado. Article ID: ' +
    article.articleId +
    '. Ainda não publicado.',
  'Top Comparativos',
  6
);
}
function testarImagensNoEnvelopeSite() {
  const envelope = topcMontarEnvelopeSelecionado_();

  const imagens = envelope.document.blocks.filter(function(bloco) {
    return bloco.type === 'image';
  });

  Logger.log(JSON.stringify({
    totalBlocos: envelope.document.blocks.length,
    imagensEncontradas: imagens.length,
    imagens: imagens.map(function(img) {
      return img.mediaKey;
    })
  }));

  if (imagens.length !== 4) {
    throw new Error(
      'Esperadas 4 imagens no envelope, mas foram encontradas ' +
      imagens.length +
      '.'
    );
  }
}
// A leitura da "Fila de imagens" fica em MediaQueue.js.


function topcParagrafoTemImagem_(paragrafo) {
  for (
    let i = 0;
    i < paragrafo.getNumChildren();
    i++
  ) {
    if (
      paragrafo.getChild(i).getType() ===
      DocumentApp.ElementType.INLINE_IMAGE
    ) {
      return true;
    }
  }

  return false;
}
