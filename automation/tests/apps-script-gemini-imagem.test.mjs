import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = {
  codigo: new URL('../apps-script/Código.js', import.meta.url)
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

function fakeUrlFetchApp(dados) {
  return {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify(dados)
    })
  };
}

const utilitiesFake = {
  base64Decode: (b64) => Buffer.from(b64, 'base64'),
  newBlob: (bytes, mimeType) => ({ bytes, mimeType, setName: () => {} })
};

test('gerarImagemGemini_ ignora partes inlineData que não são imagem (ex.: PDF) e usa a parte de imagem', () => {
  const api = load([scripts.codigo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeUrlFetchApp({
      candidates: [{
        content: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: 'cGRmLWZhbHNv' } },
            { inlineData: { mimeType: 'image/png', data: 'aW1hZ2VtLXJlYWw=' } }
          ]
        }
      }]
    }),
    Utilities: utilitiesFake
  });

  const resultado = api.gerarImagemGemini_('prompt qualquer', '16:9');

  assert.equal(resultado.mimeType, 'image/png');
});

test('gerarImagemGemini_ falha com erro claro quando só existe uma parte não-imagem (ex.: PDF)', () => {
  const api = load([scripts.codigo], {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'chave-fake' })
    },
    UrlFetchApp: fakeUrlFetchApp({
      candidates: [{
        content: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: 'cGRmLWZhbHNv' } }
          ]
        }
      }]
    }),
    Utilities: utilitiesFake
  });

  assert.throws(
    () => api.gerarImagemGemini_('prompt qualquer', '16:9'),
    /O Gemini não retornou uma imagem\./
  );
});
