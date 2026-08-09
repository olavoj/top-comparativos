import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = new URL('../apps-script/ZZMediaKeyFix.js', import.meta.url);

function source() {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

test('override normaliza mediaKey pelo MIME real antes de montar envelope', () => {
  const codigo = source();
  assert.match(codigo, /function topcObterMidiasConcluidas_/);
  assert.match(codigo, /DriveApp\.getFileById/);
  assert.match(codigo, /topcNormalizarMediaKeyPorMime_/);
});
