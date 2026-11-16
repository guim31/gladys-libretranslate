// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The port of a LibreTranslate server started with its defaults.
export const DEFAULT_PORT = 5000;

export const DEFAULT_CONFIG = {
  url: '',
  api_key: '',
  language: 'fr',
};

/**
 * Parse the address typed by the user into a base URL: a bare host or IP
 * (`192.0.2.10`, port 5000 added), `host:port`, or a full URL (a reverse
 * proxy: `https://translate.example.org/lt`, its path kept).
 * @param {unknown} raw
 * @returns {string|null} base URL without trailing slash, null when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const typedScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  let url;
  try {
    url = new URL(typedScheme ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs and the device params.
  if (url.username || url.password || url.search || url.hash) {
    return null;
  }
  if (!typedScheme && !url.port) {
    url.port = String(DEFAULT_PORT);
  }
  // An endpoint copied from an example (`/translate`) is not a prefix.
  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/(translate|detect|languages)$/, '')
    .replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const typed = text('url');
  return {
    url: parseServerUrl(typed),
    urlTyped: typed !== '',
    apiKey: text('api_key'),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
