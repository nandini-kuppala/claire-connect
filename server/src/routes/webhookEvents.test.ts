import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describeCallEvent, verifySignature, webhookKind } from './webhookEvents.js';

const sign = (secret: string, nonce: string, ts: string) => crypto.createHash('sha1').update(secret + nonce + ts).digest('hex');

test('webhook signature: headers or query string, wrong key or secret refused', () => {
  const sig = sign('s3cret', 'n1', '1700000000000');
  assert.equal(verifySignature({ nonce: 'n1', timestamp: '1700000000000', signature: sig, appkey: 'k' }, {}, 'k', 's3cret'), true);
  assert.equal(verifySignature({}, { appKey: 'k', nonce: 'n1', timestamp: '1700000000000', signature: sig.toUpperCase() }, 'k', 's3cret'), true);
  assert.equal(verifySignature({ nonce: 'n1', timestamp: '1700000000000', signature: sig, appkey: 'other' }, {}, 'k', 's3cret'), false);
  assert.equal(verifySignature({ nonce: 'n1', timestamp: '1700000000000', signature: sig }, {}, 'k', 'wrong'), false);
  assert.equal(verifySignature({ nonce: 'n1', timestamp: '1700000000000', signature: sig }, {}, 'k', ''), false);
  assert.equal(verifySignature({}, {}, 'k', 's3cret'), false);
});

test('webhook kinds: messages handled, call events recognised, anything else ignored', () => {
  assert.equal(webhookKind({ type: 'message:send', data: [] }), 'message');
  assert.equal(webhookKind({ type: 'message:send', data: 'x' }), 'other');
  assert.equal(webhookKind({ type: 'call:hangup', data: [{ callId: '1' }] }), 'call');
  assert.equal(webhookKind({ eventType: 'rtc:room:destroy' }), 'call');
  assert.equal(webhookKind({ callId: '2124', reason: 1000 }), 'call');
  assert.equal(webhookKind({ type: 'user:status' }), 'other');
  for (const junk of [null, undefined, 'text', 42, []]) assert.equal(webhookKind(junk), 'other');
  assert.equal(describeCallEvent({ type: 'call:hangup', data: [{ callId: '99' }] }), 'call:hangup · callId 99');
  assert.equal(describeCallEvent(null), 'call · callId ?');
});
