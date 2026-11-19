# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-19

### Added

- Scene action **LibreTranslate: translate a text**: a text with scene
  variables, a target language, a source language or automatic detection; the
  translation and the source language go to the next actions (a message, a
  spoken text).
- Scene action **LibreTranslate: detect the language**: the code, the name and
  the confidence, among the languages the server loaded.
- A **LibreTranslate** device: online, languages available, version, read
  every five minutes.
- A dashboard widget: the server, its languages, the translations of the last
  24 hours and the last one.
- **Test the connection**: version, languages, and a test translation that
  checks the API key.
- Optional API key, for a server started with `--api-keys` or a public
  instance. Every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-libretranslate/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-libretranslate/releases/tag/v1.0.0
