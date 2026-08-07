function topcGerarSlugAutomatico_(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120);
}

function topcGarantirSlugLinha_(aba, linha) {
  if (!aba || linha <= 1) return '';

  const ultimaColuna = aba.getLastColumn();
  if (!ultimaColuna) return '';

  const cabecalhos = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getDisplayValues()[0];

  const colunas = {};
  cabecalhos.forEach(function(nome, indice) {
    colunas[String(nome).trim()] = indice + 1;
  });

  if (!colunas['Título'] || !colunas['Slug']) return '';

  const slugAtual = String(
    aba.getRange(linha, colunas['Slug']).getDisplayValue() || ''
  ).trim();

  if (slugAtual) return slugAtual;

  const titulo = String(
    aba.getRange(linha, colunas['Título']).getDisplayValue() || ''
  ).trim();

  const slug = topcGerarSlugAutomatico_(titulo);
  if (!slug) return '';

  aba.getRange(linha, colunas['Slug']).setValue(slug);
  return slug;
}

function onEdit(e) {
  if (!e || !e.range) return;
  const aba = e.range.getSheet();
  if (aba.getName() !== 'Pauta editorial') return;
  topcGarantirSlugLinha_(aba, e.range.getRow());
}

function onSelectionChange(e) {
  if (!e || !e.range) return;
  const aba = e.range.getSheet();
  if (aba.getName() !== 'Pauta editorial') return;
  topcGarantirSlugLinha_(aba, e.range.getRow());
}
