// -----------------------------------------------------------------------------
// The LibreTranslate hub: the server is read on a timer of the container
// (every five minutes), its states published to Gladys when they change; and
// the translations and detections of the scene actions.
//
// Gladys never polls the device (should_poll: false): five minutes is beyond
// the fixed list of the core scheduler, and a server's languages change only
// when its administrator restarts it.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { buildDevice, deviceIds, featureValues } from './devices.js';
import { ERROR_KINDS, LibreTranslateClient } from './libretranslate/client.js';
import { languageName, resolveCode } from './languages.js';
import {
  ACTION_TEXT,
  ActionFailure,
  CONNECTION_TEXT,
  REPORT_TEXT,
  errorText,
  labelled,
  prefixed,
} from './texts.js';

const logger = createLogger({ name: 'libretranslate-hub' });

export const WIDGET_KEY = 'libretranslate';

export const HUB_TIMINGS = {
  // How often the server is read.
  pollMs: 5 * 60_000,
  // A server that fails once is read again this soon, to tell a blip from an outage.
  retryMs: 15_000,
  // Failures in a row before the server counts as down.
  downAfterFailures: 2,
  // States that do not change are sent again this often, or Gladys shows
  // "no recent value" after 48 hours.
  heartbeatMs: 12 * 60 * 60_000,
};

// Gladys caps a scene action output at 10 000 characters: a longer text could
// not come back whole, so it is refused rather than cut.
export const MAX_TEXT_CHARACTERS = 10_000;

// The window of the "translations" figure of the widget.
const DAY_MS = 24 * 60 * 60_000;

// The test translation of "Test the connection": the read before it takes up
// to 10 s, and Gladys grants the button 60 s.
const TEST_TIMEOUT_MS = 30_000;

const DOWN_KINDS = new Set([ERROR_KINDS.UNREACHABLE, ERROR_KINDS.TIMEOUT]);

/** A scene field as a trimmed string ('' for anything else). */
const textOf = (value) => (typeof value === 'string' ? value.trim() : '');

export class LibreTranslateHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {typeof fetch} [options.fetch] HTTP seam (tests)
   * @param {boolean} [options.timers] periodic timers (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, fetch, timers = true, timings, now }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.state = this.emptyState();
    /** Last value published per feature external id (JSON), and when. */
    this.published = new Map();
    this.heartbeatAt = 0;
    this.transport = null;
    this.connection = null;
    this.pollTimer = null;
    this.retryTimer = null;
    this.reading = null;
    this.stopped = false;
    /** Times of the translations of the last 24 hours, and the last one. */
    this.translations = [];
    this.lastTranslation = null;
    /** Problems already logged as warnings, by key: repeats go to debug. */
    this.warned = new Set();
  }

  emptyState() {
    return {
      online: null,
      version: null,
      languages: null,
      error: null,
      failures: 0,
      down: false,
      downSince: null,
    };
  }

  // --- Logs ------------------------------------------------------------------
  // Info keeps the lifecycle only (server connected, lost, back, one line per
  // translation). A problem that repeats every cycle is logged once at its
  // own level, then at debug until it clears. Never a text, a translation or
  // the key.

  problem(key, message, err, level = 'warn') {
    const args = err === undefined ? [message] : [message, err];
    if (this.warned.has(key)) {
      logger.debug(...args);
      return;
    }
    this.warned.add(key);
    logger[level](...args);
  }

  resolved(key) {
    this.warned.delete(key);
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.published.clear();
    this.transport = null;
    this.connection = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const changed = !previous || previous.url !== config.url || previous.apiKey !== config.apiKey;
    if (changed) {
      this.client = config.url
        ? new LibreTranslateClient({ url: config.url, apiKey: config.apiKey, fetch: this.fetch })
        : null;
      // Another server: forget what the previous one said.
      this.state = this.emptyState();
      clearTimeout(this.retryTimer);
    }
    try {
      await this.publishDevices();
      this.resolved('discovery');
    } catch (err) {
      // The reading and its timer must start anyway: the scenes need them.
      this.problem('discovery', `Discovery refused: ${err.message}`);
    }
    try {
      await this.refresh();
    } finally {
      this.schedulePoll();
    }
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    clearTimeout(this.retryTimer);
    await this.reading?.catch(() => {});
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.refresh();
        this.resolved('poll');
      } catch (err) {
        this.problem('poll', 'Reading failed', err, 'error');
      }
      this.schedulePoll();
    }, this.timings.pollMs);
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    if (!this.timersEnabled || this.stopped) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.refresh().catch((err) => this.problem('retry', 'Reading failed', err, 'error'));
    }, this.timings.retryMs);
    this.retryTimer.unref?.();
  }

  // --- Device ----------------------------------------------------------------

  async publishDevices() {
    // An empty list when no address is set: the Discovery tab shows nothing stale.
    const devices = this.config.url
      ? [buildDevice(this.gladys, this.config.url, this.config.language)]
      : [];
    await this.gladys.publishDiscoveredDevices(devices);
  }

  /** "Search" in the Discovery tab: publish the device again, read the server. */
  async rediscover() {
    await this.publishDevices();
    await this.refresh();
  }

  /** The user added the device: its states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    if (device.external_id !== deviceIds(this.gladys).device) {
      return;
    }
    await this.publishStates({ force: true });
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  // --- Reading the server ------------------------------------------------------

  /** Read the server and publish what changed. Concurrent calls share the read. */
  refresh() {
    if (!this.client) {
      return this.afterChanges(false);
    }
    // A read of a previous address is not shared: the new one is read now.
    if (this.reading?.client !== this.client) {
      const reading = this.read().finally(() => {
        if (this.reading === reading) {
          this.reading = null;
        }
      });
      reading.client = this.client;
      this.reading = reading;
    }
    return this.reading;
  }

  /** Gladys asks for a refresh (onPoll), a fallback: the timer does the work. */
  async pollDevice(device) {
    if (device.external_id === deviceIds(this.gladys).device) {
      await this.refresh();
    }
  }

  async read() {
    const client = this.client;
    let widgetChanged;
    try {
      const [languages, version] = await Promise.all([client.languages(), client.version()]);
      if (client !== this.client) {
        return; // the address changed while reading
      }
      widgetChanged = await this.applySuccess({ languages, version });
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      if (client !== this.client) {
        return;
      }
      widgetChanged = await this.applyFailure(err);
    }
    await this.afterChanges(widgetChanged);
  }

  async applySuccess({ languages, version }) {
    const state = this.state;
    const codes = (list) => (list ?? []).map((language) => language.code).join(',');
    const widgetChanged =
      state.online !== true ||
      state.error !== null ||
      state.version !== version ||
      codes(state.languages) !== codes(languages);
    if (state.down) {
      const minutes = Math.round((this.now() - state.downSince) / 60_000);
      logger.info(`LibreTranslate answers again after ${minutes} min`);
    } else if (state.error) {
      logger.info('LibreTranslate: connection restored');
    } else if (state.online === null) {
      logger.info(
        `LibreTranslate ${version ?? '(version unknown)'} connected, languages: ${codes(languages) || 'none'}`,
      );
    } else if (codes(state.languages) !== codes(languages)) {
      logger.info(`LibreTranslate languages changed: ${codes(languages) || 'none'}`);
    }
    clearTimeout(this.retryTimer);
    this.state = {
      online: true,
      version,
      languages,
      error: null,
      failures: 0,
      down: false,
      downSince: null,
    };
    await this.publishStates();
    return widgetChanged;
  }

  async applyFailure(err) {
    const state = this.state;
    const wasError = state.error?.kind;
    state.error = { kind: err.kind, detail: err.detail };
    // One warning when the problem starts (or changes), not one per reading.
    if (wasError !== err.kind) {
      logger.warn(`LibreTranslate: ${err.message}`);
    } else {
      logger.debug(`LibreTranslate: ${err.message} (again)`);
    }
    // Only silence counts as down: a wrong address is a configuration
    // problem, reported by the connection status.
    if (!DOWN_KINDS.has(err.kind)) {
      // Something answers again: whatever it says, the server is not down.
      state.failures = 0;
      state.down = false;
      state.downSince = null;
      await this.publishStates();
      return wasError !== err.kind;
    }
    state.failures += 1;
    if (state.failures === 1) {
      state.downSince = this.now();
      this.scheduleRetry();
    }
    if (!state.down && state.failures >= this.timings.downAfterFailures) {
      state.down = true;
      state.online = false;
      await this.publishStates();
      return true;
    }
    await this.publishStates();
    return wasError !== err.kind;
  }

  // --- Publishing to Gladys ----------------------------------------------------------

  async publishStates({ force = false } = {}) {
    const heartbeat = this.now() - this.heartbeatAt >= this.timings.heartbeatMs;
    const states = [];
    for (const { externalId, value } of featureValues(this.gladys, this.state)) {
      const key = JSON.stringify(value);
      if (value === null || (!force && !heartbeat && this.published.get(externalId) === key)) {
        continue;
      }
      states.push({ device_feature_external_id: externalId, state: value, key });
    }
    if (states.length === 0) {
      return;
    }
    try {
      // A text goes in the batch as `text`, a number as `state`.
      await this.gladys.publishStates(
        states.map(({ device_feature_external_id, state }) =>
          typeof state === 'number'
            ? { device_feature_external_id, state }
            : { device_feature_external_id, text: state.text },
        ),
      );
      for (const state of states) {
        this.published.set(state.device_feature_external_id, state.key);
      }
      if (heartbeat || force) {
        this.heartbeatAt = this.now();
      }
      this.resolved('states');
    } catch (err) {
      this.problem('states', `States refused: ${err.message}`);
    }
  }

  async afterChanges(widgetChanged) {
    await this.publishTransport();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async publishTransport() {
    if (!this.client || this.state.online === null) {
      return;
    }
    const transport = this.state.down ? DEVICE_TRANSPORTS.UNREACHABLE : DEVICE_TRANSPORTS.LOCAL;
    if (this.transport === transport) {
      return;
    }
    try {
      await this.gladys.publishTransports([
        { external_id: deviceIds(this.gladys).device, transport },
      ]);
      this.transport = transport;
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transport refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.config.url) {
      return {
        connected: false,
        message: this.config.urlTyped ? CONNECTION_TEXT.invalidUrl : CONNECTION_TEXT.noUrl,
      };
    }
    // A single missed reading is a blip, not an outage: silence shows once
    // the server counts as down.
    const blip = this.state.error && DOWN_KINDS.has(this.state.error.kind) && !this.state.down;
    if (this.state.error && !blip) {
      return {
        connected: false,
        message: prefixed(errorText(this.state.error.kind, this.state.error.detail)),
      };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  // --- Commands --------------------------------------------------------------------------

  /** The client, or the reason there is none. */
  requireClient() {
    if (!this.client) {
      throw new ActionFailure(this.connectionStatus().message);
    }
    return this.client;
  }

  /** An error of the client, as the user reads it. */
  userError(err) {
    if (!err.kind) {
      logger.error('Unexpected error', err);
      return new ActionFailure(prefixed(errorText(ERROR_KINDS.HTTP)));
    }
    return new ActionFailure(prefixed(errorText(err.kind, err.detail)));
  }

  /** The text of a scene field, checked: not empty, not over the output cap. */
  textToSend(raw) {
    const text = textOf(raw);
    if (!text) {
      throw new ActionFailure(ACTION_TEXT.noText);
    }
    if (text.length > MAX_TEXT_CHARACTERS) {
      throw new ActionFailure(ACTION_TEXT.tooLong);
    }
    return text;
  }

  /** The codes the server listed, null before the first reading. */
  availableCodes() {
    return this.state.languages?.map((language) => language.code) ?? null;
  }

  /**
   * Translate a text.
   * @param {object} request
   * @param {unknown} request.text
   * @param {unknown} request.target a language code
   * @param {unknown} [request.source] a language code; empty or `auto`: detected
   * @returns {Promise<{ translation: string, source_language: string }>}
   */
  async translate({ text: rawText, target: rawTarget, source: rawSource }) {
    const client = this.requireClient();
    const text = this.textToSend(rawText);
    const available = this.availableCodes();
    const typedTarget = textOf(rawTarget);
    if (!typedTarget || typedTarget === 'auto') {
      throw new ActionFailure(ACTION_TEXT.noTarget);
    }
    const target = resolveCode(typedTarget, available);
    const typedSource = textOf(rawSource);
    const source =
      !typedSource || typedSource === 'auto' ? 'auto' : resolveCode(typedSource, available);
    const started = this.now();
    let result;
    try {
      result = await client.translate({ text, source, target });
    } catch (err) {
      logger.warn(`Translation ${source} → ${target} failed: ${err.message}`);
      throw this.userError(err);
    }
    const translation = result.translation.trim();
    if (!translation) {
      logger.warn(`Translation ${source} → ${target}: empty answer`);
      throw new ActionFailure(ACTION_TEXT.emptyTranslation);
    }
    const from = source === 'auto' ? (result.detected?.language ?? 'auto') : source;
    const seconds = Math.round((this.now() - started) / 100) / 10;
    // Lengths only: the text and its translation stay out of the logs.
    logger.debug(
      `Translated ${from} → ${target} in ${seconds} s (${text.length} → ${translation.length} characters)`,
    );
    this.countTranslation({ source: from, target });
    return { translation, source_language: from };
  }

  /**
   * Tell the language of a text.
   * @returns {Promise<{ language: string, language_name: string, confidence: number }>}
   */
  async detect(rawText) {
    const client = this.requireClient();
    const text = this.textToSend(rawText);
    let best;
    try {
      best = await client.detect(text);
    } catch (err) {
      logger.warn(`Detection failed: ${err.message}`);
      throw this.userError(err);
    }
    // A text without words (digits, symbols) comes back as "en" at 0 %.
    if (!best || best.confidence <= 0) {
      throw new ActionFailure(ACTION_TEXT.notDetected);
    }
    logger.debug(`Detected ${best.language} (${best.confidence} %, ${text.length} characters)`);
    return {
      language: best.language,
      language_name: languageName(best.language, this.config.language),
      confidence: Math.round(best.confidence),
    };
  }

  countTranslation({ source, target }) {
    const now = this.now();
    this.translations = this.translations.filter((at) => now - at < DAY_MS);
    this.translations.push(now);
    this.lastTranslation = { source, target, at: now };
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** Translations of the last 24 hours. */
  translationsToday() {
    const now = this.now();
    return this.translations.filter((at) => now - at < DAY_MS).length;
  }

  /**
   * "Test the connection": read the server now, then translate one word, so a
   * key the server refuses shows here and not in the first scene.
   * @returns {Promise<Record<string, string>>} the report, in four languages
   */
  async testConnection() {
    const client = this.requireClient();
    await this.refresh();
    if (this.state.error) {
      throw new ActionFailure(prefixed(errorText(this.state.error.kind, this.state.error.detail)));
    }
    const languages = this.state.languages ?? [];
    if (languages.length === 0) {
      throw new ActionFailure(
        Object.fromEntries(Object.entries(REPORT_TEXT).map(([lang, text]) => [lang, text.none])),
      );
    }
    // English first when loaded (the usual pivot), else the first language.
    const from = languages.find((language) => language.code === 'en') ?? languages[0];
    const to = from.targets.find((code) => code !== from.code) ?? from.code;
    const started = this.now();
    try {
      await client.translate({
        text: 'Hello',
        source: from.code,
        target: to,
        timeoutMs: TEST_TIMEOUT_MS,
      });
    } catch (err) {
      logger.warn(`Test translation failed: ${err.message}`);
      throw this.userError(err);
    }
    const seconds = Math.round((this.now() - started) / 100) / 10;
    logger.info(`Test translation ${from.code} → ${to} in ${seconds} s`);
    const message = {};
    for (const [lang, text] of Object.entries(REPORT_TEXT)) {
      const names = languages.map((language) => languageName(language.code, lang));
      const list = names.length > 8 ? `${names.slice(0, 8).join(', ')}…` : names.join(', ');
      message[lang] =
        `${text.ok(this.state.version)} ${labelled(text.languages(languages.length), list, lang)}. ${text.tested(seconds)}`.slice(
          0,
          200,
        );
    }
    return message;
  }
}
