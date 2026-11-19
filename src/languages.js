// -----------------------------------------------------------------------------
// The languages LibreTranslate can translate: every language of the Argos
// Translate package index (50 in November 2026), under the codes the API
// accepts. A server translates only the ones it loaded (`--load-only`), read
// from GET /languages; the scene action lists them all, since a manifest
// select is static.
//
// LibreTranslate 1.6+ names three of them pt-BR, zh-Hans and zh-Hant; older
// servers know them as pb, zh and zt. The code sent is the one the server
// lists (see resolveCode).
// -----------------------------------------------------------------------------

export const LANGUAGE_CODES = [
  'ar',
  'az',
  'bg',
  'bn',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'eo',
  'es',
  'et',
  'eu',
  'fa',
  'fi',
  'fr',
  'ga',
  'gl',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ky',
  'lt',
  'lv',
  'ms',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sk',
  'sl',
  'sq',
  'sv',
  'sw',
  'th',
  'tl',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-Hans',
  'zh-Hant',
];

// Current code → code of the LibreTranslate releases before 1.6.
const LEGACY = { 'pt-br': 'pb', 'zh-hans': 'zh', 'zh-hant': 'zt' };

/**
 * The code to send for `code`, given the codes the server listed: the same
 * code in the server's own spelling, else its legacy (or current) alias, else
 * `code` itself (the server then names the language it does not support).
 * @param {string} code
 * @param {string[]|null} available
 */
export function resolveCode(code, available) {
  if (!available?.length) {
    return code;
  }
  const lower = code.toLowerCase();
  const legacy = LEGACY[lower];
  const current = Object.keys(LEGACY).find((key) => LEGACY[key] === lower);
  for (const candidate of [lower, legacy, current]) {
    const found = candidate && available.find((item) => item.toLowerCase() === candidate);
    if (found) {
      return found;
    }
  }
  return code;
}

/**
 * The name of a language in one of the four interface languages, e.g.
 * "allemand" for `de` in French. Node ships the full ICU data.
 * @param {string} code
 * @param {string} language
 */
export function languageName(code, language) {
  const canonical = { pb: 'pt-BR', zh: 'zh-Hans', zt: 'zh-Hant' }[code] ?? code;
  try {
    return new Intl.DisplayNames([language], { type: 'language' }).of(canonical) ?? code;
  } catch {
    return code;
  }
}
