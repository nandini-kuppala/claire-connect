import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moderateText, nexconnWordList, MASK } from './moderation.js';

test('moderation mirrors the Nexconn word list: block, mask, pass', () => {
  assert.deepEqual(moderateText('Please send 200 pcs by Friday'), { action: 'pass', text: 'Please send 200 pcs by Friday' });
  assert.equal(moderateText('you BASTARD, pay now').action, 'block');
  assert.equal(moderateText('zzblockprobe').action, 'block');
  assert.deepEqual(moderateText('Stupid delay again, zzmaskprobe'), { action: 'mask', text: `${MASK} delay again, ${MASK}` });
  const list = nexconnWordList();
  assert.ok(list.length <= 50, 'Nexconn allows 50 words per app');
  assert.ok(list.every((w) => w.word.length <= 32 && (!w.replacement || w.replacement.length <= 32)));
});
