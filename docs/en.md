# LibreTranslate

[LibreTranslate](https://libretranslate.com) is a free and open source machine translation
server that you run yourself. This integration lets your Gladys scenes translate a text, with
scene information in it, and use the translation in the next actions: send it as a message, have
it read aloud. It can also tell the language of a text. Everything stays on your network: no
account, no cloud, no quota.

It is the local alternative to the DeepL integration. It also follows the server: online or not,
its version, the number of languages it loaded, with a dashboard widget.

Not affiliated with LibreTranslate. Tested against a real LibreTranslate 1.9.6 server.

## What you need

- Gladys 5.1 or later.
- A LibreTranslate server on your network. With Docker:
  `docker run -d -p 5000:5000 libretranslate/libretranslate --load-only en,fr,de,es`.
  `--load-only` keeps only the languages you need: each pair of languages is a model to
  download and to hold in memory (count about 2 GB of RAM for four languages).
- Or a public instance that gives you an API key (libretranslate.com is a paid service).

## Set up

1. In Gladys, open **Integrations**, find **LibreTranslate** and install it.
2. In **Configuration**, fill in:
   - **Server address**: the IP address or name of the server, e.g. `192.168.1.20` (port 5000
     is added), `192.168.1.20:5001`, or the full URL of a reverse proxy;
   - **API key (optional)**: only when the server requires one (started with `--api-keys`, or a
     public instance);
   - **Language of the names**: the language of the feature names and of the language name given
     by detection.
3. Click **Test the connection**: it shows the version and the languages of the server, then
   translates one word to check the key.
4. In **Discovery**, add the **LibreTranslate** device if you want its states in Gladys
   (optional: the scene actions work without it).

## The LibreTranslate device

The server is read every five minutes:

- **Online**: yes when the server answers; no after two failed readings in a row, 15 seconds
  apart.
- **Languages available**: the number of languages the server loaded.
- **Version**: the version of LibreTranslate.

## Dashboard

The **LibreTranslate** widget shows the number of languages, the translations of the last 24
hours, the state of the server, the last translation (languages and time) and the list of
languages. A setting hides the list.

## Scenes

### Actions

- **LibreTranslate: translate a text**:
  - **Text to translate**: type `{{` to insert scene information, e.g. a value of the trigger
    or the message received;
  - **Into**: the language of the translation;
  - **From**: empty to let the server detect it.

  Its results are available to the following actions: **Translation** (`{{0.1.translation}}`
  for the first action of the second row) and **Source language (code)**
  (`{{0.1.source_language}}`, e.g. `fr`). In a **Send Message** action, type `{{` and pick
  **Translation**.

- **LibreTranslate: detect the language**: tells the language of a **Text**, among the ones the
  server loaded. Results: **Language (code)** (`{{0.1.language}}`, e.g. `de`), **Language
  (name)** (`{{0.1.language_name}}`, in the language of the configuration) and **Confidence
  (%)** (`{{0.1.confidence}}`).

When an action fails (server offline, language not loaded, key refused, empty text), Gladys
shows the reason in red, the action gives no result and the scene goes on.

### Scene ideas

- **Messages for a guest**: when a guest mode is on, translate the notifications into their
  language before sending them.
- **Spoken alerts in two languages**: translate "The washing machine has finished." and read
  both versions on a speaker.
- **Reply in the right language**: detect the language of a received message, then translate
  the answer into it.

## Troubleshooting

- **"no answer"**: check the address and the port (5000), that the server
  is started, and with Docker that the port is published. The first start downloads the
  models: it can take several minutes.
- **"language … not loaded on the server"**: the server was started with `--load-only` without
  this language. Add it and restart the server.
- **"this server requires an API key"** / **"API key refused"**: enter the key in the
  configuration, or create one with `ltmanage keys add` on the server.
- **"too many requests"**: the server limits the requests (`--req-limit`, or the plan of a
  public instance).
- Problems and ideas:
  [GitHub issues](https://github.com/guim31/gladys-libretranslate/issues).

## Limits

- Machine translation: good for short notifications, less for long or subtle texts.
- Text only, up to 10,000 characters per action (what Gladys gives back to a scene).
- Detection is reliable on a sentence, much less on one or two words.
- The texts and their translations never go to the integration logs.
