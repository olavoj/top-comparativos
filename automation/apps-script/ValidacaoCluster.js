// Valida que o pilar de um cluster existe e já foi gerado antes de
// permitir a geração de artigos satélites.
// Escopo global compartilhado com Código.js (sem imports, ambiente Apps Script).
// Depende de topcSlugificar_, definida em Código.js.

const TOPC_STATUS_PILAR_VALIDO = [
  'publicado',
  'pronto para publicar',
  'em revisão',
  'rascunho gerado'
];

function topcLocalizarPautaPorTitulo_(aba, titulo) {
  const alvo = topcSlugificar_(titulo);

  if (!alvo) return null;

  const ultimaLinha = aba.getLastRow();
  const ultimaColuna = aba.getLastColumn();

  if (ultimaLinha < 2) return null;

  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0]
    .map(function (h) { return String(h).trim(); });

  const valores = aba
    .getRange(2, 1, ultimaLinha - 1, ultimaColuna)
    .getDisplayValues();

  const idxTitulo = cabecalhos.indexOf('Título');
  const idxSlug = cabecalhos.indexOf('Slug');
  const idxStatus = cabecalhos.indexOf('Status');
  const idxTipo = cabecalhos.indexOf('Tipo');

  if (idxTitulo === -1 || idxStatus === -1 || idxTipo === -1) {
    throw new Error(
      'A aba precisa das colunas Título, Status e Tipo.'
    );
  }

  for (let i = 0; i < valores.length; i++) {
    const linha = valores[i];
    const tituloLinha = topcSlugificar_(linha[idxTitulo]);
    const slugLinha = idxSlug === -1
      ? ''
      : topcSlugificar_(linha[idxSlug]);

    if (tituloLinha === alvo || (slugLinha && slugLinha === alvo)) {
      return {
        linha: i + 2,
        titulo: String(linha[idxTitulo] || '').trim(),
        status: String(linha[idxStatus] || '').trim(),
        tipo: String(linha[idxTipo] || '').trim()
      };
    }
  }

  return null;
}

function topcValidarPilarDaPauta_(aba, pauta) {
  const ehPilar = String(pauta.tipo || '')
    .toLowerCase()
    .indexOf('pilar') !== -1;

  if (ehPilar) {
    if (String(pauta.pilar || '').trim()) {
      throw new Error(
        'Uma pauta do tipo Pilar não pode ter "Pilar relacionado" ' +
        'preenchido. Um pilar não pertence a outro cluster.'
      );
    }
    return;
  }

  const referencia = String(pauta.pilar || '').trim();

  if (!referencia) {
    throw new Error(
      'Pauta satélite sem "Pilar relacionado". Crie e gere o post ' +
      'pilar do cluster antes de gerar este artigo.'
    );
  }

  const pilar = topcLocalizarPautaPorTitulo_(aba, referencia);

  if (!pilar) {
    throw new Error(
      'O pilar "' + referencia + '" não existe na aba Pauta editorial. ' +
      'Cadastre a pauta do pilar antes de gerar satélites.'
    );
  }

  if (String(pilar.tipo).toLowerCase().indexOf('pilar') === -1) {
    throw new Error(
      'A pauta "' + referencia + '" está marcada como "' + pilar.tipo +
      '", não como Pilar. Corrija a coluna Tipo na linha ' +
      pilar.linha + '.'
    );
  }

  const status = pilar.status.toLowerCase();
  const valido = TOPC_STATUS_PILAR_VALIDO.some(function (aceito) {
    return status.indexOf(aceito) !== -1;
  });

  if (!valido) {
    throw new Error(
      'O pilar "' + referencia + '" está com status "' + pilar.status +
      '". Gere o artigo do pilar antes de gerar os satélites do cluster.'
    );
  }
}
