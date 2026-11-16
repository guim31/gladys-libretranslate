// -----------------------------------------------------------------------------
// The LibreTranslate client against the recorded answers of a real server:
// what it returns, and the kind of every error.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_KINDS, LibreTranslateClient } from '../src/libretranslate/client.js';
import { FakeLibreTranslate } from './helpers/fakeLibreTranslate.js';

const URL = 'http://192.0.2.20:5000';
const clientOf = (server, apiKey = '') =>
  new LibreTranslateClient({ url: URL, apiKey, fetch: server.fetch });

async function kindOf(promise) {
  try {
    await promise;
  } catch (err) {
    return { kind: err.kind, detail: err.detail, message: err.message };
  }
  assert.fail('no error');
}

test('languages and version are read', async () => {
  const client = clientOf(new FakeLibreTranslate());
  const languages = await client.languages();
  assert.deepEqual(
    languages.map((l) => l.code),
    ['en', 'fr', 'de', 'es'],
  );
  assert.deepEqual(languages[0].targets, ['de', 'en', 'es', 'fr']);
  assert.equal(await client.version(), '1.9.6');
});

test('a translation, with the detected language when the source is auto', async () => {
  const client = clientOf(new FakeLibreTranslate());
  assert.deepEqual(
    await client.translate({
      text: 'Bonjour, la porte du garage est ouverte.',
      source: 'auto',
      target: 'en',
    }),
    {
      translation: 'Hello, the garage door is open.',
      detected: { language: 'fr', confidence: 100 },
    },
  );
  assert.deepEqual(
    await client.translate({
      text: 'The washing machine has finished.',
      source: 'en',
      target: 'de',
    }),
    { translation: 'Die Waschmaschine ist fertig.', detected: null },
  );
  assert.deepEqual(await client.detect('Wie spät ist es?'), { language: 'de', confidence: 90 });
});

test('the key travels in the body, and only there', async () => {
  const server = new FakeLibreTranslate({ apiKey: 'k-123' });
  const client = clientOf(server, 'k-123');
  await client.translate({ text: 'Guten Morgen, wie geht es dir?', source: 'de', target: 'fr' });
  await client.languages();
  assert.equal(server.requests[0].body.api_key, 'k-123');
  assert.equal(server.requests[1].body, undefined);
});

test('the errors of a real server get their kind', async () => {
  const open = clientOf(new FakeLibreTranslate());
  assert.deepEqual(await kindOf(open.translate({ text: 'Hi', source: 'en', target: 'it' })), {
    kind: ERROR_KINDS.UNSUPPORTED_LANGUAGE,
    detail: 'it',
    message: 'POST /translate: HTTP 400 it is not supported',
  });
  const keyed = new FakeLibreTranslate({ apiKey: 'k-123' });
  assert.equal(
    (await kindOf(clientOf(keyed).translate({ text: 'Hi', source: 'en', target: 'de' }))).kind,
    ERROR_KINDS.KEY_REQUIRED,
  );
  assert.equal(
    (await kindOf(clientOf(keyed, 'wrong').translate({ text: 'Hi', source: 'en', target: 'de' })))
      .kind,
    ERROR_KINDS.AUTH,
  );
  assert.equal((await kindOf(clientOf(keyed).detect('Hi'))).kind, ERROR_KINDS.KEY_REQUIRED);
});

test('limits, outages and foreign servers get their kind', async () => {
  const server = new FakeLibreTranslate();
  const client = clientOf(server);
  const cases = [
    [{ status: 429, body: { error: 'Slowdown: 20 per 1 minute' } }, ERROR_KINDS.RATE_LIMIT],
    [
      { status: 403, body: { error: 'Too many request limits violations' } },
      ERROR_KINDS.RATE_LIMIT,
    ],
    [
      { status: 400, body: { error: 'Invalid request: request (6000) exceeds text limit (5000)' } },
      ERROR_KINDS.TOO_LONG,
    ],
    [{ status: 502, text: '<html>Bad gateway</html>' }, ERROR_KINDS.UNREACHABLE],
    [{ status: 404, text: '<html>Not found</html>' }, ERROR_KINDS.NOT_LIBRETRANSLATE],
    [{ status: 200, text: '<html>Router login</html>' }, ERROR_KINDS.NOT_LIBRETRANSLATE],
    [{ status: 500, body: { error: 'boom' } }, ERROR_KINDS.HTTP],
    [{ status: 200, body: { nope: true } }, ERROR_KINDS.NOT_LIBRETRANSLATE],
  ];
  for (const [answer, kind] of cases) {
    server.override = () => answer;
    const err = await kindOf(client.translate({ text: 'Hi', source: 'en', target: 'de' }));
    assert.equal(err.kind, kind, JSON.stringify(answer));
  }
  server.override = () => ({
    status: 400,
    body: { error: 'Invalid request: request (6000) exceeds text limit (5000)' },
  });
  assert.equal(
    (await kindOf(client.translate({ text: 'Hi', source: 'en', target: 'de' }))).detail,
    '5000',
  );
  server.override = null;
  server.online = false;
  const down = await kindOf(client.languages());
  assert.equal(down.kind, ERROR_KINDS.UNREACHABLE);
  assert.match(down.message, /ECONNREFUSED/);
});

test('a server that hides /spec has no version, without failing', async () => {
  const server = new FakeLibreTranslate();
  server.override = (path) =>
    path === '/spec' ? { status: 404, text: '<html>Not found</html>' } : undefined;
  assert.equal(await clientOf(server).version(), null);
});

test('a server that does not answer in time is a timeout', async () => {
  const client = new LibreTranslateClient({
    url: URL,
    fetch: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  });
  const err = await kindOf(
    client.translate({ text: 'Hi', source: 'en', target: 'de', timeoutMs: 20 }),
  );
  assert.equal(err.kind, ERROR_KINDS.TIMEOUT);
});
