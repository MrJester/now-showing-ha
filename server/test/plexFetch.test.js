import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePlexFetch } from '../src/plexFetch.js';

test('makePlexFetch returns the global fetch when not insecure (full TLS verification)', () => {
  assert.equal(makePlexFetch({ insecure: false }), globalThis.fetch);
  assert.equal(makePlexFetch(), globalThis.fetch);
});

test('makePlexFetch returns a custom function when insecure', () => {
  const f = makePlexFetch({ insecure: true });
  assert.equal(typeof f, 'function');
  assert.notEqual(f, globalThis.fetch);
});

test('insecure plexFetch resolves a fetch-like response over plain http', async () => {
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  try {
    const f = makePlexFetch({ insecure: true });
    const resp = await f(`http://127.0.0.1:${port}/x`);
    assert.equal(resp.ok, true);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'application/json');
    assert.deepEqual(await resp.json(), { hello: 'world' });
  } finally {
    server.close();
  }
});
