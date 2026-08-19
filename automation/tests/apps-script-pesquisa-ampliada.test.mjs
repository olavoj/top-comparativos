import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url),
  pesquisaAmpliada: new URL('../apps-script/PesquisaAmpliada.js', import.meta.url)
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
  categoria: 'Casa e cozinha',
  pilar: ''
};

test('gera seis variações fixas, todas derivadas da palavra-chave', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada]);

  const variacoes = api.montarVariacoesPesquisa_(pautaBase);

  assert.equal(variacoes.length, 6);
  assert.deepEqual(
    Array.from(variacoes, v => v.tipo),
    ['principal', 'comercial', 'informacional', 'comparacao', 'perguntas', 'alternativas']
  );
  Array.from(variacoes).forEach(variacao => {
    assert.match(variacao.query, /sanduicheira/);
  });
  assert.equal(variacoes[0].query, 'sanduicheira');
});

test('o payload da variação usa menos tokens que a pesquisa completa e não pede perguntas relacionadas', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada]);
  const variacao = api.montarVariacoesPesquisa_(pautaBase)[1];

  const payload = api.montarPayloadVariacaoPesquisa_(pautaBase, variacao);

  assert.equal(payload.max_tokens, 1200);
  assert.equal(payload.return_related_questions, undefined);
  assert.match(payload.messages[1].content, /CONSULTA A PESQUISAR: melhor sanduicheira/);
});

test('extrai domínio de uma URL http/https', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada]);

  assert.equal(
    api.topcExtrairDominio_('https://www.exemplo.com.br/produto/1'),
    'www.exemplo.com.br'
  );
  assert.equal(api.topcExtrairDominio_(''), '');
});

function fakeUrlFetchApp(respostasPorQuery) {
  return {
    fetch(url, options) {
      const payload = JSON.parse(options.payload);
      const conteudoUsuario = payload.messages[1].content;
      const chave = Object.keys(respostasPorQuery).find(query =>
        conteudoUsuario.includes(query)
      );
      const corpo = respostasPorQuery[chave];

      return {
        getResponseCode: () => corpo.codigo || 200,
        getContentText: () => JSON.stringify(corpo.dados)
      };
    }
  };
}

test('preserva dados brutos por resultado (URL, título, domínio, data, ordem) sem misturar interpretação', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada], {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => 'chave-fake'
      })
    },
    Utilities: {
      formatDate: () => '2026-08-18'
    },
    Session: {
      getScriptTimeZone: () => 'America/Sao_Paulo'
    },
    UrlFetchApp: fakeUrlFetchApp({
      'CONSULTA A PESQUISAR: sanduicheira': {
        dados: {
          choices: [{ message: { content: 'resumo principal' } }],
          citations: ['https://a.com'],
          search_results: [
            {
              url: 'https://a.com/artigo',
              title: 'Guia de sanduicheiras',
              date: '2026-01-10',
              last_updated: '2026-06-01'
            }
          ]
        }
      }
    })
  });

  const variacao = api.montarVariacoesPesquisa_(pautaBase)[0];
  const resultado = api.pesquisarVariacaoNoPerplexity_(pautaBase, variacao);

  assert.equal(resultado.tipo, 'principal');
  assert.equal(resultado.resumo, 'resumo principal');
  assert.equal(resultado.resultados.length, 1);

  const item = resultado.resultados[0];
  assert.equal(item.url, 'https://a.com/artigo');
  assert.equal(item.titulo, 'Guia de sanduicheiras');
  assert.equal(item.dominio, 'a.com');
  assert.equal(item.dataPublicacao, '2026-01-10');
  assert.equal(item.dataAtualizacao, '2026-06-01');
  assert.equal(item.dataColeta, '2026-08-18');
  assert.equal(item.ordem, 1);
  assert.equal(item.query, variacao.query);
});

test('erro HTTP em uma variação identifica qual variação falhou', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 429,
        getContentText: () => JSON.stringify({ error: { message: 'rate limited' } })
      })
    }
  });

  const variacao = api.montarVariacoesPesquisa_(pautaBase)[1];

  assert.throws(
    () => api.pesquisarVariacaoNoPerplexity_(pautaBase, variacao),
    /Variação comercial.*rate limited/
  );
});

test('sem PERPLEXITY_API_KEY, falha antes de chamar a rede', () => {
  const api = load([scripts.codigo, scripts.pesquisaAmpliada], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => null })
    },
    UrlFetchApp: {
      fetch: () => {
        throw new Error('não deveria chamar a rede sem chave');
      }
    }
  });

  const variacao = api.montarVariacoesPesquisa_(pautaBase)[0];

  assert.throws(
    () => api.pesquisarVariacaoNoPerplexity_(pautaBase, variacao),
    /PERPLEXITY_API_KEY/
  );
});

test('pesquisarPautaAmpliadaLinha_ exige Título e Palavra-chave principal', () => {
  const aba = {
    getLastColumn: () => 8,
    getRange: () => ({
      getDisplayValues: () => [[
        'Título', 'Tipo', 'Palavra-chave principal', 'Intenção',
        'Categoria', 'Status', 'Link da pesquisa', 'Observações'
      ]],
      getDisplayValue: () => ''
    })
  };

  const api = load([scripts.codigo, scripts.pesquisaAmpliada]);

  assert.throws(
    () => api.pesquisarPautaAmpliadaLinha_(aba, 2),
    /Preencha pelo menos Título e Palavra-chave principal/
  );
});
