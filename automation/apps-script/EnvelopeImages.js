// Ligação entre as imagens presentes no Google Docs final e as linhas
// concluídas da "Fila de imagens".
//
// Cada imagem do documento é inserida com o nome do arquivo no título
// alternativo. Quando esse título existe, a ligação é exata. Documentos
// antigos não têm título alternativo e caem na ordem de aparição.

function topcNormalizarChaveMidia_(valor) {
  return String(valor || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .trim()
    .toLowerCase();
}

function topcPlanejarImagensDocumento_(altTitulos, midias) {
  const lista = (midias || []).filter(Boolean);
  const alts = altTitulos || [];
  const atribuicoes = alts.map(function () { return null; });
  const usadas = [];

  const porChave = {};

  lista.forEach(function (midia) {
    const chave = topcNormalizarChaveMidia_(midia.mediaKey);
    if (chave && porChave[chave] === undefined) {
      porChave[chave] = midia;
    }
  });

  alts.forEach(function (alt, indice) {
    const midia = porChave[topcNormalizarChaveMidia_(alt)];

    if (midia && usadas.indexOf(midia) === -1) {
      atribuicoes[indice] = midia;
      usadas.push(midia);
    }
  });

  const pendentes = lista.filter(function (midia) {
    return usadas.indexOf(midia) === -1;
  });

  const capaPendente = pendentes.filter(function (midia) {
    return midia.role === 'cover';
  })[0] || null;

  const internasPendentes = pendentes.filter(function (midia) {
    return midia.role !== 'cover';
  });

  const vagas = atribuicoes.filter(function (midia) {
    return !midia;
  }).length;

  // Só existe capa dentro do corpo quando sobram mais imagens no
  // documento do que mídias internas por posicionar.
  const fila = capaPendente && vagas > internasPendentes.length
    ? [capaPendente].concat(internasPendentes)
    : internasPendentes;

  let proxima = 0;

  atribuicoes.forEach(function (midia, indice) {
    if (midia || proxima >= fila.length) {
      return;
    }

    atribuicoes[indice] = fila[proxima];
    usadas.push(fila[proxima]);
    proxima += 1;
  });

  const capa = lista.filter(function (midia) {
    return midia.role === 'cover';
  })[0] || null;

  return {
    atribuicoes: atribuicoes,
    capaRestante: capa && usadas.indexOf(capa) === -1 ? capa : null
  };
}
