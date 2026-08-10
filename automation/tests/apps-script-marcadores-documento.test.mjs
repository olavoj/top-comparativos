import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = [
  new URL('../apps-script/LimitesDoArtigo.js', import.meta.url),
  new URL('../apps-script/Código.js', import.meta.url)
];

const ElementType = { PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE' };
const ParagraphHeading = { NORMAL: 'NORMAL', HEADING1: 'HEADING1' };

// Documento "Final — ..." antes das imagens: cabeçalho da revisão,
// artigo a partir do H1 e fontes no fim.
const documentoBase = [
  'Revisão editorial',
  'CLASSIFICAÇÃO: EVERGREEN',
  'PENDÊNCIAS:',
  '=== CONTEÚDO PARA PUBLICAÇÃO ===',
  '@H1 Como limpar uma sanduicheira',
  'Introdução do artigo.',
  'Mais um parágrafo.',
  'FONTES PARA REVISÃO:',
  'https://exemplo.com.br'
];

function executar(marcadores, linhas = documentoBase) {
  const paragrafos = linhas.slice();
  let salvo = false;

  const corpo = {
    getNumChildren: () => paragrafos.length,
    getChild(indice) {
      const texto = paragrafos[indice];
      const ehH1 = texto.startsWith('@H1 ');
      const elemento = {
        getType: () => ElementType.PARAGRAPH,
        getText: () => (ehH1 ? texto.substring(4) : texto),
        getHeading: () =>
          ehH1 ? ParagraphHeading.HEADING1 : ParagraphHeading.NORMAL
      };
      elemento.asParagraph = () => elemento;
      return elemento;
    },
    getText: () => paragrafos.join('\n'),
    insertParagraph(indice, texto) {
      paragrafos.splice(indice, 0, texto);
    },
    appendParagraph(texto) {
      paragrafos.push(texto);
    }
  };

  const context = vm.createContext({
    DocumentApp: {
      ElementType,
      ParagraphHeading,
      openById: () => ({
        getBody: () => corpo,
        saveAndClose: () => {
          salvo = true;
        }
      })
    }
  });

  for (const script of scripts) {
    vm.runInContext(fs.readFileSync(script, 'utf8'), context, {
      filename: String(script)
    });
  }

  context.garantirMarcadoresNoDocumento_('doc-1', marcadores);

  return { paragrafos, salvo };
}

test('a capa entra logo depois do H1, não no cabeçalho da revisão', () => {
  const { paragrafos, salvo } = executar([
    { marcador: '[IMAGEM: capa-artigo.webp]', tipo: 'Capa' }
  ]);

  assert.equal(paragrafos.indexOf('[IMAGEM: capa-artigo.webp]'), 5);
  assert.equal(paragrafos[4], '@H1 Como limpar uma sanduicheira');
  assert.equal(salvo, true);
});

test('imagens internas entram antes das fontes', () => {
  const { paragrafos } = executar([
    { marcador: '[IMAGEM: editorial-1-artigo.webp]', tipo: 'Interna' },
    { marcador: '[IMAGEM: editorial-2-artigo.webp]', tipo: 'Interna' }
  ]);

  const fontes = paragrafos.indexOf('FONTES PARA REVISÃO:');

  assert.equal(paragrafos.indexOf('[IMAGEM: editorial-1-artigo.webp]'), 7);
  assert.equal(paragrafos.indexOf('[IMAGEM: editorial-2-artigo.webp]'), 8);
  assert.equal(fontes, 9);
});

test('marcador já presente no documento não é duplicado', () => {
  const { paragrafos } = executar(
    [{ marcador: '[IMAGEM: capa-artigo.webp]', tipo: 'Capa' }],
    documentoBase.concat('[IMAGEM: capa-artigo.webp]')
  );

  const ocorrencias = paragrafos.filter(
    texto => texto === '[IMAGEM: capa-artigo.webp]'
  );

  assert.equal(ocorrencias.length, 1);
});

test('documento sem fontes recebe a imagem interna no fim', () => {
  const semFontes = documentoBase.slice(0, 7);
  const { paragrafos } = executar(
    [{ marcador: '[IMAGEM: editorial-1-artigo.webp]', tipo: 'Interna' }],
    semFontes
  );

  assert.equal(paragrafos.at(-1), '[IMAGEM: editorial-1-artigo.webp]');
});
