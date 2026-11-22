import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planClosure, type ClosureLine } from './conservation.js';

const conserves = (p: ReturnType<typeof planClosure>) => p.lines.every((l) => l.consumed === l.intoOutput + l.loss + l.residual);
const L = (id: string, qty: number, extra: Partial<ClosureLine> = {}): ClosureLine => ({ id, dim: 'count', qty, role: 'primary', group: 'kit', ...extra });

test('dyeing: loss is what did not come back, prorated over lots', () => {
  const p = planClosure('mass_losing', [L('a', 198_600, { dim: 'mass' }), L('b', 100_000, { dim: 'mass' })], [{ dim: 'mass', qty: 277_000 }]);
  assert.ok(conserves(p));
  assert.equal(p.loss, 21_600);
  assert.equal(p.lossPct, 7.2);
  assert.equal(p.lines.reduce((a, l) => a + l.intoOutput, 0), 277_000);
});

test('stitching: outputs matched by size; missing pieces are residual; trims used up', () => {
  const p = planClosure('assembling', [L('s', 200, { size: 'S' }), L('m', 200, { size: 'M' }), L('btn', 1224, { role: 'secondary', group: 'btn' })], [{ dim: 'count', qty: 200, size: 'S' }, { dim: 'count', qty: 190, size: 'M' }]);
  assert.ok(conserves(p));
  assert.deepEqual(p.lines.find((l) => l.id === 's'), { id: 's', consumed: 200, intoOutput: 200, loss: 0, residual: 0 });
  assert.equal(p.lines.find((l) => l.id === 'm')!.residual, 10);
  assert.equal(p.residual, 10);
  assert.equal(p.lines.find((l) => l.id === 'btn')!.intoOutput, 1224);
});

test('make sets: a top and a bottom both go into each set', () => {
  const p = planClosure('assembling', [L('top', 100, { group: 'top' }), L('bottom', 100, { group: 'bottom' })], [{ dim: 'count', qty: 98 }]);
  assert.ok(conserves(p));
  assert.equal(p.lines.find((l) => l.id === 'top')!.intoOutput, 98);
  assert.equal(p.lines.find((l) => l.id === 'bottom')!.intoOutput, 98);
  assert.equal(p.residual, 4);
});

test('QC (count preserving): all grades count as output; over-yield is reported, not posted', () => {
  const p = planClosure('count_preserving', [L('g', 400)], [{ dim: 'count', qty: 390 }, { dim: 'count', qty: 7 }, { dim: 'count', qty: 3 }]);
  assert.ok(conserves(p));
  assert.equal(p.residual, 0);
  const q = planClosure('count_preserving', [L('g', 400)], [{ dim: 'count', qty: 405 }]);
  assert.equal(q.overYield, 5);
  assert.equal(q.lines[0].residual, 0);
});

test('cutting: pieces × weight + waste vs fabric; unexplained either sign; unknown weight is unchecked', () => {
  const p = planClosure('unit_changing', [L('f', 100_000, { dim: 'mass' })], [{ dim: 'count', qty: 400 }, { dim: 'mass', qty: 7_500 }], { estimateInto: 400 * 230 + 7_500 });
  assert.ok(conserves(p));
  assert.equal(p.residual, 500);
  const u = planClosure('unit_changing', [L('f', 100_000, { dim: 'mass' })], [{ dim: 'count', qty: 400 }]);
  assert.ok(u.unchecked && conserves(u));
});
