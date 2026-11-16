import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseServerUrl } from '../src/config.js';

test('an address is understood bare, with a port, or as a full URL', () => {
  assert.equal(parseServerUrl('192.0.2.20'), 'http://192.0.2.20:5000');
  assert.equal(parseServerUrl(' 192.0.2.20:5001 '), 'http://192.0.2.20:5001');
  assert.equal(parseServerUrl('translate.local'), 'http://translate.local:5000');
  assert.equal(parseServerUrl('http://192.0.2.20:5000/'), 'http://192.0.2.20:5000');
  assert.equal(parseServerUrl('https://translate.example.org'), 'https://translate.example.org');
  assert.equal(
    parseServerUrl('https://example.org/lt/translate'),
    'https://example.org/lt',
    'an endpoint copied from an example is not a prefix',
  );
});

test('an unusable address is refused', () => {
  for (const raw of ['', '   ', 'ftp://192.0.2.20', 'http://user:pass@192.0.2.20', 'http://', 42]) {
    assert.equal(parseServerUrl(raw), null, String(raw));
  }
  assert.equal(parseServerUrl('http://192.0.2.20:5000/?api_key=x'), null);
});

test('the configuration is normalized', () => {
  assert.deepEqual(normalizeConfig(), {
    url: null,
    urlTyped: false,
    apiKey: '',
    language: DEFAULT_CONFIG.language,
  });
  assert.deepEqual(normalizeConfig({ url: 'nope://', api_key: ' k ', language: 'de' }), {
    url: null,
    urlTyped: true,
    apiKey: 'k',
    language: 'de',
  });
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});
