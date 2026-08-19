import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const codigoPath = new URL('../apps-script/Código.js', import.meta.url);
const estruturasPath = new URL(
  '../apps-script/EstruturasEditoriais.js',
  import.meta.url
);

function load(paths, extras = {}) {
  const context = vm.createContext({ ...extras });

  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }

  return context;
}

// topcSlugificar_ vive em Código.js. EstruturasEditoriais.js é carregado
// sozinho aqui (sem Código.js), então extraímos a função real de lá e a
// injetamos no contexto, do mesmo jeito que o escopo global do Apps
// Script faria em produção.
function obterTopcSlugificar_() {
  return load([codigoPath]).topcSlugificar_;
}

function carregarApi() {
  return load([estruturasPath], { topcSlugificar_: obterTopcSlugificar_() });
}

test('topcObterEstrutura_ retorna a estrutura para um tipo válido', () => {
  const api = carregarApi();

  const estrutura = api.topcObterEstrutura_('Pilar');

  assert.equal(estrutura.tamanho, 'Entre 2.500 e 3.500 palavras');
  assert.match(estrutura.papel, /POST PILAR/);
  assert.match(estrutura.esqueleto, /## Perguntas frequentes/);
});

test('topcObterEstrutura_ aceita uma variante do nome do tipo', () => {
  const api = carregarApi();

  const estrutura = api.topcObterEstrutura_('Comparativo direto entre produtos');

  assert.equal(estrutura.tamanho, 'Entre 1.400 e 2.200 palavras');
  assert.match(estrutura.papel, /SATÉLITE de comparação direta/);
});

test('topcObterEstrutura_ rejeita um tipo não reconhecido', () => {
  const api = carregarApi();

  assert.throws(
    () => api.topcObterEstrutura_('Tutorial'),
    /Tipo de pauta não reconhecido: "Tutorial"/
  );
});

test('montarPromptArtigo_ substitui o placeholder do pilarSlug no esqueleto', () => {
  const api = carregarApi();

  const pauta = {
    titulo: 'Melhor sanduicheira elétrica',
    tipo: 'Comparativo',
    palavraChave: 'sanduicheira elétrica',
    intencao: 'comercial',
    categoria: 'Eletroportáteis',
    slug: 'melhor-sanduicheira-eletrica',
    pilar: 'Guia de Sanduicheiras'
  };

  const prompt = api.montarPromptArtigo_(pauta, 'pesquisa editorial');

  assert.match(prompt, /\[LINK-INTERNO: guia-de-sanduicheiras\]/);
  assert.doesNotMatch(prompt, /\$\{pauta\.pilarSlug\}/);
});

test('montarPromptArtigo_ usa "slug-do-pilar" quando a pauta não tem pilar', () => {
  const api = carregarApi();

  const pauta = {
    titulo: 'Air fryer x forno elétrico',
    tipo: 'Comparativo',
    palavraChave: 'air fryer vs forno elétrico',
    intencao: 'comercial',
    categoria: 'Eletroportáteis',
    slug: 'air-fryer-x-forno-eletrico',
    pilar: ''
  };

  const prompt = api.montarPromptArtigo_(pauta, 'pesquisa editorial');

  assert.match(prompt, /\[LINK-INTERNO: slug-do-pilar\]/);
});
