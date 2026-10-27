import assert from 'node:assert/strict';
import { test } from 'node:test';

const { LADDER, MAX_CENTS, PIECES, fakeQr, formatCents, ladderIndex, raise, thanks } =
  await import('../src/features/donation/donation.ts');

test('o valor só sobe e para em R$ 200', () => {
  assert.equal(raise(500, 100), 500);
  assert.equal(raise(500, 2000), 2000);
  assert.equal(raise(19000, 19000 + 5000), MAX_CENTS);
});

test('moedas e cédulas vão de 5 centavos a 200 reais, em ordem', () => {
  assert.deepEqual(
    PIECES.map((piece) => piece.cents),
    [5, 10, 25, 50, 100, 500, 1000, 2000, 5000, 10000, 20000],
  );
  assert.equal(LADDER[0], 5);
  assert.equal(LADDER.at(-1), MAX_CENTS);
});

test('o controle fica no maior degrau que não passa do valor', () => {
  assert.equal(ladderIndex(5), 0);
  assert.equal(LADDER[ladderIndex(35)], 30);
  assert.equal(ladderIndex(MAX_CENTS), LADDER.length - 1);
});

test('cada aumento agradece de um jeito, e o teto tem mensagem própria', () => {
  const messages = new Set(Array.from({ length: 12 }, (_, index) => thanks(index + 1, 100)));
  assert.equal(messages.size, 12);
  assert.notEqual(thanks(0, 5), thanks(1, 10));
  assert.match(thanks(40, 1234), /R\$\s12,34/);
  assert.match(thanks(3, MAX_CENTS), /R\$ 200/);
  assert.equal(formatCents(5).replace(/\s/g, ' '), 'R$ 0,05');
});

test('o QR ilustrativo é estável por valor, tem os três marcadores e o centro livre', () => {
  const qr = fakeQr('x');
  assert.deepEqual(qr, fakeQr('x'));
  assert.notDeepEqual(qr, fakeQr('y'));
  assert.equal(qr.length, 29);
  for (const [r, c] of [
    [0, 0],
    [0, 28],
    [28, 0],
  ])
    assert.equal(qr[r][c], true);
  assert.equal(qr[14][14], false);
});
