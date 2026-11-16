// -----------------------------------------------------------------------------
// The dashboard widget: valid for the core (budget, lengths), in every state
// of the server and every language, and its setting.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/hub.js';
import { createWorld } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function content(w, language = 'en', settings = {}) {
  const ack = await w.fake.widgetGet(WIDGET_KEY, { language, settings });
  assert.equal(ack.success, true, JSON.stringify(ack.error));
  const result = ack.data.content;
  validateWidgetContent(result);
  assert.ok(result.components.length <= 8);
  assert.ok(result.components.filter((c) => c.type === 'text').length <= 2);
  return result;
}

const statusOf = (result) => result.components.find((c) => c.type === 'status').items;

test('the widget is valid in every language and state', async (t) => {
  const w = await world(t);
  await w.fake.sceneAction('translate', {
    text: 'Bonjour, la porte du garage est ouverte.',
    target: 'en',
  });
  for (const language of ['en', 'fr', 'de', 'es']) {
    await content(w, language);
  }
  const fr = await content(w, 'fr');
  assert.deepEqual(
    fr.components.filter((c) => c.type === 'value').map((c) => c.value),
    [4, 1],
  );
  assert.equal(statusOf(fr)[0].value, 'En ligne · 1.9.6');
  assert.match(statusOf(fr)[1].value, /^fr → en · \d\d:\d\d$/);
  assert.equal(fr.components.at(-1).text, 'Allemand, anglais, espagnol, français');

  w.server.online = false;
  await w.hub.refresh();
  await w.hub.refresh();
  const down = await content(w, 'fr');
  assert.equal(statusOf(down)[0].value, 'Injoignable');
  assert.equal(statusOf(down)[0].color, 'danger');
});

test('each optional block can be hidden', async (t) => {
  const w = await world(t);
  const bare = await content(w, 'en', {
    show_counters: false,
    show_last_translation: false,
    show_languages: false,
  });
  assert.deepEqual(
    bare.components.map((c) => c.type),
    ['status'],
  );
  assert.equal(statusOf(bare).length, 1);
});

test('the language list can be hidden', async (t) => {
  const w = await world(t);
  const shown = await content(w, 'en', {});
  const hidden = await content(w, 'en', { show_languages: false });
  assert.equal(hidden.components.length, shown.components.length - 1);
  assert.ok(!hidden.components.some((c) => c.type === 'text'));
});

test('without an address the widget says what to do', async (t) => {
  const w = await world(t, { config: {} });
  const result = await content(w, 'es');
  assert.match(result.components[0].text, /Introduzca la dirección/);
});
