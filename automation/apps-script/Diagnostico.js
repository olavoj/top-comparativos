// Compara o que a fila considera pronto com o que o envelope realmente
// referencia, e diz onde cada imagem está dentro do documento final.
// É a resposta para "Imagem não referenciada no envelope".

function topcMapearImagensDoDocumento_(corpo) {
  const posicoes = [];
  let viuH1 = false;
  let viuFontes = false;

  for (let i = 0; i < corpo.getNumChildren(); i++) {
    const filho = corpo.getChild(i);

    if (filho.getType() !== DocumentApp.ElementType.PARAGRAPH) {
      continue;
    }

    const paragrafo = filho.asParagraph();
    const texto = paragrafo.getText().trim();

    if (
      !viuH1 &&
      paragrafo.getHeading() === DocumentApp.ParagraphHeading.HEADING1
    ) {
      viuH1 = true;
    }

    if (/^FONTES PARA REVIS/i.test(texto)) {
      viuFontes = true;
    }

    if (topcParagrafoTemImagem_(paragrafo)) {
      posicoes.push({
        indice: i,
        alt: topcAltPrimeiraImagem_(paragrafo),
        antesDoH1: !viuH1,
        depoisDasFontes: viuFontes
      });
    }
  }

  return posicoes;
}

function topcResumirImagensDaPauta_(midias, referenciadas, posicoes) {
  const naoReferenciadas = midias
    .filter(function (midia) {
      return referenciadas.indexOf(midia.mediaKey) === -1;
    })
    .map(function (midia) {
      return midia.mediaKey;
    });

  const foraDoArtigo = posicoes.filter(function (posicao) {
    return posicao.antesDoH1 || posicao.depoisDasFontes;
  }).length;

  let veredito;

  if (!naoReferenciadas.length) {
    veredito = 'Todas as imagens concluídas estão referenciadas.';
  } else if (foraDoArtigo) {
    veredito = foraDoArtigo + ' imagem(ns) está(ão) fora do corpo do ' +
      'artigo, antes do H1 ou depois das fontes. Mova-as para dentro do ' +
      'artigo no documento final e reenvie o rascunho.';
  } else if (posicoes.length < midias.length) {
    veredito = 'O documento final tem menos imagens do que a fila. ' +
      'Provavelmente há um lote antigo na "Fila de imagens" apontando ' +
      'para outro documento final.';
  } else {
    veredito = 'As imagens estão no artigo, mas o envelope não as ' +
      'referenciou. Reenvie o rascunho ao site.';
  }

  return {
    midiasNaFila: midias.map(function (midia) {
      return midia.mediaKey + ' (' + midia.role + ')';
    }),
    referenciadasNoEnvelope: referenciadas,
    naoReferenciadas: naoReferenciadas,
    imagensNoDocumento: posicoes,
    veredito: veredito
  };
}

function diagnosticarImagensDaPauta() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== 'Pauta editorial' || linha <= 1) {
    throw new Error('Selecione um artigo na aba "Pauta editorial".');
  }

  const cabecalhos = aba
    .getRange(1, 1, 1, aba.getLastColumn())
    .getDisplayValues()[0];

  const valores = aba
    .getRange(linha, 1, 1, aba.getLastColumn())
    .getDisplayValues()[0];

  const dados = {};

  cabecalhos.forEach(function (header, i) {
    dados[String(header).trim()] = valores[i];
  });

  const slug = String(dados['Slug'] || '').trim();
  const linkFinal = String(dados['Link final'] || '').trim();

  if (!linkFinal) {
    throw new Error('A pauta não possui "Link final".');
  }

  const midias = topcObterMidiasConcluidas_(linha, slug);
  const envelope = topcMontarEnvelopeSelecionado_();

  const referenciadas = envelope.document.blocks
    .filter(function (bloco) { return bloco.type === 'image'; })
    .map(function (bloco) { return bloco.mediaKey; });

  const documento = DocumentApp.openById(
    topcExtrairGoogleId_(linkFinal)
  );

  const resumo = topcResumirImagensDaPauta_(
    midias,
    referenciadas,
    topcMapearImagensDoDocumento_(documento.getBody())
  );

  Logger.log(JSON.stringify(resumo, null, 2));

  planilha.toast(resumo.veredito, 'Diagnóstico de imagens', 15);

  return resumo;
}
