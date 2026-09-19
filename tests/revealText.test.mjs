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

// DOM mínimo e relógio controlado: verificamos os frames, sem temporizadores reais.
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
let now;
let nextFrame;
let reducedMotion;
beforeEach(() => {
  frames = new Map();
  now = 0;
  nextFrame = 0;
  reducedMotion = false;
  globalThis.document = {
    createElement: () => new Element(),
    createTextNode: (text) => Object.assign(new Element(), { text }),
  };
  globalThis.window = { matchMedia: () => ({ matches: reducedMotion }) };
  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
});
function advance(timestamp) {
  now = timestamp;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(timestamp));
}
function slots(el) {
  return el.children[1].children;
}
function visible(el) {
  return slots(el)
    .map((slot) => (slot.style.visibility === 'hidden' ? '' : slot.textContent))
    .join('');
}

test('revela letras em ordem, mantendo acentos, espaços e pontuação', () => {
  const el = new Element();
  const target = 'São José · SP';
  revealText(el, target);
  assert.equal(visible(el), '  · ');
  advance(120);
  assert.equal(visible(el), 'São J · ');
  assert.equal(el.children[0].textContent, target);
  assert.equal(el.children[1].attributes['aria-hidden'], 'true');
  advance(1000);
  assert.equal(el.textContent, target);
  assert.equal(frames.size, 0);
});

for (const target of [
  '1.234.567 hab.',
  'R$ 12,34 mi',
  '-12,50%',
  '0,00 km²',
  '32,45 /100 mil hab.',
]) {
  test(`contagem converge sem alterar separadores ou unidades: ${target}`, () => {
    const el = new Element();
    revealText(el, target, 'number');
    const token = /\d+(?:[.,]\d+)*/.exec(target);
    const end = token.index + token[0].length;
    let previous = -1;
    for (const time of [0, 100, 250, 500, 800]) {
      advance(time);
      const current = slots(el)
        .map((slot) => slot.textContent)
        .join('');
      assert.equal(current.slice(end), target.slice(end));
      assert.equal(current.slice(0, token.index), target.slice(0, token.index));
      [...target].forEach((char, index) => {
        if (!/\d/.test(char)) {
          assert.equal(slots(el)[index].textContent, char);
          assert.notEqual(slots(el)[index].style.visibility, 'hidden');
        }
      });
      const value = Number(current.slice(token.index, end).replace(/\D/g, ''));
      assert.ok(value >= previous);
      assert.ok(value <= Number(token[0].replace(/\D/g, '')));
      previous = value;
    }
    advance(850);
    assert.equal(el.textContent, target);
    assert.equal(frames.size, 0);
  });
}

test('trocas rápidas cancelam a animação anterior; desmontar encerra frames', () => {
  const el = new Element();
  revealText(el, 'São Paulo');
  advance(100);
  const cancel = revealText(el, 'João Pessoa');
  assert.equal(frames.size, 1);
  advance(200);
  cancel();
  assert.equal(frames.size, 0);
  assert.equal(el.textContent, 'João Pessoa');
});

test('redução de movimento entrega imediatamente o conteúdo final', () => {
  reducedMotion = true;
  const el = new Element();
  revealText(el, '1.234,56 hab.', 'number');
  assert.equal(el.textContent, '1.234,56 hab.');
  assert.equal(frames.size, 0);
});

test('ausência de dado não é convertida em zero', () => {
  const el = new Element();
  revealText(el, 'sem dado', 'number');
  assert.equal(frames.size, 0);
  assert.equal(el.textContent, 'sem dado');
});
