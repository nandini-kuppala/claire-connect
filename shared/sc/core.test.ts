// Domain-core tests (node:test). Run: npm run test -w server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase, formatQty, groupIndian, dozenHint, unitsFor } from './units.js';
import { classify } from './tolerance.js';
import { winningAssertion, badgeFor } from './evidence.js';
import { closeSplit, approxPending, lossPct } from './conservation.js';
import { unitSlip, tenX, wouldGoNegative, receivedImplausible } from './plausibility.js';
import { addWorkingDays, lateness, workingDaysBetween, todayIST } from './dates.js';
import { purposeOf } from './vocab.js';
import { counterpartyFor } from './mask.js';
import { real, postSend, postReceipt, postSettleLine, postOutput, postClose, postCount, postRegrade, postRespec, assertBalanced, reverse, type Goods } from './postings.js';
import type { Assertion, PartyRef } from './types.js';

const ravi: PartyRef = { k: 'b', id: 'ravi' };
const noyyal: PartyRef = { k: 'c', id: 'noyyal' };
const lakshmi: PartyRef = { k: 'b', id: 'lakshmi' };
const selvi: PartyRef = { k: 'c', id: 'selvi' };
const grey: Goods = { spec: 'sp_grey', lot: 'K-221', grade: 'A', dim: 'mass' };
const navy: Goods = { spec: 'sp_navy', lot: 'N-0412/1', grade: 'A', dim: 'mass' };

test('units: valid, contextual and refused conversions', () => {
  assert.deepEqual(toBase(198.6, 'kg', 'mass'), { ok: true, base: 198600, dim: 'mass', approx: false });
  assert.deepEqual(toBase(50, 'dozen', 'count'), { ok: true, base: 600, dim: 'count', approx: false });
  assert.deepEqual(toBase(2, 'gross', 'count'), { ok: true, base: 288, dim: 'count', approx: false });
  assert.equal(toBase(10, 'kg', 'count').ok, false); // kg can't become pieces
  assert.deepEqual(toBase(4, 'rolls', 'mass'), { ok: false, reason: 'needs_factor' });
  assert.deepEqual(toBase(4, 'rolls', 'mass', 23000), { ok: true, base: 92000, dim: 'mass', approx: true });
  assert.equal(toBase(-1, 'kg', 'mass').ok, false);
  assert.ok(unitsFor('count').includes('dozen'));
  assert.ok(!unitsFor('mass').includes('pcs'));
});

test('units: Indian grouping and display', () => {
  assert.equal(groupIndian(12345678), '1,23,45,678');
  assert.equal(groupIndian(1000), '1,000');
  assert.equal(groupIndian(120000), '1,20,000');
  assert.deepEqual(formatQty(198600, 'mass'), { value: '198.6', unit: 'kg' });
  assert.deepEqual(formatQty(1224, 'count'), { value: '1,224', unit: 'pcs' });
  assert.equal(dozenHint(600), '50 dozen');
  assert.equal(dozenHint(601), null);
});

test('tolerance: weighed ±1.5 %, counted exact (scenario K)', () => {
  assert.equal(classify(500000, 488000, 'weighed').outcome, 'beyond'); // 2.4 %
  assert.equal(classify(300000, 297000, 'weighed').outcome, 'within'); // 1.0 %
  assert.equal(classify(200000, 198600, 'weighed').outcome, 'within'); // 0.7 % (J-0412)
  assert.equal(classify(2000, 1992, 'counted').outcome, 'beyond'); // Colour Craft 8 pcs
  assert.equal(classify(600, 605, 'counted').outcome, 'over');
  assert.equal(classify(600, 600, 'counted').outcome, 'exact');
});

test('evidence: rank first, then recency', () => {
  const a = (id: string, evidence: Assertion['evidence'], at: number, q: number): Assertion => ({ a_id: id, base_qty: q, final: true, evidence, by: {}, business_date: '2026-11-14', recorded_at: at });
  assert.equal(winningAssertion([a('1', 'on_behalf', 1, 198600), a('2', 'link', 2, 196000)])?.a_id, '2');
  assert.equal(winningAssertion([a('1', 'account', 1, 1), a('2', 'link', 9, 2)])?.a_id, '1');
  assert.equal(winningAssertion([a('1', 'self', 1, 1), a('2', 'self', 5, 2)])?.a_id, '2');
  assert.equal(badgeFor(a('1', 'self', 1, 1), a('2', 'link', 2, 1)), 'confirmed_by');
  assert.equal(badgeFor(a('1', 'self', 1, 1), null), 'your_record');
  assert.equal(badgeFor(a('1', 'self', 1, 1), a('2', 'on_behalf', 2, 1)), 'not_confirmed');
});

test('conservation: closure splits per kind (model §5.2)', () => {
  assert.deepEqual(closeSplit('mass_losing', 198600, 189000), { intoOutput: 189000, loss: 9600, residual: 0, flags: [] });
  assert.deepEqual(closeSplit('count_preserving', 3000, 2997), { intoOutput: 2997, loss: 0, residual: 3, flags: ['residual'] });
  assert.deepEqual(closeSplit('mass_losing', 100, 101).flags, ['gain']);
  assert.throws(() => closeSplit('disassembling', 36, 35));
  assert.equal(lossPct(198600, 189000), 4.8); // dyeing loss from Noyyal's declared outputs (P6)
});

test('approx pending reproduces the J-0412 figures (≈ 95 kg grey, ≈ 89 kg navy)', () => {
  const r = approxPending({ kind: 'mass_losing', issued: 198600, outputs: 96000, factor: 0.07 });
  assert.equal(Math.round(r.input / 1000), 95);
  assert.equal(Math.round((r.asOutput ?? 0) / 1000), 89);
  assert.equal(r.overYield, false);
  // single-player: based on the 200 kg sent (04 §5.6.8)
  assert.equal(Math.round(approxPending({ kind: 'mass_losing', issued: 200000, outputs: 96000, factor: 0.07 }).input / 1000), 97);
  // over-yield is flagged, never shown below zero
  const over = approxPending({ kind: 'count_preserving', issued: 600, outputs: 610, factor: 1 });
  assert.deepEqual([over.input, over.overYield], [0, true]);
});

test('plausibility: unit slip, ×10, never negative', () => {
  assert.equal(unitSlip(50, 600), 12); // 50 against 600 open → dozens?
  assert.equal(unitSlip(400, 600), null); // a normal partial delivery
  assert.equal(unitSlip(200, 0.2), 1 / 1000);
  assert.equal(tenX(500, 50), 10); // ஐநூறு for ஐம்பது
  assert.equal(tenX(20, 200), 0.1);
  assert.equal(tenX(60, 50), null);
  assert.equal(wouldGoNegative(180000, -200000), true);
  assert.equal(receivedImplausible(600, 6600), true);
});

test('dates: working days, Sundays off, cluster closures, lateness', () => {
  assert.equal(addWorkingDays('2026-11-21', 6), '2026-11-28'); // Sat → Sat, skipping Sunday
  assert.equal(addWorkingDays('2026-11-14', 6), '2026-11-21'); // J-0412
  assert.equal(addWorkingDays('2026-11-12', 6), '2026-11-19'); // J-0416 Raju
  const cal = { offWeekdays: [0], closed: new Set(['2026-10-05', '2026-10-08', '2026-10-09', '2026-10-10']) };
  assert.equal(addWorkingDays('2026-10-03', 3, cal), '2026-10-12'); // Q: strike + CETP shift the date
  assert.deepEqual(lateness('2026-11-19', '2026-11-21'), { status: 'late', days: 2, reason: 'processing' });
  assert.deepEqual(lateness('2026-11-21', '2026-11-21').status, 'due_today');
  assert.equal(lateness('2026-11-19', '2026-11-21', { pausedDays: 2, reason: 'waiting_input' }).status, 'on_time');
  assert.equal(workingDaysBetween('2026-11-21', '2026-11-23'), 1);
  assert.match(todayIST(Date.parse('2026-11-21T20:00:00Z')), /^2026-11-22$/); // 01:30 IST next day
});

test('vocab: six v1 actions map to internal purposes', () => {
  assert.equal(purposeOf('forward', { instructed_by_owner: true }), 'hop');
  assert.equal(purposeOf('forward'), 'subcontract_out');
  assert.equal(purposeOf('buy_sell', { direction: 'buy', return: 'credit' }), 'purchase_return');
  assert.equal(purposeOf('buy_sell', { direction: 'sell', in_place: true }), 'sale_in_place');
  assert.equal(purposeOf('return_from_work', { from_child_job: true }), 'subcontract_return');
});

test('mask: sub-contract roll-up (scenario F, D2)', () => {
  const k = real(grey, ravi, selvi, { s: 'allocated', ref: 'J1' }, { via: lakshmi });
  assert.deepEqual(counterpartyFor(ravi, k), { party: lakshmi }); // "with Lakshmi"
  assert.deepEqual(counterpartyFor(selvi, k), { party: lakshmi }); // "for Lakshmi", never Ravi
  assert.deepEqual(counterpartyFor(lakshmi, k), { party: selvi });
  assert.deepEqual(counterpartyFor(ravi, k, true), { party: lakshmi, also: selvi }); // disclosed
  assert.equal(counterpartyFor({ k: 'b', id: 'sree' }, k), null);
});

test('postings: every rule balances per dimension', () => {
  const send = postSend({ goods: grey, qty: 200000, owner: ravi, from: { party: ravi }, movementId: 'M1' });
  const recv = postReceipt({ goods: grey, owner: ravi, movementId: 'M1', transitCustodian: ravi, to: { party: noyyal, state: { s: 'allocated', ref: 'J1' } }, delta: 198600 });
  const settle = postSettleLine({ goods: grey, owner: ravi, movementId: 'M1', transitCustodian: ravi, receiver: noyyal, difference: 1400, outcome: 'within', weighingBearer: ravi });
  const out = postOutput({ goods: navy, qty: 96000, owner: ravi, performer: noyyal, jobId: 'J1' });
  const close = postClose({ goods: grey, owner: ravi, performer: noyyal, jobId: 'J1', consumed: 198600, intoOutput: 189000, loss: 9600, residual: 0 });
  const sale = postReceipt({ goods: navy, owner: ravi, movementId: 'M9', transitCustodian: ravi, to: { party: lakshmi }, delta: 5000, ownerAfter: lakshmi });
  const cnt = postCount(real(navy, ravi, ravi, { s: 'available' }), 'mass', 96000, 95000);
  for (const ps of [send, recv, settle, out, close, sale, cnt, reverse(send)]) assertBalanced(ps);
  assert.throws(() => postClose({ goods: grey, owner: ravi, performer: noyyal, jobId: 'J1', consumed: 10, intoOutput: 5, loss: 1, residual: 1 }));
  assert.throws(() => postSettleLine({ goods: grey, owner: ravi, movementId: 'M1', transitCustodian: ravi, receiver: noyyal, difference: 12000, outcome: 'beyond', weighingBearer: ravi }));
  assert.throws(() => assertBalanced([{ key: real(grey, ravi, ravi, { s: 'available' }), delta: 5, dim: 'mass' }]));
  // A mismatch across dimensions is caught even if the raw numbers cancel (+400 pcs vs −400 g).
  assert.throws(() => assertBalanced([{ key: real(grey, ravi, ravi, { s: 'available' }), delta: -400, dim: 'mass' }, { key: real({ ...grey, dim: 'count' }, ravi, ravi, { s: 'available' }), delta: 400, dim: 'count' }]));
});

// ── Property test: a tiny in-memory ledger fed random event sequences ──────────────────────────────

function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test('property: random sequences keep Σ = 0, holdings = Σ postings, real holdings ≥ 0', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed);
    const holdings = new Map<string, number>();
    const isReal = new Map<string, boolean>();
    let totalByDim = { mass: 0, count: 0, length: 0 } as Record<string, number>;
    const post = (ps: ReturnType<typeof postSend>) => {
      assertBalanced(ps);
      // never-negative guard, as repo.post() applies it inside the transaction
      const next = new Map(holdings);
      for (const x of ps) {
        const id = JSON.stringify(x.key);
        next.set(id, (next.get(id) ?? 0) + x.delta);
        isReal.set(id, x.key.t === 'real');
      }
      for (const [id, q] of next) if (isReal.get(id) && q < 0) return false;
      for (const [id, q] of next) holdings.set(id, q);
      for (const x of ps) totalByDim[x.dim] += x.delta;
      return true;
    };
    // opening stock from EXTERNAL(self)
    post(postSend({ goods: grey, qty: 500000, owner: ravi, from: { party: ravi, external: true }, movementId: 'open' }));
    post(postReceipt({ goods: grey, owner: ravi, movementId: 'open', transitCustodian: ravi, to: { party: ravi }, delta: 500000 }));
    let inTransit = 0;
    let atNoyyal = 0;
    for (let step = 0; step < 40; step++) {
      const roll = r();
      const q = 1000 * (1 + Math.floor(r() * 80));
      if (roll < 0.35) {
        if (post(postSend({ goods: grey, qty: q, owner: ravi, from: { party: ravi }, movementId: 'M' }))) inTransit += q;
      } else if (roll < 0.65 && inTransit > 0) {
        const got = Math.min(inTransit, q);
        if (post(postReceipt({ goods: grey, owner: ravi, movementId: 'M', transitCustodian: ravi, to: { party: noyyal, state: { s: 'allocated', ref: 'J' } }, delta: got }))) {
          inTransit -= got;
          atNoyyal += got;
        }
      } else if (roll < 0.8) {
        post(postOutput({ goods: navy, qty: Math.floor(q / 2), owner: ravi, performer: noyyal, jobId: 'J' }));
      } else if (roll < 0.9 && atNoyyal > 0) {
        const c = Math.min(atNoyyal, q);
        const split = closeSplit('mass_losing', c, Math.floor(c * 0.93));
        if (post(postClose({ goods: grey, owner: ravi, performer: noyyal, jobId: 'J', consumed: c, ...split }))) atNoyyal -= c;
      } else {
        // an attempt to send more than exists must be refused, never applied
        const before = JSON.stringify([...holdings]);
        const ok = post(postSend({ goods: grey, qty: 10_000_000, owner: ravi, from: { party: ravi }, movementId: 'X' }));
        assert.equal(ok, false);
        assert.equal(JSON.stringify([...holdings]), before);
      }
      for (const [id, q] of holdings) if (isReal.get(id)) assert.ok(q >= 0, `seed ${seed}: negative ${id}`);
      for (const dim of Object.keys(totalByDim)) assert.equal(totalByDim[dim], 0, `seed ${seed}: Σ ${dim} ≠ 0`);
      const sumHoldings = [...holdings.values()].reduce((a, b) => a + b, 0);
      assert.equal(sumHoldings, 0, `seed ${seed}: holdings don't sum to the postings`);
    }
  }
});
