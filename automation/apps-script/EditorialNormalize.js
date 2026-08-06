function topcNormalizarRevisaoEditorial_(resultado) {
  const marcador = '=== CONTEÚDO PARA PUBLICAÇÃO ===';
  const blocos = Array.isArray(resultado.blocks) ? resultado.blocks : [];
  const fontes = Array.isArray(resultado.sources) ? resultado.sources : [];

  const indiceMarcador = blocos.findIndex(function (bloco) {
    return bloco && bloco.type === 'paragraph' &&
      String(bloco.text || '').trim().toUpperCase() === marcador;
  });

  if (indiceMarcador === -1) {
    return {
      title: resultado.title,
      excerpt: resultado.excerpt,
      seoTitle: resultado.title,
      seoDescription: resultado.excerpt,
      blocks: blocos,
      sources: fontes
    };
  }

  const imagensPreservadas = blocos.slice(0, indiceMarcador).filter(function (bloco) {
    return bloco && bloco.type === 'image';
  });

  const rotulos = {
    'TÍTULO SEO:': 'seoTitle',
    'META DESCRIPTION:': 'seoDescription',
    'SLUG:': 'slug',
    'PALAVRA-CHAVE PRINCIPAL:': 'primaryKeyword',
    'PALAVRAS-CHAVE SECUNDÁRIAS:': 'secondaryKeywords'
  };

  const metadados = {};
  const conteudo = [];
  let lendoMetadados = true;
  let indice = indiceMarcador + 1;

  while (indice < blocos.length) {
    const bloco = blocos[indice];

    if (lendoMetadados && bloco && bloco.type === 'image') {
      conteudo.push(bloco);
      indice += 1;
      continue;
    }

    if (lendoMetadados && bloco && bloco.type === 'paragraph') {
      const texto = String(bloco.text || '').trim();
      const chave = rotulos[texto.toUpperCase()];

      if (chave) {
        const valor = blocos[indice + 1];
        if (valor && valor.type === 'paragraph') {
          metadados[chave] = String(valor.text || '').trim();
          indice += 2;
        } else {
          indice += 1;
        }
        continue;
      }
    }

    lendoMetadados = false;
    conteudo.push.apply(conteudo, blocos.slice(indice));
    break;
  }

  const blocosPublicos = imagensPreservadas.concat(conteudo);
  const primeiroParagrafo = blocosPublicos.find(function (bloco) {
    return bloco && bloco.type === 'paragraph' && String(bloco.text || '').trim();
  });
  const excerpt = primeiroParagrafo
    ? String(primeiroParagrafo.text).trim()
    : String(resultado.excerpt || '').trim();

  return {
    title: resultado.title,
    excerpt: excerpt,
    seoTitle: metadados.seoTitle || resultado.title,
    seoDescription: metadados.seoDescription || excerpt,
    blocks: blocosPublicos,
    sources: fontes
  };
}
