// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// "Translate" hands the translation to the next actions as an output
// (`{{<column>.<row>.translation}}`): the scene then sends it by message or
// reads it aloud with the core's own actions. "Detect the language" gives the
// language code of a text (a received message), for a condition or a
// translation that follows.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  async translate(hub, { fields = {} }) {
    return hub.translate({ text: fields.text, target: fields.target, source: fields.source });
  },

  async detect_language(hub, { fields = {} }) {
    return hub.detect(fields.text);
  },
};
