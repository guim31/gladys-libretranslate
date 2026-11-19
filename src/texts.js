// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene action
// errors. Four languages, the four of the Gladys interface; German says "du",
// Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './libretranslate/client.js';

/**
 * A failure shown in red by Gladys: the handler throws it, its message is the
 * multi-language object (a resolved value is shown in green, as a success).
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Enter the address of your LibreTranslate server in the configuration.',
    fr: "Saisissez l'adresse de votre serveur LibreTranslate dans la configuration.",
    de: 'Gib die Adresse deines LibreTranslate-Servers in der Konfiguration ein.',
    es: 'Introduzca la dirección de su servidor LibreTranslate en la configuración.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. http://192.168.1.20:5000',
    fr: 'Adresse incomprise, ex. http://192.168.1.20:5000',
    de: 'Adresse nicht verstanden, z. B. http://192.168.1.20:5000',
    es: 'Dirección no válida, p. ej. http://192.168.1.20:5000',
  },
};

// One short explanation per error kind (src/libretranslate/client.js).
// `{detail}` is what the server named: a language code, a limit.
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'no answer: check the address and that the server runs',
    fr: "pas de réponse : vérifiez l'adresse et que le serveur tourne",
    de: 'keine Antwort: Prüfe die Adresse und ob der Server läuft',
    es: 'sin respuesta: compruebe la dirección y que el servidor esté en marcha',
  },
  [ERROR_KINDS.TIMEOUT]: {
    en: 'no answer in time',
    fr: 'pas de réponse à temps',
    de: 'keine Antwort in der Zeit',
    es: 'sin respuesta a tiempo',
  },
  [ERROR_KINDS.KEY_REQUIRED]: {
    en: 'this server requires an API key: enter it in the configuration',
    fr: "ce serveur exige une clé d'API : saisissez-la dans la configuration",
    de: 'dieser Server verlangt einen API-Schlüssel: Gib ihn in der Konfiguration ein',
    es: 'este servidor exige una clave de API: introdúzcala en la configuración',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API key refused by the server: check it',
    fr: "clé d'API refusée par le serveur : vérifiez-la",
    de: 'API-Schlüssel vom Server abgelehnt: Prüfe ihn',
    es: 'clave de API rechazada por el servidor: compruébela',
  },
  [ERROR_KINDS.RATE_LIMIT]: {
    en: 'too many requests for this server or this key: try again later',
    fr: 'trop de requêtes pour ce serveur ou cette clé : réessayez plus tard',
    de: 'zu viele Anfragen für diesen Server oder Schlüssel: Versuche es später erneut',
    es: 'demasiadas solicitudes para este servidor o esta clave: inténtelo más tarde',
  },
  [ERROR_KINDS.NOT_LIBRETRANSLATE]: {
    en: 'no LibreTranslate server at this address',
    fr: 'aucun serveur LibreTranslate à cette adresse',
    de: 'kein LibreTranslate-Server unter dieser Adresse',
    es: 'no hay ningún servidor LibreTranslate en esta dirección',
  },
  [ERROR_KINDS.UNSUPPORTED_LANGUAGE]: {
    en: 'language {detail} not loaded on the server (see --load-only)',
    fr: 'langue {detail} non chargée sur le serveur (voir --load-only)',
    de: 'Sprache {detail} ist auf dem Server nicht geladen (siehe --load-only)',
    es: 'idioma {detail} no cargado en el servidor (vea --load-only)',
  },
  [ERROR_KINDS.TOO_LONG]: {
    en: 'text longer than the server limit ({detail} characters)',
    fr: 'texte plus long que la limite du serveur ({detail} caractères)',
    de: 'Text länger als die Grenze des Servers ({detail} Zeichen)',
    es: 'texto más largo que el límite del servidor ({detail} caracteres)',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'request refused, see the logs',
    fr: 'requête refusée, voir les logs',
    de: 'Anfrage abgelehnt, sieh in den Protokollen nach',
    es: 'solicitud rechazada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (version) => (version ? `LibreTranslate ${version} answers.` : 'LibreTranslate answers.'),
    languages: (count) => `${count} language(s)`,
    tested: (seconds) => `Test translation in ${seconds} s.`,
    none: 'No language loaded on the server.',
  },
  fr: {
    ok: (version) => (version ? `LibreTranslate ${version} répond.` : 'LibreTranslate répond.'),
    languages: (count) => `${count} langue(s)`,
    tested: (seconds) => `Traduction de test en ${seconds} s.`,
    none: 'Aucune langue chargée sur le serveur.',
  },
  de: {
    ok: (version) =>
      version ? `LibreTranslate ${version} antwortet.` : 'LibreTranslate antwortet.',
    languages: (count) => `${count} Sprache(n)`,
    tested: (seconds) => `Testübersetzung in ${seconds} s.`,
    none: 'Keine Sprache auf dem Server geladen.',
  },
  es: {
    ok: (version) => (version ? `LibreTranslate ${version} responde.` : 'LibreTranslate responde.'),
    languages: (count) => `${count} idioma(s)`,
    tested: (seconds) => `Traducción de prueba en ${seconds} s.`,
    none: 'Ningún idioma cargado en el servidor.',
  },
};

// Errors of the scene actions (shown in Gladys).
export const ACTION_TEXT = {
  noText: {
    en: 'The text is empty.',
    fr: 'Le texte est vide.',
    de: 'Der Text ist leer.',
    es: 'El texto está vacío.',
  },
  tooLong: {
    en: 'The text is longer than 10,000 characters.',
    fr: 'Le texte dépasse 10 000 caractères.',
    de: 'Der Text ist länger als 10.000 Zeichen.',
    es: 'El texto supera los 10.000 caracteres.',
  },
  noTarget: {
    en: 'Choose the language to translate into.',
    fr: 'Choisissez la langue de traduction.',
    de: 'Wähle die Zielsprache.',
    es: 'Elija el idioma de destino.',
  },
  emptyTranslation: {
    en: 'LibreTranslate returned an empty translation.',
    fr: 'LibreTranslate a renvoyé une traduction vide.',
    de: 'LibreTranslate hat eine leere Übersetzung geliefert.',
    es: 'LibreTranslate ha devuelto una traducción vacía.',
  },
  notDetected: {
    en: 'LibreTranslate could not tell the language of this text.',
    fr: 'LibreTranslate n’a pas reconnu la langue de ce texte.',
    de: 'LibreTranslate hat die Sprache dieses Textes nicht erkannt.',
    es: 'LibreTranslate no ha reconocido el idioma de este texto.',
  },
};

export const LANGUAGE_FALLBACK = 'en';

/** "Name: text", with the space French puts before a colon. */
export const labelled = (name, text, language) =>
  `${name}${language === 'fr' ? ' : ' : ': '}${text}`;
export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];

/** The text of an error kind, with what the server named in it. */
export const errorText = (kind, detail = '') =>
  Object.fromEntries(
    Object.entries(ERROR_TEXT[kind] ?? ERROR_TEXT[ERROR_KINDS.HTTP]).map(([lang, text]) => [
      lang,
      text.replace('{detail}', detail),
    ]),
  );

/** "LibreTranslate: <error>" in the four languages. */
export const prefixed = (text) =>
  Object.fromEntries(
    Object.entries(text).map(([lang, value]) => [lang, labelled('LibreTranslate', value, lang)]),
  );
