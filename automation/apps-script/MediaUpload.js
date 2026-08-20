function topcSha256BytesHex_(bytes) {
  return topcBytesParaHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}

function topcAdicionarUploadMenu_(menu) {
  return menu.addSeparator().addItem('6. Enviar imagens ao site', 'enviarImagensSiteSelecionadas');
}

function topcNormalizarMidiasPorArquivo_(midias) {
  return (midias || []).map(function(media) {
    if (!media || !media.fileId) return media;
    const arquivo = DriveApp.getFileById(media.fileId);
    const contentType = String(arquivo.getBlob().getContentType() || '').toLowerCase();
    return Object.assign({}, media, {
      mediaKey: topcNormalizarMediaKeyPorMime_(media.mediaKey, contentType)
    });
  });
}

function topcEnviarBytesAssinados_(path, sourceKey, bytes, contentType, mediaHeaders) {
  const secret = PropertiesService.getScriptProperties().getProperty('AUTOMATION_HMAC_SECRET');
  if (!secret) throw new Error('AUTOMATION_HMAC_SECRET não encontrado.');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = Utilities.getUuid();
  const bodyHash = topcSha256BytesHex_(bytes);
  const canonical = topcMontarCanonical_(timestamp, requestId, sourceKey, bodyHash);
  const headers = Object.assign({}, mediaHeaders, {
    'X-Automation-Timestamp': timestamp,
    'X-Automation-Request-Id': requestId,
    'X-Automation-Source-Key': sourceKey,
    'X-Automation-Signature': topcHmacSha256Hex_(canonical, secret)
  });
  return UrlFetchApp.fetch(TOPC_SITE_AUTOMATION.BASE_URL + path, { method: 'post', contentType, payload: bytes, headers, muteHttpExceptions: true });
}

const TOPC_ERROS_UPLOAD_MIDIA = {
  media_article_not_found:
    'O site ainda não tem um rascunho para este artigo (ou ele foi ' +
    'removido/recriado do lado do site). Rode "5. Enviar rascunho ao ' +
    'site" antes de "6. Enviar imagens ao site".'
};

function topcExplicarErroUploadMidia_(texto) {
  let codigo = '';
  try {
    codigo = String(JSON.parse(String(texto || '')).error || '').trim();
  } catch (erro) {
    codigo = '';
  }
  return TOPC_ERROS_UPLOAD_MIDIA[codigo] || '';
}

function topcValidarRespostaUpload_(codigo, mediaKey, texto) {
  if (codigo === 200 || codigo === 201) return;
  const explicacao = topcExplicarErroUploadMidia_(texto);
  throw new Error(
    'Falha ao enviar ' + mediaKey + '. HTTP ' + codigo + ': ' + String(texto || '').substring(0, 500) +
    (explicacao ? '\n\n' + explicacao : '')
  );
}

function topcEnviarImagemSite_(sourceKey, media, referencedMediaKeys) {
  const arquivo = DriveApp.getFileById(media.fileId);
  const blob = arquivo.getBlob();
  const bytes = blob.getBytes();
  const contentType = String(blob.getContentType() || '').toLowerCase();

  topcValidarUploadMidia_(media, contentType, bytes.length, referencedMediaKeys);
  const sha256 = topcSha256BytesHex_(bytes);
  const mediaHeaders = topcMontarCabecalhosMidia_(media, sha256);
  const path = '/api/automation/articles/' + encodeURIComponent(sourceKey) + '/media';
  const resposta = topcEnviarBytesAssinados_(path, sourceKey, bytes, contentType, mediaHeaders);
  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();
  topcValidarRespostaUpload_(codigo, media.mediaKey, texto);
  return { mediaKey: media.mediaKey, status: codigo === 201 ? 'created' : 'reused' };
}

function enviarImagensSiteSelecionadas() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();
  if (aba.getName() !== 'Pauta editorial' || linha <= 1) throw new Error('Selecione um artigo na aba "Pauta editorial".');
  return enviarImagensSiteLinha_(aba, linha);
}

// Núcleo sem depender da célula ativa: usado pelo fluxo completo
// automático, que roda em contexto de gatilho (sem seleção de célula).
function enviarImagensSiteLinha_(aba, linha) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const ultimaColuna = aba.getLastColumn();
  const cabecalhos = aba.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0];
  const valores = aba.getRange(linha, 1, 1, ultimaColuna).getDisplayValues()[0];
  const dados = {};
  cabecalhos.forEach(function(header, indice) { dados[String(header).trim()] = valores[indice]; });
  const id = String(dados['ID'] || '').trim();
  const slug = String(dados['Slug'] || '').trim();
  if (!id) throw new Error('A pauta não possui ID.');
  if (!slug) throw new Error('A pauta não possui Slug.');
  const sourceKey = 'pauta-' + id;
  const midias = topcNormalizarMidiasPorArquivo_(topcObterMidiasConcluidas_(linha, slug));
  if (!midias.length) throw new Error(topcDiagnosticarFilaDaPauta_(linha, slug));
  const envelope = topcMontarEnvelopeLinha_(aba, linha);
  const referencedMediaKeys = envelope.document.blocks.filter(function(block) { return block.type === 'image'; }).map(function(block) { return block.mediaKey; });
  const resultados = [];
  midias.forEach(function(media) {
    const resultado = topcEnviarImagemSite_(sourceKey, media, referencedMediaKeys);
    resultados.push(resultado); Logger.log(JSON.stringify(resultado));
  });
  const criadas = resultados.filter(function(item) { return item.status === 'created'; }).length;
  const reutilizadas = resultados.length - criadas;
  Logger.log(JSON.stringify({ total: resultados.length, created: criadas, reused: reutilizadas }));
  planilha.toast(resultados.length + ' imagens processadas: ' + criadas + ' novas e ' + reutilizadas + ' reutilizadas.', 'Top Comparativos', 8);
  return resultados;
}
