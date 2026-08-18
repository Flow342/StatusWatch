import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, asyncHandler } from '../src/lib/errors.js';

test('ApiError — carries status and optional details', () => {
  const err = new ApiError(404, 'Service not found');
  assert.equal(err.status, 404);
  assert.equal(err.name, 'ApiError');
  assert.ok(err instanceof Error);

  const withDetails = new ApiError(400, 'Validation failed', { url: 'bad' });
  assert.deepEqual(withDetails.details, { url: 'bad' });
});

test('asyncHandler — forwards a rejected promise to next()', async () => {
  const boom = new Error('boom');
  const handler = asyncHandler(async () => {
    throw boom;
  });

  const forwarded = await new Promise((resolve) => {
    handler({}, {}, resolve);
  });

  assert.equal(forwarded, boom);
});

test('asyncHandler — does not call next() on success', async () => {
  let nextCalls = 0;
  const handler = asyncHandler(async (_req, res) => {
    res.done = true;
  });

  const res = {};
  await handler({}, res, () => {
    nextCalls += 1;
  });

  assert.equal(res.done, true);
  assert.equal(nextCalls, 0);
});
