// -----------------------------------------------------------------------------
// A fake LibreTranslate server behind a fetch function, replaying the answers
// of a real LibreTranslate 1.9.6 (test/fixtures/libretranslate/server.json):
// the languages, the version, the recorded translations and detections, and
// the exact errors (language not loaded, key missing, key wrong). A text not
// recorded is "translated" as `[target] text`.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/libretranslate/server.json', import.meta.url), 'utf8'),
);

const recorded = (name) => {
  const entry = fixture[name];
  return { status: entry.status, body: structuredClone(entry.body) };
};

// The recorded translations, by text and target.
const TRANSLATIONS = [
  ['Bonjour, la porte du garage est ouverte.', 'en', 'translate_fr_auto_en', 'fr'],
  ['The washing machine has finished.', 'de', 'translate_en_de', 'en'],
  ['Guten Morgen, wie geht es dir?', 'fr', 'translate_de_fr', 'de'],
  ['La puerta del garaje está abierta.', 'fr', 'translate_es_auto_fr', 'es'],
];

export class FakeLibreTranslate {
  /**
   * @param {object} [options]
   * @param {string} [options.url] base URL the fake answers on
   * @param {string|null} [options.apiKey] the key the server requires, if any
   */
  constructor({ url = 'http://192.0.2.20:5000', apiKey = null } = {}) {
    this.url = url;
    this.apiKey = apiKey;
    this.online = true;
    this.languages = recorded('languages').body;
    this.version = fixture.spec.body.info.version;
    /** Override the next answers: (path, body) => { status, body } | { text } | undefined */
    this.override = null;
    this.requests = [];
    this.fetch = this.fetch.bind(this);
  }

  answer(status, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { 'content-type': 'application/json' } });
  }

  async fetch(url, init = {}) {
    if (!this.online) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (!url.startsWith(`${this.url}/`)) {
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    }
    const path = url.slice(this.url.length);
    const body = init.body ? JSON.parse(init.body) : undefined;
    this.requests.push({ method: init.method ?? 'GET', path, body });
    const forced = this.override?.(path, body);
    if (forced) {
      return forced.text !== undefined
        ? new Response(forced.text, { status: forced.status ?? 200 })
        : this.answer(forced.status, forced.body);
    }
    const { status, body: payload } = this.route(path, body);
    return this.answer(status, payload);
  }

  route(path, body) {
    if (path === '/languages') {
      return { status: 200, body: this.languages };
    }
    if (path === '/spec') {
      return { status: 200, body: { info: { ...fixture.spec.body.info, version: this.version } } };
    }
    if (path === '/translate' || path === '/detect') {
      if (this.apiKey && !body.api_key) {
        return recorded('key_missing');
      }
      if (this.apiKey && body.api_key !== this.apiKey) {
        return recorded('key_wrong');
      }
      if (!body.q) {
        return recorded('translate_missing_q');
      }
      return path === '/detect' ? this.detect(body) : this.translate(body);
    }
    return { status: 404, body: '<!doctype html><title>404 Not Found</title>' };
  }

  loaded(code) {
    return this.languages.some((language) => language.code === code);
  }

  translate({ q, source, target }) {
    for (const code of [source, target]) {
      if (code !== 'auto' && !this.loaded(code)) {
        return { status: 400, body: { error: `${code} is not supported` } };
      }
    }
    const known = TRANSLATIONS.find(([text, to]) => text === q && to === target);
    const detected = known?.[3] ?? 'en';
    const result = known ? recorded(known[2]).body : { translatedText: `[${target}] ${q}` };
    if (source === 'auto') {
      result.detectedLanguage = { confidence: 100.0, language: detected };
    } else {
      delete result.detectedLanguage;
    }
    return { status: 200, body: result };
  }

  detect({ q }) {
    if (q === 'Wie spät ist es?') {
      return recorded('detect_de');
    }
    const known = TRANSLATIONS.find(([text]) => text === q);
    return { status: 200, body: [{ confidence: 100.0, language: known?.[3] ?? 'en' }] };
  }
}
