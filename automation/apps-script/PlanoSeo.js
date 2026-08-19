// Etapa 3-4 do plano de estratégia SEO: transforma o JSON validado por
// AnaliseSeo.js num Doc editável, grava o plano na planilha e reseta
// qualquer aprovação anterior — regenerar o plano invalida a aprovação
// que valia para o conteúdo antigo, não pode ficar "Aprovado" sozinha
// apontando para um plano diferente do que foi de fato revisado.
//
// A aprovação em si continua manual: alguém edita "Status do plano"
// para "Aprovado" direto na planilha. Este arquivo só prepara o terreno
// para isso (Doc legível + colunas) e faz a leitura que a etapa de
// artigo (fora deste escopo) vai usar para checar se pode avançar.

function criarDocumentoPlano_(pauta, plano) {
  const documento = DocumentApp.create(
    'Plano SEO — ' + pauta.titulo
  );

  const corpo = documento.getBody();

  corpo.appendParagraph('Plano SEO')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);

  corpo.appendParagraph(pauta.titulo)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  corpo.appendParagraph('Palavra-chave: ' + plano.keyword);
  corpo.appendParagraph('Idioma / país: ' + plano.language + ' / ' + plano.country);

  corpo.appendHorizontalRule();

  corpo.appendParagraph('Intenção de busca')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  corpo.appendParagraph('Principal: ' + plano.intent.primary);
  corpo.appendParagraph('Confiança: ' + plano.intent.confidence);
  if (plano.intent.secondary && plano.intent.secondary.length) {
    corpo.appendParagraph('Secundárias: ' + plano.intent.secondary.join(', '));
  }
  if (plano.intent.evidence && plano.intent.evidence.length) {
    corpo.appendParagraph('Evidências:');
    plano.intent.evidence.forEach(function (item) {
      corpo.appendListItem(item);
    });
  }

  corpo.appendParagraph('Página recomendada')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  corpo.appendParagraph('Tipo: ' + plano.recommended_page.type);
  corpo.appendParagraph('Título: ' + plano.recommended_page.title);
  corpo.appendParagraph('Slug: ' + plano.recommended_page.slug);
  corpo.appendParagraph('Estágio do funil: ' + plano.recommended_page.funnel_stage);
  corpo.appendParagraph('Objetivo: ' + plano.recommended_page.objective);

  corpo.appendParagraph('Mapa de palavras-chave')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Principais', plano.keyword_map.primary);
  topcListarSeNaoVazio_(corpo, 'Secundárias', plano.keyword_map.secondary);
  topcListarSeNaoVazio_(corpo, 'Perguntas', plano.keyword_map.questions);
  topcListarSeNaoVazio_(corpo, 'Entidades', plano.keyword_map.entities);

  corpo.appendParagraph('Análise da SERP')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Formatos predominantes', plano.serp_analysis.formats);
  topcListarSeNaoVazio_(corpo, 'Padrões dos concorrentes', plano.serp_analysis.patterns);
  topcListarSeNaoVazio_(corpo, 'Lacunas de conteúdo', plano.serp_analysis.content_gaps);
  topcListarSeNaoVazio_(corpo, 'URLs de concorrentes', plano.serp_analysis.competitor_urls);

  corpo.appendParagraph('Estrutura do artigo')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  plano.outline.forEach(function (secao) {
    corpo.appendParagraph(secao.heading)
      .setHeading(
        secao.level === 'H3'
          ? DocumentApp.ParagraphHeading.HEADING3
          : DocumentApp.ParagraphHeading.HEADING2
      );
    corpo.appendParagraph('Objetivo: ' + secao.purpose);
    if (secao.questions_answered && secao.questions_answered.length) {
      corpo.appendParagraph('Perguntas respondidas: ' + secao.questions_answered.join('; '));
    }
    if (secao.evidence_required && secao.evidence_required.length) {
      corpo.appendParagraph('Evidências necessárias: ' + secao.evidence_required.join('; '));
    }
  });

  corpo.appendParagraph('Diferenciação e conversão')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Diferenciais', plano.differentiation);
  topcListarSeNaoVazio_(corpo, 'Links internos sugeridos', plano.internal_links);
  topcListarSeNaoVazio_(corpo, 'Elementos de conversão', plano.conversion_elements);
  topcListarSeNaoVazio_(corpo, 'Dados estruturados aplicáveis', plano.structured_data);

  corpo.appendParagraph('Fontes e riscos')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  topcListarSeNaoVazio_(corpo, 'Fontes', plano.sources);
  topcListarSeNaoVazio_(corpo, 'Riscos', plano.risks);
  topcListarSeNaoVazio_(corpo, 'Pontos que exigem revisão humana', plano.human_review);

  documento.saveAndClose();
  moverParaPastaProducao_(documento.getId());

  return DocumentApp.openById(documento.getId());
}

function topcListarSeNaoVazio_(corpo, rotulo, itens) {
  if (!itens || !itens.length) {
    return;
  }

  corpo.appendParagraph(rotulo + ':');
  itens.forEach(function (item) {
    corpo.appendListItem(item);
  });
}

function gravarPlanoLinha_(aba, linha, colunas, plano, documento) {
  const hash = topcSha256Hex_(JSON.stringify(plano));
  const statusAnterior = obterValor_(aba, linha, colunas, 'Status do plano');

  atualizarValor_(aba, linha, colunas, 'Link do plano SEO', documento.getUrl());
  atualizarValor_(aba, linha, colunas, 'Status do plano', 'Plano gerado');
  atualizarValor_(aba, linha, colunas, 'Hash do plano', hash);

  // Regenerar o plano invalida qualquer aprovação anterior: ela valia
  // para o conteúdo antigo, não para este. Sem isso, um "Analisar SEO"
  // repetido por engano deixaria "Aprovado" apontando pra um plano que
  // ninguém aprovou de fato.
  if (statusAnterior === 'Aprovado' || statusAnterior === 'Rejeitado') {
    atualizarValor_(aba, linha, colunas, 'Aprovado por', '');
    atualizarValor_(aba, linha, colunas, 'Aprovado em', '');
  }

  return hash;
}

function analisarSeoSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione uma célula da linha que contém a pesquisa.'
    );
    return;
  }

  try {
    analisarSeoLinha_(aba, linha);
  } catch (erro) {
    SpreadsheetApp.getUi().alert(
      'Não foi possível gerar o plano SEO:\n\n' + erro.message
    );
  }
}

const TOPC_COLUNAS_PLANO_SEO = [
  'Link do plano SEO',
  'Status do plano',
  'Aprovado por',
  'Aprovado em',
  'Hash do plano'
];

// Cria, se ainda não existir, cada cabeçalho de coluna passado — mesma
// ideia de topcPersistirVersaoSite_ (Publish.js) para "Versão no site":
// procura pelo texto do cabeçalho e só acrescenta uma coluna nova no
// fim da planilha se não achar. Não sobrescreve nada que já exista.
function topcGarantirColuna_(aba, nomeColuna) {
  const ultimaColuna = aba.getLastColumn();
  const cabecalhos = ultimaColuna
    ? aba.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0]
    : [];

  const indiceExistente = cabecalhos.findIndex(function (cabecalho) {
    return String(cabecalho).trim() === nomeColuna;
  });

  if (indiceExistente !== -1) {
    return indiceExistente + 1;
  }

  const novaColuna = ultimaColuna + 1;
  aba.getRange(1, novaColuna).setValue(nomeColuna);

  return novaColuna;
}

function topcGarantirColunasPlanoSeo_(aba) {
  TOPC_COLUNAS_PLANO_SEO.forEach(function (nomeColuna) {
    topcGarantirColuna_(aba, nomeColuna);
  });
}

// Núcleo sem UI, mesmo padrão de gerarArtigoLinha_: lê a pesquisa da
// linha, chama a análise estruturada no Claude, cria o Doc do plano e
// grava as colunas — sem tocar em nada além disso.
function analisarSeoLinha_(aba, linha) {
  // As colunas do plano SEO são criadas sozinhas, na hora, se ainda não
  // existirem — igual "Versão no site" no passo 5. As demais (Título,
  // Palavra-chave etc.) continuam exigidas de verdade: são dados que
  // alguém precisa ter preenchido, não cabeçalhos que dá pra inventar.
  topcGarantirColunasPlanoSeo_(aba);

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
    linkPesquisa: obterValor_(aba, linha, colunas, 'Link da pesquisa')
  };

  if (!pauta.linkPesquisa) {
    throw new Error('Esta linha ainda não possui um link de pesquisa.');
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(aba, linha, colunas, 'Status do plano', 'Analisando...');
    SpreadsheetApp.flush();

    const pesquisaTexto = lerDocumentoGoogle_(pauta.linkPesquisa);
    const plano = analisarSeoNoClaude_(pauta, pesquisaTexto);
    const documento = criarDocumentoPlano_(pauta, plano);
    const hash = gravarPlanoLinha_(aba, linha, colunas, plano, documento);

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Plano SEO gerado em ' +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        ) +
        '. Aguardando aprovação (Status do plano).'
    );

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Plano SEO gerado: ' + documento.getUrl(),
      'Top Comparativos',
      8
    );

    return { documento: documento, plano: plano, hash: hash };
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status do plano', 'Erro');
    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro ao gerar plano SEO: ' + erro.message
    );

    throw erro;
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}

// Usado pela geração de artigo (fora deste arquivo) para decidir se pode
// seguir com o plano aprovado ou se deve cair no fluxo legado (pesquisa
// bruta direto). Não lança erro — quem chama decide o que fazer com
// cada situação.
function topcObterStatusPlanoLinha_(aba, linha) {
  const colunas = obterColunas_(aba);

  if (!colunas['Status do plano'] || !colunas['Link do plano SEO']) {
    return { existe: false, aprovado: false, status: '' };
  }

  const linkPlano = obterValor_(aba, linha, colunas, 'Link do plano SEO');
  const status = obterValor_(aba, linha, colunas, 'Status do plano');

  return {
    existe: Boolean(linkPlano),
    aprovado: status === 'Aprovado',
    status: status
  };
}
