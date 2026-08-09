import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadScripts(paths, extras = {}) {
  const context = vm.createContext({ ...extras });
  for (const path of paths) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
      filename: String(path)
    });
  }
  return context;
}

const corePath = new URL('../apps-script/MediaUploadCore.js', import.meta.url);
const uploadPath = new URL('../apps-script/MediaUpload.js', import.meta.url);

test('monta canonical HMAC com quatro linhas', () => {
  const api = loadScripts([corePath]);
  assert.equal(api.topcMontarCanonical_('1700000000', 'req-1', 'pauta-1', 'abc123'), '1700000000\nreq-1\npauta-1\nabc123');
});

test('aceita WebP referenciado e monta cabeçalhos inline', () => {
  const api = loadScripts([corePath]);
  const media = { mediaKey: 'foto.webp', role: 'inline', position: 2, fileId: 'drive-1' };
  assert.doesNotThrow(() => api.topcValidarUploadMidia_(media, 'image/webp', 1024, ['foto.webp']));
  assert.deepEqual(structuredClone(api.topcMontarCabecalhosMidia_(media, 'a'.repeat(64))), {
    'x-media-key': 'foto.webp', 'x-media-sha256': 'a'.repeat(64), 'x-media-role': 'inline', 'x-media-position': '2'
  });
});

test('normaliza extensão do mediaKey conforme MIME real do arquivo', () => {
  const api = loadScripts([corePath]);
  assert.equal(api.topcNormalizarMediaKeyPorMime_('editorial-4.webp', 'image/jpeg'), 'editorial-4.jpg');
  assert.equal(api.topcNormalizarMediaKeyPorMime_('foto.jpg', 'image/webp'), 'foto.webp');
  assert.equal(api.topcNormalizarMediaKeyPorMime_('capa.jpeg', 'image/png'), 'capa.png');
});

for (const [name, media, mime, size, refs] of [
  ['rejeita MIME inválido', { mediaKey: 'foto.gif', role: 'inline', position: 0, fileId: '1' }, 'image/gif', 1, ['foto.gif']],
  ['rejeita arquivo vazio', { mediaKey: 'foto.webp', role: 'inline', position: 0, fileId: '1' }, 'image/webp', 0, ['foto.webp']],
  ['rejeita arquivo acima de 10 MiB', { mediaKey: 'foto.webp', role: 'inline', position: 0, fileId: '1' }, 'image/webp', 10 * 1024 * 1024 + 1, ['foto.webp']],
  ['rejeita mídia não referenciada', { mediaKey: 'foto.webp', role: 'inline', position: 0, fileId: '1' }, 'image/webp', 1, []]
]) {
  test(name, () => {
    const api = loadScripts([corePath]);
    assert.throws(() => api.topcValidarUploadMidia_(media, mime, size, refs));
  });
}

test('rejeita SHA-256 inválido', () => {
  const api = loadScripts([corePath]);
  assert.throws(() => api.topcMontarCabecalhosMidia_({ mediaKey: 'foto.webp', role: 'cover', position: 0 }, 'abc'));
});

test('assina e envia exatamente os mesmos bytes', () => {
  const bytes = [0, 1, 127, -128, -1]; let digested; let request;
  const api = loadScripts([corePath, uploadPath], {
    TOPC_SITE_AUTOMATION: { BASE_URL: 'https://example.test' }, Date: { now: () => 1700000000000 },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'secret-value' }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, computeDigest: (_algorithm, value) => { digested = value; return Array(32).fill(1); }, getUuid: () => 'req-1' },
    topcBytesParaHex_: value => value.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''),
    topcHmacSha256Hex_: canonical => { assert.equal(canonical, '1700000000\nreq-1\npauta-1\n' + '01'.repeat(32)); return 'f'.repeat(64); },
    UrlFetchApp: { fetch: (url, options) => { request = { url, options }; return { getResponseCode: () => 201, getContentText: () => '{}' }; } }
  });
  api.topcEnviarBytesAssinados_('/api/automation/articles/pauta-1/media', 'pauta-1', bytes, 'image/webp', { 'x-media-key': 'foto.webp' });
  assert.strictEqual(digested, bytes); assert.strictEqual(request.options.payload, bytes); assert.equal(request.options.contentType, 'image/webp');
});

test('aceita somente HTTP 200 e 201 no upload', () => {
  const api = loadScripts([corePath, uploadPath]);
  assert.doesNotThrow(() => api.topcValidarRespostaUpload_(200, 'foto.webp', '{}'));
  assert.doesNotThrow(() => api.topcValidarRespostaUpload_(201, 'foto.webp', '{}'));
  assert.throws(() => api.topcValidarRespostaUpload_(400, 'foto.webp', 'x'.repeat(800)), error => error.message.includes('HTTP 400') && error.message.length < 600);
});

test('registra o comando separado de upload no menu', () => {
  const api = loadScripts([corePath, uploadPath]); const calls = [];
  const menu = { addSeparator() { calls.push(['separator']); return this; }, addItem(label, handler) { calls.push([label, handler]); return this; } };
  assert.strictEqual(api.topcAdicionarUploadMenu_(menu), menu);
  assert.deepEqual(calls, [['separator'], ['5. Enviar imagens ao site', 'enviarImagensSiteSelecionadas']]);
});
