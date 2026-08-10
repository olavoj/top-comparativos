// O documento final começa com o cabeçalho da revisão (classificação,
// correções, pendências) e termina com fontes e aviso editorial. Só o
// trecho entre esses dois limites é o artigo.
//
// A lista de PENDÊNCIAS costuma repetir os marcadores [IMAGEM: ...], e é
// por isso que localizar um marcador pela primeira ocorrência coloca a
// imagem no lugar errado.

const TOPC_MARCADOR_PUBLICACAO = '=== CONTEÚDO PARA PUBLICAÇÃO ===';

function topcIndiceDoH1_(paragrafos) {
  const lista = paragrafos || [];

  for (let i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].ehH1) {
      return i;
    }
  }

  return -1;
}

function topcIndiceInicioDoArtigo_(paragrafos) {
  const lista = paragrafos || [];

  for (let i = 0; i < lista.length; i++) {
    const texto = String((lista[i] && lista[i].texto) || '')
      .trim()
      .toUpperCase();

    if (texto === TOPC_MARCADOR_PUBLICACAO) {
      return i + 1;
    }
  }

  const h1 = topcIndiceDoH1_(lista);

  return h1 >= 0 ? h1 : 0;
}

function topcIndiceFimDoArtigo_(paragrafos) {
  const lista = paragrafos || [];

  for (let i = 0; i < lista.length; i++) {
    const texto = String((lista[i] && lista[i].texto) || '')
      .trim()
      .toUpperCase();

    if (
      texto.indexOf('FONTES PARA REVIS') === 0 ||
      texto.indexOf('AVISO EDITORIAL') === 0
    ) {
      return i;
    }
  }

  return -1;
}
