import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCapabilities } from './setup.js';

test('capabilities are derived from today\'s sells and role label (04 §11)', () => {
  assert.deepEqual(deriveCapabilities({ sells: ['service.stitching', 'garment.tshirt'], role_label: 'Stitching unit' }).sort(), ['garments', 'stitching']);
  assert.deepEqual(deriveCapabilities({ sells: ['service.dyeing'], role_label: 'Dyeing unit' }), ['dyeing']);
  assert.deepEqual(deriveCapabilities({ sells: [], role_label: 'Retailer' }), ['selling_garments']);
  assert.deepEqual(deriveCapabilities({ sells: ['garment.tshirt'], role_label: 'Brand owner' }), ['garments']);
});
