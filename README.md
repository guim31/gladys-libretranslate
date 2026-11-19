# LibreTranslate for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that
brings [LibreTranslate](https://libretranslate.com), the free and open source
machine translation server you host yourself, to Gladys scenes: translate a
text with scene information in it, and hand the translation to the next
actions (a message, a speaker). It also detects the language of a text and
follows the server. Everything stays on the local network: no cloud, no
account, no quota. It is the local alternative to the
[DeepL integration](https://github.com/LM1LC3N7/gladys-deepl).

## Features

- **Scene action _LibreTranslate: translate a text_**: a text (with scene
  variables), a target language, and a source language or automatic
  detection. The outputs **Translation** and **Source language (code)** are
  available to the following actions.
- **Scene action _LibreTranslate: detect the language_**: the outputs
  **Language (code)**, **Language (name)** and **Confidence (%)**.
- **One device "LibreTranslate"**: online, languages available, version.
- **Dashboard widget** "LibreTranslate": the server and its version, the
  number of languages and their names, the translations
  of the last 24 hours and the last one (a setting hides each optional block).
- A **Test the connection** button that shows the version and the languages,
  then translates one word to check the API key; a connection status that says
  what is wrong (no answer, key required, key refused, language not loaded…);
  a transport badge (local or unreachable).
- Failures show in red in Gladys with their reason; every text in English,
  French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets, scene actions, action outputs).
- A **LibreTranslate** server reachable from Gladys, e.g.
  `docker run -d -p 5000:5000 libretranslate/libretranslate --load-only en,fr,de,es`
  (about 2 GB of RAM for four languages), or a public instance with an API
  key.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository:
   `https://github.com/guim31/gladys-libretranslate` (or install
   **LibreTranslate** from the catalog once it is listed).
2. In **Configuration**, enter the address of the server (`192.168.1.20`,
   port 5000 added; `host:port`; or the URL of a reverse proxy) and the API key
   if the server requires one, then press **Test the connection**.
3. Optionally, in the **Discovery** tab, add the **LibreTranslate** device.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

- Every five minutes the server is read with `GET /languages` (the languages
  it loaded) and `GET /spec` (its version, in the OpenAPI description). The
  device is published with `should_poll: false`: the container reads the
  server on its own timer, five minutes being beyond the list of the Gladys
  scheduler. Only the values that changed are sent, all of them again when the
  device is added, and every 12 hours.
- A translation is `POST /translate` (`format: text`, `source: auto` when no
  source is chosen), a detection `POST /detect`; the API key travels in the
  body, as LibreTranslate expects it. The scene action selects list the 50
  languages of the Argos Translate index; `pt-BR`, `zh-Hans` and `zh-Hant` are
  sent as `pb`, `zh` and `zt` to a server older than 1.6 that lists them so.
- The server is "offline" after two failed readings in a row (the second 15 s
  after the first), counting only silence: a refused key or a wrong address is
  a configuration problem, shown in the connection status.
- Nothing is stored under `/data`. The texts and their translations never
  reach the logs (only the languages, the time and the lengths); the API key
  neither.

## Checked on a real LibreTranslate

On 16/11/2026 the integration was checked against a real LibreTranslate 1.9.6
(`libretranslate/libretranslate` in Docker, `--load-only en,fr,de,es`), open
and with `--api-keys`: translations fr↔en↔de↔es, automatic detection, a
language not loaded, a missing key, a wrong key, a valid key, the server
stopped. Its answers are the fixtures of the tests
(`test/fixtures/libretranslate/`). The Docker image of the integration was run
with the Gladys sandbox constraints (read-only root, all capabilities dropped,
256 MB, bridge network) against that server. Not checked: the widget and the
scene editor in a real Gladys, and a public instance with a paid key.

## Limitations

- One server per Gladys.
- Text only, up to 10,000 characters per action (Gladys caps an output there).
- Machine translation: fine for notifications, less for long or subtle texts;
  detection is unreliable on one or two words.
- Names ending in `.local` do not resolve inside the integration container:
  use IP addresses or names your DNS resolves.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and a fake LibreTranslate (`test/helpers/fakeLibreTranslate.js`) built on
answers recorded from a real server. See [`CLAUDE.md`](CLAUDE.md) for the
project rules.

## Credits

- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)
  (AGPL-3.0): the API, and the logo on the cover
  (`libretranslate/static/icon.svg` of its repository), on its blue
  `#1565c0`. LibreTranslate translates with
  [Argos Translate](https://github.com/argosopentech/argos-translate) (MIT).
- [gladys-deepl](https://github.com/LM1LC3N7/gladys-deepl): the shape of the
  translation scene action and of its outputs.
- The architecture and the conformity tests follow
  [gladys-ollama](https://github.com/guim31/gladys-ollama) and
  [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by LibreTranslate.
"LibreTranslate" and its logo belong to their owners.

## License

Apache-2.0
