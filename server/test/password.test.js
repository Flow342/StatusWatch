import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { verifyPassword } from '../src/lib/password.js';

const HASH = await bcrypt.hash('correct horse', 10);

test('verifyPassword — accepts the right password against a bcrypt hash', async () => {
  assert.equal(await verifyPassword('correct horse', { hash: HASH }), true);
});

test('verifyPassword — rejects the wrong password against a bcrypt hash', async () => {
  assert.equal(await verifyPassword('wrong horse', { hash: HASH }), false);
});

test('verifyPassword — prefers the hash when both hash and plaintext are configured', async () => {
  // The plaintext must be ignored entirely, otherwise a stale ADMIN_PASSWORD left in
  // the environment would keep working after the operator switched to a hash.
  const credential = { hash: HASH, plaintext: 'some-other-password' };

  assert.equal(await verifyPassword('correct horse', credential), true);
  assert.equal(await verifyPassword('some-other-password', credential), false);
});

test('verifyPassword — falls back to plaintext only when no hash is set', async () => {
  assert.equal(await verifyPassword('dev-password', { plaintext: 'dev-password' }), true);
  assert.equal(await verifyPassword('nope', { plaintext: 'dev-password' }), false);
});

test('verifyPassword — fails closed on a malformed hash instead of throwing', async () => {
  assert.equal(await verifyPassword('anything', { hash: 'not-a-bcrypt-hash' }), false);
});

test('verifyPassword — rejects empty or non-string candidates', async () => {
  for (const candidate of ['', undefined, null, 12345, {}]) {
    assert.equal(await verifyPassword(candidate, { hash: HASH }), false);
  }
});

test('verifyPassword — rejects everything when no credential is configured', async () => {
  assert.equal(await verifyPassword('anything', {}), false);
  assert.equal(await verifyPassword('anything'), false);
});
