import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchParty, phoneticKey, romanize, labelFits } from './resolve.js';

import * as R from './resolve.js';
const mk = (id: string, name: string) => ({ ref: { k: 'b' as const, id }, name, keys: (R as any).__keysForTest?.([name]) ?? [] });

test('romanizes Tamil and Hindi names', () => {
  assert.equal(romanize('லக்ஷ்மி'), 'lakshmi');
  assert.equal(phoneticKey(romanize('நொய்யல்')), phoneticKey('Noyyal'));
  assert.equal(phoneticKey(romanize('नोय्यल')), phoneticKey('Noyyal'));
  assert.equal(phoneticKey('Nooyyal'), phoneticKey('Noyyal'));
});

test('matches a party said in any script, with case endings', () => {
  const cs = [mk('l', 'Lakshmi Garments'), mk('n', 'Noyyal Dyeing'), mk('s', 'Sree Textiles'), mk('a', 'Sri Amman Fabrics')];
  assert.equal(matchParty('லக்ஷ்மிக்கு 400 கிட் அனுப்பினேன்', cs).best?.ref.id, 'l');
  assert.equal(matchParty('நொய்யல்ல இன்னும் எவ்வளவு', cs).best?.ref.id, 'n');
  assert.equal(matchParty('नोय्यल डाइंग से 92 किलो', cs).best?.ref.id, 'n');
  assert.equal(matchParty('Nooyyal', cs).best?.ref.id, 'n');
  assert.equal(matchParty('Amman', cs).best?.ref.id, 'a');
  assert.equal(matchParty('Sree', cs).best?.ref.id, 's');
  assert.equal(matchParty('Kumaran', cs).best, null);
});

test('label filter for "navy fabric"', () => {
  assert.ok(labelFits('Finished navy single jersey 180 GSM', 'navy fabric'));
  assert.ok(!labelFits('Navy RKF-P22 M · Cut kits', 'நேவி துணி'));
  assert.ok(labelFits('Grey single jersey 180 GSM', 'grey fabric'));
});
