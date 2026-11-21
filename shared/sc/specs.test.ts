import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseSpec, specLabel, type MaterialTypeDef } from './specs.js';

const fabric: MaterialTypeDef = {
  id: 'mt_knit_fabric', key: 'knit_fabric', base_dimension: 'mass', allowed_units: ['kg'], material_class_key: 'weighed', labels: { en: 'Knitted fabric', ta: '', hi: '' },
  attributes: [
    { key: 'state', role: 'spec', type: 'enum', enum: ['grey', 'finished'], required: true },
    { key: 'structure', role: 'spec', type: 'enum', enum: ['single jersey', 'rib 1x1'], required: true },
    { key: 'gsm', role: 'spec', type: 'number' },
    { key: 'colour', role: 'spec', type: 'text' },
    { key: 'dye_lot', role: 'lot', type: 'text' },
  ],
};

test('specs: the same fabric typed two ways has one identity; lot attributes are not part of it', () => {
  const a = normaliseSpec(fabric, { state: 'Finished', structure: 'single  jersey', gsm: '180', colour: ' Navy ' });
  const b = normaliseSpec(fabric, { colour: 'navy', gsm: 180, structure: 'Single Jersey', state: 'finished', dye_lot: 'D-4471' });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(a.identity, b.identity);
    assert.equal(specLabel(fabric, a.attrs), 'Finished navy single jersey 180 GSM');
  }
});

test('specs: missing required and invalid values are reported, never guessed', () => {
  assert.deepEqual(normaliseSpec(fabric, { colour: 'navy' }), { ok: false, missing: ['state', 'structure'], invalid: [] });
  assert.deepEqual(normaliseSpec(fabric, { state: 'wet', structure: 'rib 1x1', gsm: 'heavy' }), { ok: false, missing: [], invalid: ['state', 'gsm'] });
});
