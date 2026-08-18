// Etapa 2 do plano de estratégia SEO: análise estruturada + plano SEO,
// numa única chamada ao Claude usando tool use forçado (não texto livre).
//
// Este arquivo só cobre a chamada e a validação da resposta — ele não
// grava nada na planilha nem cria Doc. Isso fica para a próxima etapa
// (PlanoSeo.js), que consome o JSON validado aqui.
//
// Por que uma chamada só para análise + plano, e não duas: o Claude já
// precisa ler toda a pesquisa para classificar a intenção de busca; pedir
// o outline e as recomendações na mesma chamada evita reprocessar (e
// re-billar) a mesma pesquisa duas vezes.

const TOPC_TOOL_PLANO_SEO = {
  name: 'registrar_plano_seo',
  description:
    'Registra a análise de SEO e o plano editorial estruturado para uma ' +
    'pauta, a partir da pesquisa fornecida.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'keyword',
      'language',
      'country',
      'intent',
      'recommended_page',
      'keyword_map',
      'serp_analysis',
      'outline',
      'differentiation',
      'sources',
      'risks',
      'human_review'
    ],
    properties: {
      keyword: { type: 'string' },
      language: { type: 'string' },
      country: { type: 'string' },
      intent: {
        type: 'object',
        additionalProperties: false,
        required: ['primary', 'confidence', 'evidence'],
        properties: {
          primary: { type: 'string' },
          secondary: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['baixa', 'média', 'alta'] },
          evidence: { type: 'array', items: { type: 'string' } }
        }
      },
      recommended_page: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'slug', 'funnel_stage', 'objective'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          funnel_stage: { type: 'string' },
          objective: { type: 'string' }
        }
      },
      keyword_map: {
        type: 'object',
        additionalProperties: false,
        required: ['primary', 'secondary', 'questions', 'entities'],
        properties: {
          primary: { type: 'array', items: { type: 'string' } },
          secondary: { type: 'array', items: { type: 'string' } },
          questions: { type: 'array', items: { type: 'string' } },
          entities: { type: 'array', items: { type: 'string' } }
        }
      },
      serp_analysis: {
        type: 'object',
        additionalProperties: false,
        required: ['formats', 'patterns', 'content_gaps', 'competitor_urls'],
        properties: {
          formats: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          content_gaps: { type: 'array', items: { type: 'string' } },
          competitor_urls: { type: 'array', items: { type: 'string' } }
        }
      },
      outline: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['level', 'heading', 'purpose'],
          properties: {
            level: { type: 'string', enum: ['H2', 'H3'] },
            heading: { type: 'string' },
            purpose: { type: 'string' },
            questions_answered: { type: 'array', items: { type: 'string' } },
            evidence_required: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      differentiation: { type: 'array', items: { type: 'string' } },
      internal_links: { type: 'array', items: { type: 'string' } },
      conversion_elements: { type: 'array', items: { type: 'string' } },
      structured_data: { type: 'array', items: { type: 'string' } },
      sources: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      human_review: { type: 'array', items: { type: 'string' } }
    }
  }
};

function montarPromptAnaliseSeo_(pauta, pesquisaTexto) {
  return `
Você é um estrategista de SEO editorial brasileiro. Analise a pesquisa
abaixo, coletada para a pauta "${pauta.titulo}", e registre a análise e o
plano SEO usando a ferramenta "registrar_plano_seo".

DADOS DA PAUTA
Palavra-chave principal: ${pauta.palavraChave}
Tipo de artigo: ${pauta.tipo || 'Não informado'}
Intenção informada manualmente: ${pauta.intencao || 'Não informada'}
Categoria: ${pauta.categoria || 'Não informada'}

PESQUISA COLETADA
${pesquisaTexto}

REGRAS OBRIGATÓRIAS

- Não invente volume de busca, dificuldade de palavra-chave, CTR, posição
  ou qualquer métrica que não esteja na pesquisa fornecida.
- Não copie textos, títulos ou estruturas de páginas concorrentes — só
  descreva padrões observados.
- Separe fatos observados na pesquisa, hipóteses e recomendações; não
  apresente hipótese como fato.
- Repetição de palavra-chave não é, por si só, estratégia de diferenciação
  — não a liste como tal em "differentiation".
- Não recomende páginas independentes para variações de palavra-chave que
  tenham a mesma intenção de busca da principal.
- Se o tema envolver saúde, finanças, segurança ou outro assunto sensível,
  inclua isso explicitamente em "human_review".
- Se a pesquisa fornecida não tiver base suficiente para alguma seção,
  registre um array vazio nessa seção em vez de inventar conteúdo — não
  deixe de chamar a ferramenta.
`;
}

function analisarSeoNoClaude_(pauta, pesquisaTexto) {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error(
      'A propriedade ANTHROPIC_API_KEY não foi encontrada.'
    );
  }

  const payload = {
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    tools: [TOPC_TOOL_PLANO_SEO],
    tool_choice: { type: 'tool', name: TOPC_TOOL_PLANO_SEO.name },
    messages: [
      {
        role: 'user',
        content: montarPromptAnaliseSeo_(pauta, pesquisaTexto)
      }
    ]
  };

  const resposta = UrlFetchApp.fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const codigo = resposta.getResponseCode();
  const textoResposta = resposta.getContentText();
  let dados;

  try {
    dados = JSON.parse(textoResposta);
  } catch (erro) {
    throw new Error(
      'VALIDATION_ERROR: o Claude retornou uma resposta inválida. HTTP: ' +
      codigo
    );
  }

  if (codigo < 200 || codigo >= 300) {
    const mensagem = dados.error?.message || textoResposta;

    throw new Error(
      'Erro da API do Claude (' + codigo + '): ' + mensagem
    );
  }

  const blocos = dados.content || [];

  const blocoFerramenta = blocos.filter(function (bloco) {
    return bloco.type === 'tool_use' &&
      bloco.name === TOPC_TOOL_PLANO_SEO.name;
  })[0];

  if (!blocoFerramenta || !blocoFerramenta.input) {
    throw new Error(
      'VALIDATION_ERROR: o Claude não retornou o plano SEO no formato de ' +
      'ferramenta esperado.'
    );
  }

  const plano = blocoFerramenta.input;

  validarPlanoSeo_(plano);

  return plano;
}

// Validação estrutural: não usa uma lib de schema (o projeto não tem
// nenhuma), mas cobre exatamente o que o schema acima exige — presença,
// tipo e enums dos campos obrigatórios. Acumula todos os problemas antes
// de lançar, para não obrigar a rodar a etapa várias vezes só para
// descobrir o próximo campo faltando.
function validarPlanoSeo_(plano) {
  const problemas = [];

  function exigirString(valor, caminho) {
    if (typeof valor !== 'string' || !valor.trim()) {
      problemas.push(caminho + ' precisa ser uma string não vazia.');
    }
  }

  function exigirArrayDeStrings(valor, caminho) {
    if (!Array.isArray(valor)) {
      problemas.push(caminho + ' precisa ser um array (pode ser vazio).');
      return;
    }

    valor.forEach(function (item, indice) {
      if (typeof item !== 'string') {
        problemas.push(caminho + '[' + indice + '] precisa ser string.');
      }
    });
  }

  function exigirEnum(valor, caminho, opcoes) {
    if (opcoes.indexOf(valor) === -1) {
      problemas.push(
        caminho + ' precisa ser um de: ' + opcoes.join(', ') +
        ' (recebido: ' + JSON.stringify(valor) + ')'
      );
    }
  }

  if (!plano || typeof plano !== 'object') {
    throw new Error('VALIDATION_ERROR: o plano SEO retornado não é um objeto.');
  }

  exigirString(plano.keyword, 'keyword');
  exigirString(plano.language, 'language');
  exigirString(plano.country, 'country');

  if (!plano.intent || typeof plano.intent !== 'object') {
    problemas.push('intent precisa ser um objeto.');
  } else {
    exigirString(plano.intent.primary, 'intent.primary');
    exigirEnum(plano.intent.confidence, 'intent.confidence', ['baixa', 'média', 'alta']);
    exigirArrayDeStrings(plano.intent.evidence, 'intent.evidence');
    if (plano.intent.secondary !== undefined) {
      exigirArrayDeStrings(plano.intent.secondary, 'intent.secondary');
    }
  }

  if (!plano.recommended_page || typeof plano.recommended_page !== 'object') {
    problemas.push('recommended_page precisa ser um objeto.');
  } else {
    ['type', 'title', 'slug', 'funnel_stage', 'objective'].forEach(function (campo) {
      exigirString(plano.recommended_page[campo], 'recommended_page.' + campo);
    });
  }

  if (!plano.keyword_map || typeof plano.keyword_map !== 'object') {
    problemas.push('keyword_map precisa ser um objeto.');
  } else {
    ['primary', 'secondary', 'questions', 'entities'].forEach(function (campo) {
      exigirArrayDeStrings(plano.keyword_map[campo], 'keyword_map.' + campo);
    });
  }

  if (!plano.serp_analysis || typeof plano.serp_analysis !== 'object') {
    problemas.push('serp_analysis precisa ser um objeto.');
  } else {
    ['formats', 'patterns', 'content_gaps', 'competitor_urls'].forEach(function (campo) {
      exigirArrayDeStrings(plano.serp_analysis[campo], 'serp_analysis.' + campo);
    });
  }

  if (!Array.isArray(plano.outline)) {
    problemas.push('outline precisa ser um array.');
  } else if (!plano.outline.length) {
    problemas.push('outline não pode ser vazio.');
  } else {
    plano.outline.forEach(function (secao, indice) {
      const caminho = 'outline[' + indice + ']';

      if (!secao || typeof secao !== 'object') {
        problemas.push(caminho + ' precisa ser um objeto.');
        return;
      }

      exigirEnum(secao.level, caminho + '.level', ['H2', 'H3']);
      exigirString(secao.heading, caminho + '.heading');
      exigirString(secao.purpose, caminho + '.purpose');

      if (secao.questions_answered !== undefined) {
        exigirArrayDeStrings(secao.questions_answered, caminho + '.questions_answered');
      }
      if (secao.evidence_required !== undefined) {
        exigirArrayDeStrings(secao.evidence_required, caminho + '.evidence_required');
      }
    });
  }

  exigirArrayDeStrings(plano.differentiation, 'differentiation');
  exigirArrayDeStrings(plano.sources, 'sources');
  exigirArrayDeStrings(plano.risks, 'risks');
  exigirArrayDeStrings(plano.human_review, 'human_review');

  if (problemas.length) {
    throw new Error(
      'VALIDATION_ERROR: o plano SEO retornado é inválido — ' +
      problemas.join(' | ')
    );
  }
}
