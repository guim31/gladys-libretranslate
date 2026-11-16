// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal reading writes nothing, an outage is logged once and its end
// once. Never a text, a translation or the API key.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLibreTranslate, createWorld } from './helpers/world.js';

function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record = (...args) =>
    lines.push(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  return { lines, clear: () => lines.splice(0) };
}

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('a normal reading cycle writes nothing at info', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.lines.some((line) => line.includes('connected')),
    'the start is logged',
  );
  logs.clear();
  for (let i = 0; i < 5; i += 1) {
    w.clock.advance(5 * 60_000);
    await w.hub.refresh();
  }
  assert.deepEqual(logs.lines, []);
});

test('an outage writes one line when it starts and one when it ends', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.server.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.refresh();
  }
  w.server.online = true;
  await w.hub.refresh();
  assert.equal(logs.lines.length, 2, logs.lines.join('\n'));
  assert.match(logs.lines[0], /ECONNREFUSED/);
  assert.match(logs.lines[1], /answers again after 5 min/);
});

test('a translation is logged without its text nor its translation, the key never', async (t) => {
  const logs = captureLogs(t, 'debug');
  const server = new FakeLibreTranslate({ apiKey: 'secret-key-123' });
  const w = await world(t, {
    server,
    config: { url: '192.0.2.20', api_key: 'secret-key-123' },
  });
  await w.fake.sceneAction('translate', {
    text: 'Bonjour, la porte du garage est ouverte.',
    target: 'en',
  });
  await w.fake.sceneAction('translate', { text: 'Un texte privé', target: 'it' });
  await w.fake.sceneAction('detect_language', { text: 'Wie spät ist es?' });
  const all = logs.lines.join('\n');
  assert.match(all, /Translated fr → en/);
  assert.match(all, /Detected de/);
  for (const secret of ['garage', 'privé', 'spät', 'secret-key-123']) {
    assert.ok(!all.includes(secret), secret);
  }
});
