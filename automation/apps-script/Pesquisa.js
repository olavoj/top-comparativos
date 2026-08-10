// Comando "1. Pesquisar pauta selecionada".
// Definição única: grava o resultado na coluna "Link da pesquisa",
// que é a coluna lida pelo comando de geração de artigo.
function pesquisarPautaSelecionada() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (linha === 1) {
    SpreadsheetApp.getUi().alert(
      'Selecione qualquer célula da linha da pauta que deseja pesquisar.'
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
    'Link da pesquisa',
    'Observações'
  ]);

  const pauta = {
    titulo: obterValor_(aba, linha, colunas, 'Título'),
    tipo: obterValor_(aba, linha, colunas, 'Tipo'),
    palavraChave: obterValor_(aba, linha, colunas, 'Palavra-chave principal'),
    intencao: obterValor_(aba, linha, colunas, 'Intenção'),
    categoria: obterValor_(aba, linha, colunas, 'Categoria'),
    pilar: obterValor_(aba, linha, colunas, 'Pilar relacionado')
  };

  if (!pauta.titulo || !pauta.palavraChave) {
    SpreadsheetApp.getUi().alert(
      'Preencha pelo menos Título e Palavra-chave principal.'
    );
    return;
  }

  const trava = LockService.getDocumentLock();
  let travaAdquirida = false;

  try {
    trava.waitLock(10000);
    travaAdquirida = true;

    atualizarValor_(aba, linha, colunas, 'Status', 'Pesquisando...');
    SpreadsheetApp.flush();

    const resultado = pesquisarNoPerplexity_(pauta);
    const documento = criarDocumentoPesquisa_(pauta, resultado);

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Link da pesquisa',
      documento.getUrl()
    );

    atualizarValor_(aba, linha, colunas, 'Status', 'Pesquisa pronta');

    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Pesquisa criada automaticamente em ' +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm'
        )
    );

    SpreadsheetApp.getUi().alert(
      'Pesquisa concluída!\n\nDocumento: ' + documento.getUrl()
    );
  } catch (erro) {
    atualizarValor_(aba, linha, colunas, 'Status', 'Erro');
    atualizarValor_(
      aba,
      linha,
      colunas,
      'Observações',
      'Erro na pesquisa: ' + erro.message
    );

    SpreadsheetApp.getUi().alert(
      'Não foi possível concluir a pesquisa:\n\n' + erro.message
    );
  } finally {
    if (travaAdquirida) {
      trava.releaseLock();
    }
  }
}
