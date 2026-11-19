import test from 'node:test';
import assert from 'node:assert/strict';
import { submitRequest, validEndpoint } from '../assets/formspree.js';

const endpoint = 'https://formspree.io/f/testform';
const request = { email: 'test@example.invalid', name: 'Test User', subject: 'Order request', message: 'Product 1\nQuantity: 2\nµg café', kind: 'order', source: 'https://example.invalid/order/' };

test('only accepts a Formspree form endpoint', () => {
  assert.equal(validEndpoint(endpoint), true);
  for (const url of ['', 'http://formspree.io/f/test', 'https://evil.example/f/test', 'https://formspree.io.evil.example/f/test', 'https://formspree.io/f/test?redirect=evil']) assert.equal(validEndpoint(url), false);
});

test('unconfigured endpoint does not make a network request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  assert.equal((await submitRequest('', request)).ok, false);
  assert.equal(fetch.mock.callCount(), 0);
});

test('submits reply-to and complete Unicode request, without WordPress fields', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Accept, 'application/json');
    assert.deepEqual([...options.body.keys()], ['email', 'name', 'subject', 'message', 'request_type', 'source', '_gotcha']);
    assert.equal(options.body.getAll('email').length, 1);
    assert.equal(options.body.get('email'), request.email);
    assert.equal(options.body.get('message'), request.message);
    return { ok: true };
  });
  assert.equal((await submitRequest(endpoint, request)).ok, true);
});

test('shows provider validation errors without claiming success', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 422, json: async () => ({ errors: [{ message: 'Email is invalid' }] }) }));
  const result = await submitRequest(endpoint, request);
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Email is invalid');
});

test('handles submission rate limit', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429 }));
  assert.match((await submitRequest(endpoint, request)).message, /Too many submissions/);
});

test('handles non-JSON service failure', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503, json: async () => { throw new Error('HTML response'); } }));
  const result = await submitRequest(endpoint, request);
  assert.equal(result.ok, false);
  assert.match(result.message, /did not accept/);
});

test('network failure remains unconfirmed and never retries automatically', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  const result = await submitRequest(endpoint, request);
  assert.equal(result.ok, false);
  assert.match(result.message, /could not be confirmed/);
  assert.equal(fetch.mock.callCount(), 1);
});
