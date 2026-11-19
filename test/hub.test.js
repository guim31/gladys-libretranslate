// -----------------------------------------------------------------------------
// The integration as Gladys drives it, against the SDK's fake Gladys and a
// LibreTranslate replaying a real server: the device and its states, the
// scene actions (success in green, failure in red with its text), the
// "Test the connection" button, outages, the timer of the container.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeLibreTranslate,
  createAll,
  createWorld,
  deviceId,
  featureId,
} from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const state = (w, key) => w.fake.lastState(featureId(w.gladys, key));

test('the server is published with its states, should_poll false', async (t) => {
  const w = await world(t);
  const [device] = w.fake.discoveredDevices;
  assert.equal(device.external_id, deviceId(w.gladys));
  assert.equal(device.should_poll, false);
  assert.deepEqual(device.params, [
    { name: 'LIBRETRANSLATE_URL', value: 'http://192.0.2.20:5000' },
  ]);
  assert.equal(state(w, 'online'), 1);
  assert.equal(state(w, 'languages'), 4);
  assert.equal(state(w, 'version'), '1.9.6');
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
});

test('without an address: no device, and the status says what to do', async (t) => {
  const w = await world(t, { config: {} });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /Saisissez l'adresse/);
  const ack = await w.fake.sceneAction('translate', { text: 'Bonjour', target: 'en' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /Saisissez l'adresse/);
});

test('only the changes are published; everything again when the device is added', async (t) => {
  const w = await world(t);
  const count = () => w.fake.bodies('POST', '/state').flatMap((body) => body.states).length;
  const first = count();
  assert.equal(first, 3);
  await w.hub.refresh();
  assert.equal(count(), first, 'nothing changed, nothing sent');
  w.server.languages = w.server.languages.slice(0, 2);
  await w.hub.refresh();
  assert.equal(count(), first + 1);
  assert.equal(state(w, 'languages'), 2);
  const refreshes = w.fake.widgetRefreshes.length;
  await createAll(w);
  assert.equal(count(), first + 4, 'the three states again');
  assert.ok(w.fake.widgetRefreshes.length > refreshes, 'widget refresh requested');
});

test('the unchanged states are sent again every 12 hours', async (t) => {
  const w = await world(t);
  const count = () => w.fake.bodies('POST', '/state').flatMap((body) => body.states).length;
  const first = count();
  w.clock.advance(11 * 3600_000);
  await w.hub.refresh();
  assert.equal(count(), first);
  w.clock.advance(3600_000);
  await w.hub.refresh();
  assert.equal(count(), first + 3);
});

test('"Translate" gives the translation and the source language to the scene', async (t) => {
  const w = await world(t);
  let ack = await w.fake.sceneAction('translate', {
    text: '  Bonjour, la porte du garage est ouverte. ',
    target: 'en',
  });
  assert.deepEqual(ack, {
    success: true,
    data: { outputs: { translation: 'Hello, the garage door is open.', source_language: 'fr' } },
  });
  ack = await w.fake.sceneAction('translate', {
    text: 'Guten Morgen, wie geht es dir?',
    source: 'de',
    target: 'fr',
  });
  assert.deepEqual(ack.data.outputs, {
    translation: 'Bonjour, comment allez-vous ?',
    source_language: 'de',
  });
  assert.equal(w.server.requests.at(-1).body.source, 'de');
  assert.equal(w.hub.translationsToday(), 2);
});

test('"Translate" fails in red, with the reason, in four languages', async (t) => {
  const w = await world(t);
  const cases = [
    [{ text: 'Hello', target: 'it' }, /langue it non chargée/],
    [{ text: '   ', target: 'de' }, /Le texte est vide/],
    [{ text: 'x'.repeat(10_001), target: 'de' }, /10 000 caractères/],
    [{ text: 'Hello' }, /Choisissez la langue/],
    [{ text: 'Hello', target: 'de', source: 'it' }, /langue it non chargée/],
  ];
  for (const [fields, message] of cases) {
    const ack = await w.fake.sceneAction('translate', fields);
    assert.equal(ack.success, false, JSON.stringify(fields).slice(0, 60));
    assert.match(ack.error.fr, message);
    assert.deepEqual(Object.keys(ack.error).sort(), ['de', 'en', 'es', 'fr']);
  }
  assert.equal(w.hub.translationsToday(), 0);
});

test('a key: required, wrong, then right', async (t) => {
  const server = new FakeLibreTranslate({ apiKey: 'k-123' });
  const w = await world(t, { server });
  let ack = await w.fake.sceneAction('translate', { text: 'Hello', target: 'de' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /exige une clé d'API/);
  await w.fake.configUpdated({ url: '192.0.2.20', api_key: 'wrong' });
  ack = await w.fake.sceneAction('translate', { text: 'Hello', target: 'de' });
  assert.match(ack.error.fr, /clé d'API refusée/);
  ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.en, /API key refused/);
  await w.fake.configUpdated({ url: '192.0.2.20', api_key: 'k-123' });
  ack = await w.fake.sceneAction('translate', { text: 'Hello', target: 'de' });
  assert.equal(ack.success, true);
  ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true);
});

test('the codes of the older servers are used when the server lists them', async (t) => {
  const server = new FakeLibreTranslate();
  server.languages = [
    ...server.languages,
    { code: 'zt', name: 'Chinese (traditional)', targets: ['en'] },
  ];
  const w = await world(t, { server });
  const ack = await w.fake.sceneAction('translate', { text: 'Hello', target: 'zh-Hant' });
  assert.equal(ack.success, true);
  assert.equal(server.requests.at(-1).body.target, 'zt');
});

test('"Detect the language" gives the code, the name and the confidence', async (t) => {
  const w = await world(t, { config: { url: '192.0.2.20', language: 'fr' } });
  let ack = await w.fake.sceneAction('detect_language', { text: 'Wie spät ist es?' });
  assert.deepEqual(ack, {
    success: true,
    data: { outputs: { language: 'de', language_name: 'allemand', confidence: 90 } },
  });
  ack = await w.fake.sceneAction('detect_language', { text: '' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /Le texte est vide/);
  w.server.override = (path) => (path === '/detect' ? { status: 200, body: [] } : undefined);
  ack = await w.fake.sceneAction('detect_language', { text: '???' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /pas reconnu la langue/);
});

test('"Test the connection" reports the server, or fails in red', async (t) => {
  const w = await world(t);
  let ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /^LibreTranslate 1\.9\.6 répond\. 4 langue\(s\) : anglais/);
  assert.equal(w.server.requests.at(-1).body.q, 'Hello');
  w.server.online = false;
  ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /pas de réponse/);
  w.server.online = true;
  w.server.languages = [];
  ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /Aucune langue chargée/);
});

test('an outage: offline after two failed readings, back at the first answer', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.refresh();
  assert.equal(state(w, 'online'), 1, 'a blip is not an outage');
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  await w.hub.refresh();
  assert.equal(state(w, 'online'), 0);
  const transports = w.fake.bodies('POST', '/device/transport');
  assert.equal(transports.at(-1).transports[0].transport, 'unreachable');
  assert.match(w.fake.connectionStatus.message.fr, /pas de réponse/);
  w.server.online = true;
  await w.hub.refresh();
  assert.equal(state(w, 'online'), 1);
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  assert.equal(w.fake.bodies('POST', '/device/transport').at(-1).transports[0].transport, 'local');
});

test('the container reads the server on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await world(t, { timers: true });
  const reads = () => w.server.requests.filter((r) => r.path === '/languages').length;
  assert.equal(reads(), 1);
  t.mock.timers.tick(5 * 60_000);
  await w.hub.reading;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads(), 2);
  w.server.languages = w.server.languages.slice(0, 1);
  t.mock.timers.tick(5 * 60_000);
  await w.hub.reading;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state(w, 'languages'), 1);
  assert.equal(
    w.fake.requests.filter((r) => r.path === '/poll').length,
    0,
    'Gladys never had to poll',
  );
});

test('a new address in the configuration: the new server is read', async (t) => {
  const server = new FakeLibreTranslate({ url: 'https://translate.example.org' });
  const w = await world(t, { server });
  assert.equal(w.hub.state.error.kind, 'unreachable');
  await w.fake.configUpdated({ url: 'https://translate.example.org', language: 'de' });
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  assert.equal(w.fake.discoveredDevices[0].features[1].name, 'Verfügbare Sprachen');
});

test('a text without words is not detected as a language', async (t) => {
  const w = await world(t);
  w.server.override = (path) =>
    path === '/detect' ? { status: 200, body: [{ confidence: 0.0, language: 'en' }] } : undefined;
  const ack = await w.fake.sceneAction('detect_language', { text: '12345' });
  assert.equal(ack.success, false);
  assert.match(ack.error.en, /could not tell the language/);
});

test('the reading and its timer start even when Gladys refuses the discovery', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await world(t, { timers: true, connect: false });
  t.mock.method(w.gladys, 'publishDiscoveredDevices', async () => {
    throw new Error('HTTP 503');
  });
  await w.gladys.connect();
  await w.app.ready;
  assert.equal(state(w, 'online'), 1);
  const reads = () => w.server.requests.filter((r) => r.path === '/languages').length;
  t.mock.timers.tick(5 * 60_000);
  await w.hub.reading;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads(), 2);
});

test('a server that answers again, even with an error, is no longer down', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.refresh();
  await w.hub.refresh();
  assert.equal(w.hub.state.down, true);
  w.server.online = true;
  w.server.override = () => ({ status: 404, text: '<html>Not found</html>' });
  await w.hub.refresh();
  assert.equal(w.hub.state.down, false);
  assert.equal(w.fake.bodies('POST', '/device/transport').at(-1).transports[0].transport, 'local');
  assert.match(w.fake.connectionStatus.message.en, /no LibreTranslate server/);
});
