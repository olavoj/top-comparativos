import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  analiseSeo: new URL('../apps-script/AnaliseSeo.js', import.meta.url)
};

function load(paths, extras = {}) {
  const context = vm.createContext({ ...extras });

  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }

  return context;
}

const pautaBase = {
  titulo: 'Melhor sanduicheira 2026',
  tipo: 'Comparativo',
  palavraChave: 'sanduicheira',
  intencao: 'Comercial',
  categoria: 'Casa e cozinha'
};

function planoValido(overrides = {}) {
  return {
    keyword: 'sanduicheira',
    language: 'pt-BR',
    country: 'BR',
    intent: {
      primary: 'comercial',
      secondary: ['informacional'],
      confidence: 'alta',
      evidence: ['múltiplos resultados de comparação de preço']
    },
    recommended_page: {
      type: 'comparativo',
      title: 'Melhores sanduicheiras de 2026',
      slug: 'melhores-sanduicheiras',
      funnel_stage: 'decisão',
      objective: 'ajudar a escolher'
    },
    keyword_map: {
      primary: ['sanduicheira'],
      secondary: ['sanduicheira grill'],
      questions: ['qual a melhor sanduicheira'],
      entities: ['antiaderente']
    },
    serp_analysis: {
      formats: ['lista comparativa'],
      patterns: ['tabela de preços'],
      content_gaps: ['durabilidade'],
      competitor_urls: []
    },
    outline: [
      { level: 'H2', heading: 'Como escolher', purpose: 'orientar a decisão' }
    ],
    differentiation: ['comparação por perfil de uso'],
    internal_links: [],
    conversion_elements: [],
    structured_data: [],
    sources: ['https://exemplo.com'],
    risks: [],
    human_review: [],
    ...overrides
  };
}

function respostaComTool(input) {
  return {
    content: [
      { type: 'tool_use', name: 'registrar_plano_seo', input }
    ]
  };
}

function fakeClaude(corpo, codigo = 200) {
  return {
    fetch: () => ({
      getResponseCode: () => codigo,
      getContentText: () => JSON.stringify(corpo)
    })
  };
}

test('validarPlanoSeo_ aceita um plano completo e não lança', () => {
  const api = load([scripts.analiseSeo]);

  assert.doesNotThrow(() => api.validarPlanoSeo_(planoValido()));
});

test('validarPlanoSeo_ rejeita confidence fora do enum', () => {
  const api = load([scripts.analiseSeo]);
  const plano = planoValido();
  plano.intent.confidence = 0.87;

  assert.throws(
    () => api.validarPlanoSeo_(plano),
    /VALIDATION_ERROR.*intent\.confidence/
  );
});

test('validarPlanoSeo_ rejeita outline vazio', () => {
  const api = load([scripts.analiseSeo]);
  const plano = planoValido({ outline: [] });

  assert.throws(
    () => api.validarPlanoSeo_(plano),
    /outline não pode ser vazio/
  );
});

test('validarPlanoSeo_ acumula mais de um problema na mesma mensagem', () => {
  const api = load([scripts.analiseSeo]);
  const plano = planoValido();
  delete plano.keyword;
  plano.outline = [{ level: 'H4', heading: '', purpose: 'x' }];

  let mensagem = '';
  try {
    api.validarPlanoSeo_(plano);
  } catch (erro) {
    mensagem = erro.message;
  }

  assert.match(mensagem, /keyword precisa ser uma string/);
  assert.match(mensagem, /outline\[0\]\.level/);
  assert.match(mensagem, /outline\[0\]\.heading/);
});

test('validarPlanoSeo_ rejeita campo obrigatório ausente em objeto aninhado', () => {
  const api = load([scripts.analiseSeo]);
  const plano = planoValido();
  delete plano.recommended_page.slug;

  assert.throws(
    () => api.validarPlanoSeo_(plano),
    /recommended_page\.slug/
  );
});

test('o schema da tool exige os campos de nível superior do briefing', () => {
  const api = load([scripts.analiseSeo]);

  // `const` no topo do arquivo não vira propriedade do contexto.
  const tool = vm.runInContext('TOPC_TOOL_PLANO_SEO', api);

  assert.deepEqual(
    Array.from(tool.input_schema.required).sort(),
    [
      'country', 'differentiation', 'human_review', 'intent', 'keyword',
      'keyword_map', 'language', 'outline', 'recommended_page', 'risks',
      'serp_analysis', 'sources'
    ].sort()
  );
  assert.equal(tool.name, 'registrar_plano_seo');
});

test('analisarSeoNoClaude_ força tool_choice e retorna o input já validado', () => {
  const plano = planoValido();

  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeClaude(respostaComTool(plano))
  });

  const resultado = api.analisarSeoNoClaude_(pautaBase, 'texto da pesquisa');

  assert.equal(resultado.keyword, 'sanduicheira');
});

test('payload enviado ao Claude usa tool_choice forçado para a tool certa', () => {
  let payloadCapturado = null;

  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        payloadCapturado = JSON.parse(options.payload);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify(respostaComTool(planoValido()))
        };
      }
    }
  });

  api.analisarSeoNoClaude_(pautaBase, 'texto da pesquisa');

  assert.deepEqual(payloadCapturado.tool_choice, {
    type: 'tool',
    name: 'registrar_plano_seo'
  });
  assert.equal(payloadCapturado.tools[0].name, 'registrar_plano_seo');
  assert.match(payloadCapturado.messages[0].content, /texto da pesquisa/);
});

test('resposta sem bloco tool_use lança VALIDATION_ERROR sem avançar', () => {
  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeClaude({
      content: [{ type: 'text', text: 'desculpe, não vou usar a ferramenta' }]
    })
  });

  assert.throws(
    () => api.analisarSeoNoClaude_(pautaBase, 'texto'),
    /VALIDATION_ERROR.*formato de ferramenta/
  );
});

test('resposta com plano incompleto lança VALIDATION_ERROR e não retorna dado parcial', () => {
  const planoIncompleto = planoValido();
  delete planoIncompleto.sources;

  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeClaude(respostaComTool(planoIncompleto))
  });

  assert.throws(
    () => api.analisarSeoNoClaude_(pautaBase, 'texto'),
    /VALIDATION_ERROR.*sources/
  );
});

test('HTTP de erro da API do Claude propaga a mensagem do provedor', () => {
  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeClaude({ error: { message: 'overloaded' } }, 529)
  });

  assert.throws(
    () => api.analisarSeoNoClaude_(pautaBase, 'texto'),
    /Erro da API do Claude \(529\).*overloaded/
  );
});

test('sem ANTHROPIC_API_KEY, falha antes de chamar a rede', () => {
  const api = load([scripts.analiseSeo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => null })
    },
    UrlFetchApp: {
      fetch: () => {
        throw new Error('não deveria chamar a rede sem chave');
      }
    }
  });

  assert.throws(
    () => api.analisarSeoNoClaude_(pautaBase, 'texto'),
    /ANTHROPIC_API_KEY/
  );
});
