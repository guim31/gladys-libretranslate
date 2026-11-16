// -----------------------------------------------------------------------------
// One Gladys device: the LibreTranslate server.
//
// Identity: a fixed id. One server per integration, and LibreTranslate
// exposes no instance id: changing its address (an IP for a name, a port)
// keeps the device and its history.
//
// Features (category/type couples of the core table, see
// test/gladys-rules.test.js):
//   - online: input/binary, 1 when the server answers, 0 once it failed two
//     readings in a row (a blip is not an outage);
//   - languages: counter-sensor/integer, the languages the server loaded;
//   - version: text/text, the version of LibreTranslate.
//
// should_poll: false: the hub reads the server on its own timer, every five
// minutes (see src/hub.js), beyond the fixed list of the core scheduler.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'server';
export const DEVICE_ID = 'libretranslate';
export const URL_PARAM = 'LIBRETRANSLATE_URL';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  ONLINE: 'online',
  LANGUAGES: 'languages',
  VERSION: 'version',
});

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [FEATURE_KEYS.ONLINE]: 'Online',
    [FEATURE_KEYS.LANGUAGES]: 'Languages available',
    [FEATURE_KEYS.VERSION]: 'Version',
  },
  fr: {
    [FEATURE_KEYS.ONLINE]: 'En ligne',
    [FEATURE_KEYS.LANGUAGES]: 'Langues disponibles',
    [FEATURE_KEYS.VERSION]: 'Version',
  },
  de: {
    [FEATURE_KEYS.ONLINE]: 'Online',
    [FEATURE_KEYS.LANGUAGES]: 'Verfügbare Sprachen',
    [FEATURE_KEYS.VERSION]: 'Version',
  },
  es: {
    [FEATURE_KEYS.ONLINE]: 'En línea',
    [FEATURE_KEYS.LANGUAGES]: 'Idiomas disponibles',
    [FEATURE_KEYS.VERSION]: 'Versión',
  },
};

// Order = display order in Gladys. A value of null publishes nothing.
const FEATURES = [
  {
    key: FEATURE_KEYS.ONLINE,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.INPUT,
      type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 1,
    },
    value: (state) => (state.online === null ? null : state.online ? 1 : 0),
  },
  {
    key: FEATURE_KEYS.LANGUAGES,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 200,
    },
    value: (state) => state.languages?.length ?? null,
  },
  {
    key: FEATURE_KEYS.VERSION,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.TEXT,
      type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
      read_only: true,
      has_feedback: false,
      keep_history: false,
      min: 0,
      max: 0,
    },
    // A text feature never receives an empty text (the core ignores it).
    value: (state) => (state.version ? { text: state.version } : null),
  },
];

/** External ids of the device and its features. */
export const deviceIds = (gladys) => gladys.externalIds(DEVICE_TYPE, DEVICE_ID);

/**
 * The discovery payload of the server.
 * @param {object} gladys SDK client
 * @param {string} url base URL of the server
 * @param {string} language feature names language
 */
export function buildDevice(gladys, url, language = 'en') {
  const ids = deviceIds(gladys);
  const names = NAMES[language] ?? NAMES.en;
  return {
    name: 'LibreTranslate',
    external_id: ids.device,
    should_poll: false,
    params: [{ name: URL_PARAM, value: url }],
    features: FEATURES.map(({ key, definition }) => ({
      ...definition,
      name: names[key],
      external_id: ids.feature(key),
    })),
  };
}

/**
 * The value of every feature for a server state (null: nothing to publish).
 * @returns {Array<{ key: string, externalId: string, value: number|{ text: string }|null }>}
 */
export function featureValues(gladys, state) {
  const ids = deviceIds(gladys);
  return FEATURES.map(({ key, value }) => ({
    key,
    externalId: ids.feature(key),
    value: value(state),
  }));
}
