import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path = new URL('../apps-script/MediaQueue.js', import.meta.url);

const headers = [
  'Slug',
  'Linha pauta',
  'Nome arquivo',
  'Tipo imagem',
  'Status',
  'Arquivo ID',
  'Erro'
];

function diagnosticar(rows, linhaPauta = 3, slug = 'artigo') {
  const aba = rows
    ? {
        getLastRow: () => rows.length,
        getDataRange: () => ({ getDisplayValues: () => rows })
      }
    : null;

  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => aba })
    }
  });

  vm.runInContext(fs.readFileSync(path, 'utf8'), context, {
    filename: String(path)
  });

  return context.topcDiagnosticarFilaDaPauta_(linhaPauta, slug);
}

function fila(...linhas) {
  return [headers, ...linhas];
}

test('aponta o comando que falta quando a fila nem existe', () => {
  assert.match(diagnosticar(null), /Gerar imagens com Nano Banana/);
});

test('aponta o slug quando a fila não tem linha para a pauta', () => {
  const rows = fila(['outro-artigo', '3', 'capa.webp', 'Capa', 'Concluída', 'id', '']);

  assert.match(diagnosticar(rows), /nenhuma linha para o slug "artigo"/);
});

test('avisa quando a pauta mudou de linha depois de enfileirada', () => {
  const rows = fila(['artigo', '7', 'capa.webp', 'Capa', 'Concluída', 'id', '']);
  const mensagem = diagnosticar(rows);

  assert.match(mensagem, /registradas na linha 7 da pauta/);
  assert.match(mensagem, /"Linha pauta"/);
});

test('mostra a contagem por status e o primeiro erro registrado', () => {
  const rows = fila(
    ['artigo', '3', 'capa.webp', 'Capa', 'Falha', '', 'Erro do Gemini (400): aspect_ratio'],
    ['artigo', '3', 'e-1.webp', 'Interna', 'Falha', '', 'Erro do Gemini (400): aspect_ratio'],
    ['artigo', '3', 'e-2.webp', 'Interna', 'Pendente', '', '']
  );

  const mensagem = diagnosticar(rows);

  assert.match(mensagem, /Falha: 2/);
  assert.match(mensagem, /Pendente: 1/);
  assert.match(mensagem, /aspect_ratio/);
});

test('sugere aguardar o gatilho quando só há pendentes sem erro', () => {
  const rows = fila(['artigo', '3', 'capa.webp', 'Capa', 'Pendente', '', '']);

  assert.match(diagnosticar(rows), /aguarde o gatilho/);
});

test('detecta linhas concluídas sem Arquivo ID', () => {
  const rows = fila(['artigo', '3', 'capa.webp', 'Capa', 'Concluída', '', '']);

  assert.match(diagnosticar(rows), /sem "Arquivo ID"/);
});
