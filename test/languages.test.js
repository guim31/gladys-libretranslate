import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_CODES, languageName, resolveCode } from '../src/languages.js';

test('the code sent is the one the server lists', () => {
  assert.equal(resolveCode('de', ['en', 'de']), 'de');
  assert.equal(resolveCode('zh-Hans', ['en', 'zh']), 'zh');
  assert.equal(resolveCode('pt-BR', ['en', 'pb']), 'pb');
  assert.equal(resolveCode('zh-Hant', ['en', 'zh-Hant']), 'zh-Hant');
  assert.equal(resolveCode('zh-hans', ['zh-Hans']), 'zh-Hans');
  assert.equal(resolveCode('it', ['en']), 'it', 'unknown: sent as is, the server names it');
  assert.equal(resolveCode('pt-BR', null), 'pt-BR');
});

test('every language has a name in the four languages', () => {
  assert.equal(new Set(LANGUAGE_CODES).size, LANGUAGE_CODES.length);
  for (const code of LANGUAGE_CODES) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const name = languageName(code, language);
      assert.ok(name && name !== code, `${code} in ${language}`);
    }
  }
  assert.equal(languageName('de', 'fr'), 'allemand');
  assert.equal(languageName('zt', 'en'), 'Traditional Chinese');
});
