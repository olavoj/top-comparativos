function topcValidarPrePublicacao_(contexto, envelope, midias) {
  if (!contexto.id) throw new Error('A pauta não possui ID.');
  if (!contexto.slug) throw new Error('A pauta não possui Slug.');
  if (!contexto.linkFinal) throw new Error('A pauta não possui Link final.');
  if (!contexto.versaoSite) {
    throw new Error(
      'A pauta não possui Versão no site. Envie o rascunho ao site novamente.'
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

  aba.getRange(linha, colunaVersao).setValue(versao);
}

function topcAdicionarPublishMenu_(menu) {
  return menu
    .addSeparator()
    .addItem(
      '6. Publicar artigo no site',
      'publicarArtigoSiteSelecionado'
    );
}

function topcValidarRespostaPublicacao_(codigo, sourceKey, texto) {
  if (codigo === 200) return;

  throw new Error(
    'Falha ao publicar ' + sourceKey +
    '. HTTP ' + codigo + ': ' + String(texto || '').substring(0, 500)
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

function publicarArtigoSiteSelecionado() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial' || linha <= 1) {
    throw new Error('Selecione um artigo na aba "Pauta editorial".');
  }

  const contexto = topcObterContextoPublicacao_(aba, linha);
  const envelope = topcMontarEnvelopeSelecionado_();
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
