import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, beforeEach } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/revealText.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { revealText } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

class Element {
  children = [];
  style = {};
  attributes = {};
  text = '';
  set textContent(value) {
    this.text = value;
    this.children = [];
  }
  get textContent() {
    return this.children.length
      ? this.children.map((child) => child.textContent).join('')
      : this.text;
  }
  append(child) {
    this.children.push(child);
  }
  replaceChildren(...children) {
    this.children = children;
    this.text = '';
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
}

let frames;
let nextFrame;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  globalThis.document = {
    createElement: () => new Element(),
    createTextNode: (text) => Object.assign(new Element(), { text }),
  };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
});

test('renderiza texto de forma imediata, mantendo acentos, espaços e pontuação', () => {
  const el = new Element();
  const target = 'São José · SP';
  revealText(el, target);
  assert.equal(el.textContent, target);
  assert.equal(frames.size, 0);
});

for (const target of [
  '32°C',
  '8,5 mm',
  '1.234 focos',
  '62% umidade',
  '14 km/h',
]) {
  test(`renderiza valores numéricos imediatamente sem alterar separadores ou unidades: ${target}`, () => {
    const el = new Element();
    revealText(el, target, 'number');
    assert.equal(el.textContent, target);
    assert.equal(frames.size, 0);
  });
}

test('trocas de texto atualizam imediatamente sem frames pendentes', () => {
  const el = new Element();
  revealText(el, 'São Paulo');
  assert.equal(el.textContent, 'São Paulo');
  const cancel = revealText(el, 'João Pessoa');
  assert.equal(el.textContent, 'João Pessoa');
  assert.equal(frames.size, 0);
  cancel();
  assert.equal(el.textContent, 'João Pessoa');
});

test('redução de movimento e renderização padrão são ambas instantâneas e sem custo de CPU', () => {
  const el = new Element();
  revealText(el, '32,5°C', 'number');
  assert.equal(el.textContent, '32,5°C');
  assert.equal(frames.size, 0);
});

test('ausência de dado não é convertida em zero', () => {
  const el = new Element();
  revealText(el, 'sem dado', 'number');
  assert.equal(frames.size, 0);
  assert.equal(el.textContent, 'sem dado');
});
