// Inserção das imagens geradas no documento final.
// Definição única: aceita marcadores em parágrafos e em itens de lista.
function topcEscaparRegex_(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inserirImagemNoDocumento_(tarefa, arquivo) {
  const documento = DocumentApp.openById(tarefa.documentoFinalId);
  const corpo = documento.getBody();
  const blob = arquivo.getBlob();
  const marcador = tarefa.marcador;
  const resultado = corpo.findText(topcEscaparRegex_(marcador));

  if (!resultado) {
    documento.saveAndClose();
    throw new Error('Marcador não encontrado no documento: ' + marcador);
  }

  const elementoTexto = resultado.getElement();
  const pai = elementoTexto.getParent();
  const tipo = pai.getType();
  const tiposAceitos = [
    DocumentApp.ElementType.PARAGRAPH,
    DocumentApp.ElementType.LIST_ITEM
  ];

  if (tiposAceitos.indexOf(tipo) === -1) {
    documento.saveAndClose();
    throw new Error(
      'Marcador de imagem está em um elemento não suportado: ' + tipo
    );
  }

  const container = pai;
  const inicio = resultado.getStartOffset();
  const fim = resultado.getEndOffsetInclusive();

  // Remove apenas o marcador, preservando o restante do parágrafo/lista.
  const textElement = elementoTexto.asText();
  textElement.deleteText(inicio, fim);

  // Insere a imagem logo depois do elemento que continha o marcador.
  const indice = corpo.getChildIndex(container);
  const paragrafoImagem = corpo.insertParagraph(indice + 1, '');
  const imagem = paragrafoImagem.appendInlineImage(blob);

  // O título alternativo guarda a chave da mídia. É ele que permite ao
  // envelope ligar cada imagem do documento à linha correta da fila,
  // em vez de depender da ordem em que as imagens aparecem.
  imagem.setAltTitle(String(tarefa.nomeArquivo || ''));
  imagem.setAltDescription(topcAltImagem_(tarefa.nomeArquivo));

  // Mantém uma largura segura no Google Docs sem ampliar imagens pequenas.
  const larguraMaxima = 720;
  const largura = imagem.getWidth();
  const altura = imagem.getHeight();
  if (largura > larguraMaxima && largura > 0) {
    imagem.setWidth(larguraMaxima);
    imagem.setHeight(Math.round(altura * larguraMaxima / largura));
  }

  documento.saveAndClose();
  return arquivo.getId();
}

function reabrirFalhasListItemSelecionadas() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const fila = planilha.getSheetByName('Fila de imagens');
  if (!fila) throw new Error('A aba "Fila de imagens" não foi encontrada.');

  const range = fila.getActiveRange();
  if (!range || range.getRow() <= 1) {
    throw new Error('Selecione a linha com a falha na aba "Fila de imagens".');
  }

  const ultimaColuna = fila.getLastColumn();
  const cabecalhos = fila.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0];
  const mapa = {};
  cabecalhos.forEach(function(cabecalho, indice) {
    mapa[String(cabecalho).trim()] = indice + 1;
  });

  ['Status', 'Tentativas', 'Erro'].forEach(function(nome) {
    if (!mapa[nome]) throw new Error('Coluna não encontrada: ' + nome);
  });

  const inicio = range.getRow();
  const fim = inicio + range.getNumRows() - 1;
  let reabertas = 0;

  for (let linha = inicio; linha <= fim; linha += 1) {
    const status = String(fila.getRange(linha, mapa.Status).getDisplayValue()).trim();
    const erro = String(fila.getRange(linha, mapa.Erro).getDisplayValue()).trim();
    if (status !== 'Falha' || erro.indexOf('LIST_ITEM') === -1) continue;

    fila.getRange(linha, mapa.Status).setValue('Pendente');
    fila.getRange(linha, mapa.Tentativas).setValue(0);
    fila.getRange(linha, mapa.Erro).clearContent();
    reabertas += 1;
  }

  planilha.toast(
    reabertas + ' falha(s) de LIST_ITEM reaberta(s) para processamento.',
    'Top Comparativos',
    8
  );
}
