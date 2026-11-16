// -----------------------------------------------------------------------------
// LibreTranslate API client (https://docs.libretranslate.com), on the global
// fetch.
//
// Read: GET /languages (the languages the server loaded, with their targets),
// GET /spec (its OpenAPI description, whose `info.version` is the version of
// LibreTranslate). Translate: POST /translate. Detect: POST /detect.
//
// The optional API key travels in the JSON body (`api_key`), as LibreTranslate
// expects it. A server that requires one answers 400 "…get an API key" without
// it, and 403 "Invalid API key" with a wrong one (seen on LibreTranslate
// 1.9.6, test/fixtures/libretranslate/). Errors carry a `kind` (ERROR_KINDS)
// the rest of the code translates; their message never holds the text, the
// translation or the key.
// -----------------------------------------------------------------------------

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable',
  TIMEOUT: 'timeout',
  KEY_REQUIRED: 'key_required',
  AUTH: 'auth',
  RATE_LIMIT: 'rate_limit',
  NOT_LIBRETRANSLATE: 'not_libretranslate',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
  TOO_LONG: 'too_long',
  HTTP: 'http',
});

export class LibreTranslateError extends Error {
  constructor(kind, message, { status, cause, detail } = {}) {
    super(message, { cause });
    this.name = 'LibreTranslateError';
    this.kind = kind;
    this.status = status;
    // What the server said, when it helps the user (a language code, a limit).
    this.detail = detail;
  }
}

// Reads are small and quick: a server that takes longer is in trouble.
export const READ_TIMEOUT_MS = 10_000;
// A translation on a small CPU, first one after a start included (the model
// is loaded on demand).
export const TRANSLATE_TIMEOUT_MS = 50_000;

const MAX_SERVER_ERROR = 160;

export class LibreTranslateClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL (src/config.js parseServerUrl)
   * @param {string} [options.apiKey]
   * @param {typeof fetch} [options.fetch] HTTP seam (tests)
   */
  constructor({ url, apiKey = '', fetch: fetchImpl = globalThis.fetch }) {
    this.url = url;
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async call(method, path, { body, timeoutMs = READ_TIMEOUT_MS } = {}) {
    const headers = { accept: 'application/json' };
    let payload;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(this.apiKey ? { ...body, api_key: this.apiKey } : body);
    }
    let response;
    try {
      response = await this.fetch(`${this.url}${path}`, {
        method,
        headers,
        body: payload,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new LibreTranslateError(
          ERROR_KINDS.TIMEOUT,
          `${method} ${path}: no answer within ${timeoutMs / 1000} s`,
          { cause: err },
        );
      }
      // fetch refuses redirects (`redirect: 'error'`): a proxy sending HTTP
      // to HTTPS is a wrong address, not a server that is down.
      if (/redirect/i.test(String(err?.cause?.message ?? err?.message))) {
        throw new LibreTranslateError(
          ERROR_KINDS.NOT_LIBRETRANSLATE,
          `${method} ${path}: redirected`,
          { cause: err },
        );
      }
      const code = err?.cause?.code ?? err?.code;
      throw new LibreTranslateError(
        ERROR_KINDS.UNREACHABLE,
        `${method} ${path}: ${code ?? err?.message ?? 'network error'}`,
        { cause: err },
      );
    }
    let text;
    try {
      text = await response.text();
    } catch (err) {
      const kind = err?.name === 'TimeoutError' ? ERROR_KINDS.TIMEOUT : ERROR_KINDS.UNREACHABLE;
      throw new LibreTranslateError(kind, `${method} ${path}: answer cut short`, { cause: err });
    }
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = undefined;
    }
    const serverError =
      data && typeof data.error === 'string' ? data.error.slice(0, MAX_SERVER_ERROR) : null;
    const fail = (kind, extra = {}) =>
      new LibreTranslateError(
        kind,
        `${method} ${path}: HTTP ${response.status}${serverError ? ` ${serverError}` : ''}`,
        { status: response.status, ...extra },
      );
    // 403 is also the ban of a client over the limits ("Too many request
    // limits violations"): not a wrong key.
    if (response.status === 429 || (response.status === 403 && /too many/i.test(serverError))) {
      throw fail(ERROR_KINDS.RATE_LIMIT);
    }
    if (response.status === 401 || response.status === 403) {
      throw fail(ERROR_KINDS.AUTH);
    }
    // A reverse proxy whose LibreTranslate is stopped: the server is down.
    if ([502, 503, 504].includes(response.status)) {
      throw fail(ERROR_KINDS.UNREACHABLE);
    }
    if (response.status === 400 && serverError) {
      // "Please contact the server operator to get an API key" (self-hosted),
      // "Visit https://portal.libretranslate.com to get an API key" (public).
      if (/api key/i.test(serverError)) {
        throw fail(ERROR_KINDS.KEY_REQUIRED);
      }
      const unsupported = serverError.match(/^(\S+) is not supported/);
      if (unsupported) {
        throw fail(ERROR_KINDS.UNSUPPORTED_LANGUAGE, { detail: unsupported[1].slice(0, 20) });
      }
      const limit = serverError.match(/exceeds text limit \((\d+)\)/);
      if (limit) {
        throw fail(ERROR_KINDS.TOO_LONG, { detail: limit[1] });
      }
    }
    if (!response.ok) {
      throw fail(
        data === undefined || response.status === 404
          ? ERROR_KINDS.NOT_LIBRETRANSLATE
          : ERROR_KINDS.HTTP,
      );
    }
    if (data === undefined || data === null || typeof data !== 'object') {
      throw new LibreTranslateError(
        ERROR_KINDS.NOT_LIBRETRANSLATE,
        `${method} ${path}: not a LibreTranslate answer`,
        { status: response.status },
      );
    }
    return data;
  }

  /**
   * @returns {Promise<Array<{ code: string, name: string, targets: string[] }>>}
   *   the languages loaded on the server
   */
  async languages() {
    const data = await this.call('GET', '/languages');
    if (!Array.isArray(data)) {
      throw new LibreTranslateError(
        ERROR_KINDS.NOT_LIBRETRANSLATE,
        'GET /languages: no language list',
      );
    }
    return data
      .filter((language) => language && typeof language.code === 'string')
      .map((language) => ({
        code: language.code,
        name: typeof language.name === 'string' ? language.name : language.code,
        targets: Array.isArray(language.targets)
          ? language.targets.filter((code) => typeof code === 'string')
          : [],
      }));
  }

  /**
   * The version of LibreTranslate, from its OpenAPI description. Null when the
   * server does not say (an old release, or a proxy that hides /spec): the
   * version is shown, never required.
   * @returns {Promise<string|null>}
   */
  async version() {
    try {
      const data = await this.call('GET', '/spec');
      const version = data?.info?.version;
      return typeof version === 'string' && version.length <= 20 ? version : null;
    } catch (err) {
      if ([ERROR_KINDS.NOT_LIBRETRANSLATE, ERROR_KINDS.HTTP].includes(err.kind)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * @param {object} request
   * @param {string} request.text
   * @param {string} request.source a language code, or `auto`
   * @param {string} request.target
   * @param {number} [request.timeoutMs]
   * @returns {Promise<{ translation: string, detected: { language: string, confidence: number }|null }>}
   */
  async translate({ text, source, target, timeoutMs = TRANSLATE_TIMEOUT_MS }) {
    const data = await this.call('POST', '/translate', {
      body: { q: text, source, target, format: 'text' },
      timeoutMs,
    });
    if (typeof data.translatedText !== 'string') {
      throw new LibreTranslateError(
        ERROR_KINDS.NOT_LIBRETRANSLATE,
        'POST /translate: no translation in the answer',
      );
    }
    const detected = data.detectedLanguage;
    return {
      translation: data.translatedText,
      detected:
        detected && typeof detected.language === 'string'
          ? { language: detected.language, confidence: Number(detected.confidence) || 0 }
          : null,
    };
  }

  /**
   * @param {string} text
   * @returns {Promise<{ language: string, confidence: number }|null>} the most
   *   likely language, null when the server found none
   */
  async detect(text, { timeoutMs = TRANSLATE_TIMEOUT_MS } = {}) {
    const data = await this.call('POST', '/detect', { body: { q: text }, timeoutMs });
    if (!Array.isArray(data)) {
      throw new LibreTranslateError(
        ERROR_KINDS.NOT_LIBRETRANSLATE,
        'POST /detect: no detection in the answer',
      );
    }
    const best = data.find((entry) => entry && typeof entry.language === 'string');
    return best ? { language: best.language, confidence: Number(best.confidence) || 0 } : null;
  }
}
