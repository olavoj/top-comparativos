// Leitura da "Fila de imagens" para envelope, upload e publicação.
// Definição única: mantém as três etapas usando a mesma mediaKey real,
// derivada do MIME do arquivo no Drive.
function topcAltImagem_(nomeArquivo) {
  const texto = String(nomeArquivo)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!texto) return 'Imagem editorial';

  return (texto.charAt(0).toUpperCase() + texto.slice(1)).substring(0, 300);
}

// "Nenhuma imagem concluída" tem várias causas e a aba da fila fica
// oculta. Esta função explica qual delas ocorreu.
function topcDiagnosticarFilaDaPauta_(linhaPauta, slug) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName('Fila de imagens');

  if (!aba || aba.getLastRow() < 2) {
    return 'A fila de imagens está vazia. Execute antes o comando ' +
      '"4. Gerar imagens com Nano Banana" para esta pauta.';
  }

  const valores = aba.getDataRange().getDisplayValues();
  const colunas = {};

  valores[0].forEach(function(header, i) {
    colunas[String(header).trim()] = i;
  });

  const celula = function(row, nome) {
    const indice = colunas[nome];
    return indice === undefined ? '' : String(row[indice] || '').trim();
  };

  const doSlug = valores.slice(1).filter(function(row) {
    return celula(row, 'Slug') === slug;
  });

  if (!doSlug.length) {
    return 'A fila de imagens não tem nenhuma linha para o slug "' +
      slug + '". Confirme o Slug da pauta e execute o comando ' +
      '"4. Gerar imagens com Nano Banana".';
  }

  const daLinha = doSlug.filter(function(row) {
    return celula(row, 'Linha pauta') === String(linhaPauta);
  });

  if (!daLinha.length) {
    return 'A fila tem ' + doSlug.length + ' linha(s) para o slug "' +
      slug + '", mas registradas na linha ' +
      celula(doSlug[0], 'Linha pauta') + ' da pauta, e não na linha ' +
      linhaPauta + '. A pauta provavelmente mudou de lugar: ajuste a ' +
      'coluna "Linha pauta" na aba "Fila de imagens".';
  }

  const concluidasSemArquivo = daLinha.filter(function(row) {
    return celula(row, 'Status') === 'Concluída' &&
      !celula(row, 'Arquivo ID');
  }).length;

  if (concluidasSemArquivo === daLinha.length) {
    return 'As ' + daLinha.length + ' imagens estão como Concluída, mas ' +
      'sem "Arquivo ID" na fila. Use ' +
      '"Ferramentas > Reparar fila de imagens" para gerá-las de novo.';
  }

  const contagem = {};

  daLinha.forEach(function(row) {
    const status = celula(row, 'Status') || '(sem status)';
    contagem[status] = (contagem[status] || 0) + 1;
  });

  const resumo = Object.keys(contagem).map(function(status) {
    return status + ': ' + contagem[status];
  }).join(', ');

  const comErro = daLinha.filter(function(row) {
    return celula(row, 'Erro');
  })[0];

  return 'Nenhuma imagem concluída para esta pauta. Situação da fila — ' +
    resumo + '.' +
    (comErro
      ? ' Primeiro erro registrado: ' +
        celula(comErro, 'Erro').substring(0, 300)
      : ' Se ainda houver linhas pendentes, aguarde o gatilho de um ' +
        'minuto terminar de gerar as imagens.');
}

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
