// O site é a autoridade final da publicação e devolve apenas um código de
// erro, sem detalhes. Este arquivo cobre os dois lados desse silêncio: o
// que dá para validar antes da rede e o que fazer quando o site recusa.

const TOPC_VERSAO_SITE_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const TOPC_ERROS_PUBLICACAO = {
  editorial_publish_invalid:
    'O site recusou a versão do rascunho na validação editorial dele. ' +
    'Causas conhecidas, em ordem de probabilidade: (1) a "Versão no site" ' +
    'da planilha está desatualizada, porque o site troca essa versão a ' +
    'cada gravação — refaça os passos 5, 6 e 7 nessa ordem; (2) o artigo ' +
    'não atende às exigências de publicação do site (capa, fontes, ' +
    'produtos, aviso de afiliado ou data de revisão). Rode ' +
    '"Ferramentas > Diagnosticar publicação" para ver o que o envelope ' +
    'está enviando antes de tentar de novo.',
  editorial_publish_conflict:
    'A "Versão no site" da planilha não corresponde mais à versão atual ' +
    'do artigo no site. Refaça os passos 5, 6 e 7 nessa ordem.',
  invalid_envelope:
    'O site recusou o formato do envelope. Reenvie o rascunho (passo 5) e ' +
    'confira o documento final antes de publicar.'
};

function topcVersaoSiteValida_(versao) {
  return TOPC_VERSAO_SITE_ISO.test(String(versao || '').trim());
}

function topcValidarPrePublicacao_(contexto, envelope, midias) {
  if (!contexto.id) throw new Error('A pauta não possui ID.');
  if (!contexto.slug) throw new Error('A pauta não possui Slug.');
  if (!contexto.linkFinal) throw new Error('A pauta não possui Link final.');
  if (!contexto.versaoSite) {
    throw new Error(
      'A pauta não possui Versão no site. Envie o rascunho ao site novamente.'
    );
  }
  if (!topcVersaoSiteValida_(contexto.versaoSite)) {
    throw new Error(
      'A Versão no site não está no formato ISO-8601 esperado pelo site: "' +
      String(contexto.versaoSite).substring(0, 80) +
      '". A planilha provavelmente converteu o texto em data. Formate a ' +
      'coluna "Versão no site" como texto simples e refaça o passo 5.'
    );
  }
  if (contexto.statusImagens !== 'Concluído') {
    throw new Error('Status das imagens precisa estar como Concluído.');
  }

  const blocks = envelope &&
    envelope.document &&
    Array.isArray(envelope.document.blocks)
      ? envelope.document.blocks
      : [];

  if (!blocks.length) {
    throw new Error('O rascunho não possui blocos editoriais.');
  }

  const refs = blocks
    .filter(function(block) { return block.type === 'image'; })
    .map(function(block) { return block.mediaKey; });

  midias.forEach(function(media) {
    if (refs.indexOf(media.mediaKey) === -1) {
      throw new Error(
        'Imagem não referenciada no envelope: ' + media.mediaKey
      );
    }
  });
}

function topcPersistirVersaoSite_(aba, linha, updatedAt) {
  const versao = String(updatedAt || '').trim();
  if (!versao) {
    throw new Error('A versão retornada pelo Site está vazia.');
  }

  const ultimaColuna = aba.getLastColumn();
  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0];
  let colunaVersao = cabecalhos.findIndex(function(header) {
    return String(header).trim() === 'Versão no site';
  }) + 1;

  if (!colunaVersao) {
    colunaVersao = ultimaColuna + 1;
    aba.getRange(1, colunaVersao).setValue('Versão no site');
  }

  // Texto simples: sem isso a planilha converte a versão em data e o
  // corpo da publicação sai com a data formatada no lugar do ISO-8601.
  const celula = aba.getRange(linha, colunaVersao);

  if (typeof celula.setNumberFormat === 'function') {
    celula.setNumberFormat('@');
  }

  celula.setValue(versao);
}

function topcAdicionarPublishMenu_(menu) {
  return menu
    .addSeparator()
    .addItem(
      '7. Publicar artigo no site',
      'publicarArtigoSiteSelecionado'
    );
}

function topcExplicarErroPublicacao_(texto) {
  let codigo = '';

  try {
    codigo = String(JSON.parse(String(texto || '')).error || '').trim();
  } catch (erro) {
    codigo = '';
  }

  return TOPC_ERROS_PUBLICACAO[codigo] || '';
}

function topcValidarRespostaPublicacao_(codigo, sourceKey, texto) {
  if (codigo === 200) return;

  const explicacao = topcExplicarErroPublicacao_(texto);

  throw new Error(
    'Falha ao publicar ' + sourceKey +
    '. HTTP ' + codigo + ': ' + String(texto || '').substring(0, 500) +
    (explicacao ? '\n\n' + explicacao : '')
  );
}

function topcObterContextoPublicacao_(aba, linha) {
  const ultimaColuna = aba.getLastColumn();
  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0];
  const valores = aba
    .getRange(linha, 1, 1, ultimaColuna)
    .getDisplayValues()[0];
  const dados = {};

  cabecalhos.forEach(function(header, indice) {
    dados[String(header).trim()] = valores[indice];
  });

  return {
    id: String(dados['ID'] || '').trim(),
    slug: String(dados['Slug'] || '').trim(),
    linkFinal: String(dados['Link final'] || '').trim(),
    statusImagens: String(dados['Status das imagens'] || '').trim(),
    versaoSite: String(dados['Versão no site'] || '').trim()
  };
}

function topcResumirPublicacao_(contexto, envelope, midias) {
  const blocos = envelope &&
    envelope.document &&
    Array.isArray(envelope.document.blocks)
      ? envelope.document.blocks
      : [];

  const imagens = blocos.filter(function(bloco) {
    return bloco && bloco.type === 'image';
  });

  const fontes = Array.isArray(envelope && envelope.sources)
    ? envelope.sources
    : [];

  const produtos = Array.isArray(envelope && envelope.products)
    ? envelope.products
    : [];

  const concluidas = midias || [];

  const capas = concluidas.filter(function(media) {
    return media && media.role === 'cover';
  });

  const semReferencia = concluidas
    .filter(function(media) {
      return imagens.every(function(bloco) {
        return bloco.mediaKey !== media.mediaKey;
      });
    })
    .map(function(media) { return media.mediaKey; });

  const pendencias = [];

  if (!topcVersaoSiteValida_(contexto.versaoSite)) {
    pendencias.push(
      'A "Versão no site" não está em ISO-8601. Refaça o passo 5.'
    );
  }

  if (semReferencia.length) {
    pendencias.push(
      'Imagens concluídas fora do envelope: ' + semReferencia.join(', ') +
      '. Rode "Ferramentas > Diagnosticar imagens da pauta".'
    );
  }

  if (!capas.length) {
    pendencias.push(
      'Nenhuma imagem com papel "cover" na fila. O artigo iria ao ar sem ' +
      'capa e o site pode recusar a publicação.'
    );
  }

  if (!fontes.length) {
    pendencias.push(
      'O envelope não tem nenhuma fonte. Confirme o bloco ' +
      '"FONTES PARA REVISÃO:" no fim do documento final.'
    );
  }

  if (produtos.length < 2) {
    pendencias.push(
      'O envelope envia ' + produtos.length + ' produto(s). A validação ' +
      'de publicação do site exige pelo menos dois produtos com link ' +
      'de afiliado, e o Apps Script ainda não preenche essa lista.'
    );
  }

  return {
    sourceKey: 'pauta-' + contexto.id,
    slug: contexto.slug,
    versaoSite: contexto.versaoSite,
    versaoValida: topcVersaoSiteValida_(contexto.versaoSite),
    statusImagens: contexto.statusImagens,
    blocos: blocos.length,
    imagensNoEnvelope: imagens.map(function(bloco) {
      return bloco.mediaKey;
    }),
    midiasConcluidas: concluidas.map(function(media) {
      return media.mediaKey + ' (' + media.role + ')';
    }),
    fontes: fontes.length,
    produtos: produtos.length,
    titulo: envelope && envelope.title,
    tamanhoExcerpt: String((envelope && envelope.excerpt) || '').length,
    pendencias: pendencias,
    veredito: pendencias.length
      ? pendencias.length + ' ponto(s) a verificar antes de publicar.'
      : 'O envelope está pronto no que o Apps Script consegue validar. ' +
        'Se o site ainda recusar, a causa está nas regras editoriais dele.'
  };
}

function diagnosticarPublicacaoSelecionada() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial' || linha <= 1) {
    throw new Error('Selecione um artigo na aba "Pauta editorial".');
  }

  const contexto = topcObterContextoPublicacao_(aba, linha);
  const envelope = topcMontarEnvelopeSelecionado_();
  const midias = topcObterMidiasConcluidas_(linha, contexto.slug);
  const resumo = topcResumirPublicacao_(contexto, envelope, midias);

  Logger.log(JSON.stringify(resumo, null, 2));

  planilha.toast(resumo.veredito, 'Diagnóstico de publicação', 15);

  return resumo;
}

function publicarArtigoSiteSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial' || linha <= 1) {
    throw new Error('Selecione um artigo na aba "Pauta editorial".');
  }

  return publicarArtigoSiteLinha_(aba, linha);
}

// Núcleo sem depender da célula ativa: usado pelo fluxo completo
// automático, que roda em contexto de gatilho (sem seleção de célula).
function publicarArtigoSiteLinha_(aba, linha) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const contexto = topcObterContextoPublicacao_(aba, linha);
  const envelope = topcMontarEnvelopeLinha_(aba, linha);
  const midias = topcObterMidiasConcluidas_(linha, contexto.slug);

  topcValidarPrePublicacao_(contexto, envelope, midias);

  const sourceKey = 'pauta-' + contexto.id;
  const body = JSON.stringify({
    expectedUpdatedAt: contexto.versaoSite
  });
  const resposta = topcEnviarAssinado_(
    '/api/automation/articles/' +
      encodeURIComponent(sourceKey) +
      '/publish',
    sourceKey,
    body,
    'application/json'
  );
  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();

  topcValidarRespostaPublicacao_(codigo, sourceKey, texto);

  Logger.log(JSON.stringify({
    sourceKey: sourceKey,
    slug: contexto.slug,
    status: 'published'
  }));

  planilha.toast(
    'Artigo publicado: ' + contexto.slug,
    'Top Comparativos',
    8
  );
}
