// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `libretranslate`.
//
// The use cases: is the translation server up before a scene relies on it,
// which languages it can translate, and are the scenes translating (how many
// times today, the last pair of languages).
//
// Budget (8 components, 2 texts): two values (languages, translations of the
// last 24 hours), one status list (the server, the last translation) and one
// text with the language names; a setting hides each optional block. The figures are
// values, not bound to device features: the widget works before the device is
// added to Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './hub.js';
import { languageName } from './languages.js';
import { ERROR_KINDS } from './libretranslate/client.js';
import { pick } from './texts.js';

export const TEXT = {
  noUrl: {
    en: 'Enter the address of your LibreTranslate server in the configuration of the integration.',
    fr: "Saisissez l'adresse de votre serveur LibreTranslate dans la configuration de l'intégration.",
    de: 'Gib die Adresse deines LibreTranslate-Servers in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su servidor LibreTranslate en la configuración de la integración.',
  },
  languages: { en: 'Languages', fr: 'Langues', de: 'Sprachen', es: 'Idiomas' },
  translations: {
    en: 'Translations (24 h)',
    fr: 'Traductions (24 h)',
    de: 'Übersetzungen (24 h)',
    es: 'Traducciones (24 h)',
  },
  online: { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' },
  unreachable: { en: 'Unreachable', fr: 'Injoignable', de: 'Nicht erreichbar', es: 'Inaccesible' },
  error: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
  waiting: { en: 'Waiting…', fr: 'En attente…', de: 'Warte…', es: 'Esperando…' },
  lastTranslation: {
    en: 'Last translation',
    fr: 'Dernière traduction',
    de: 'Letzte Übersetzung',
    es: 'Última traducción',
  },
  none: { en: 'None yet', fr: 'Aucune encore', de: 'Noch keine', es: 'Ninguna aún' },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function serverRow(state, language) {
  if (state.error && (state.down || state.online === null)) {
    const unreachable = [ERROR_KINDS.UNREACHABLE, ERROR_KINDS.TIMEOUT].includes(state.error.kind);
    return {
      label: 'LibreTranslate',
      icon: 'alert-triangle',
      value: t(unreachable ? TEXT.unreachable : TEXT.error, language),
      color: WIDGET_COLORS.DANGER,
    };
  }
  if (state.online) {
    const online = t(TEXT.online, language);
    return {
      label: 'LibreTranslate',
      icon: 'globe',
      value: fit(state.version ? `${online} · ${state.version}` : online, 40),
      color: state.error ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    };
  }
  return {
    label: 'LibreTranslate',
    icon: 'clock',
    value: t(TEXT.waiting, language),
    color: WIDGET_COLORS.NEUTRAL,
  };
}

function lastRow(last, language) {
  if (!last) {
    return {
      label: t(TEXT.lastTranslation, language),
      icon: 'message-square',
      value: t(TEXT.none, language),
      color: WIDGET_COLORS.NEUTRAL,
    };
  }
  // The supervisor gives the container the time zone of Gladys (TZ).
  const time = new Date(last.at).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    label: t(TEXT.lastTranslation, language),
    icon: 'message-square',
    value: fit(`${last.source} → ${last.target} · ${time}`, 40),
    color: WIDGET_COLORS.PRIMARY,
  };
}

async function get(hub, { language = 'en', settings = {} } = {}) {
  if (!hub.client) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: t(TEXT.noUrl, language) }],
    };
  }
  const { state } = hub;
  const components = [];
  if (settings.show_counters !== false) {
    if (state.languages) {
      components.push({
        type: 'value',
        value: state.languages.length,
        label: t(TEXT.languages, language),
        icon: 'globe',
      });
    }
    components.push({
      type: 'value',
      value: hub.translationsToday(),
      label: t(TEXT.translations, language),
      icon: 'repeat',
      color: WIDGET_COLORS.PRIMARY,
    });
  }
  const items = [serverRow(state, language)];
  if (settings.show_last_translation !== false) {
    items.push(lastRow(hub.lastTranslation, language));
  }
  components.push({ type: 'status', items });
  if (settings.show_languages !== false && state.languages?.length) {
    const names = state.languages
      .map((entry) => languageName(entry.code, language))
      .sort((a, b) => a.localeCompare(b, language));
    const list = names.join(', ');
    // French and Spanish write language names in lower case.
    const text = list.charAt(0).toLocaleUpperCase(language) + list.slice(1);
    components.push({ type: 'text', variant: 'body', text: fit(text, 300) });
  }
  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get },
};
