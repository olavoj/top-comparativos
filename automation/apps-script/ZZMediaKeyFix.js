// Mantém envelope, upload e publicação usando a mesma mediaKey real.
// O prefixo ZZ garante que este override substitua a versão de Código.js no clasp.
function topcObterMidiasConcluidas_(linhaPauta, slug) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName('Fila de imagens');

  if (!aba) throw new Error('A aba "Fila de imagens" não foi encontrada.');

  const valores = aba.getDataRange().getDisplayValues();
  const headers = valores[0];
  const colunas = {};
  headers.forEach(function(header, i) { colunas[String(header).trim()] = i; });

  ['Slug', 'Linha pauta', 'Nome arquivo', 'Tipo imagem', 'Status', 'Arquivo ID'].forEach(function(nome) {
    if (colunas[nome] === undefined) throw new Error('Coluna não encontrada na Fila de imagens: ' + nome);
  });

  const encontradas = [];
  let posicaoInterna = 0;

  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    const rowSlug = String(row[colunas['Slug']] || '').trim();
    const rowLinha = String(row[colunas['Linha pauta']] || '').trim();
    const status = String(row[colunas['Status']] || '').trim();
    const arquivoId = String(row[colunas['Arquivo ID']] || '').trim();

    if (rowSlug !== slug || rowLinha !== String(linhaPauta) || status !== 'Concluída' || !arquivoId) continue;

    const nomeArquivoFila = String(row[colunas['Nome arquivo']] || '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(nomeArquivoFila)) throw new Error('Nome de imagem inválido: ' + nomeArquivoFila);

    const arquivo = DriveApp.getFileById(arquivoId);
    const mimeType = String(arquivo.getBlob().getContentType() || '').toLowerCase();
    const nomeArquivo = topcNormalizarMediaKeyPorMime_(nomeArquivoFila, mimeType);
    const tipoImagem = String(row[colunas['Tipo imagem']] || '').trim().toLowerCase();
    const ehImagemPrincipal = /^imagem-principal-/i.test(nomeArquivoFila);
    const role = tipoImagem === 'capa' || ehImagemPrincipal ? 'cover' : 'inline';
    const position = role === 'cover' ? 0 : posicaoInterna++;

    encontradas.push({ mediaKey: nomeArquivo, fileId: arquivoId, role: role, position: position, alt: topcAltImagem_(nomeArquivo) });
  }

  return encontradas;
}
