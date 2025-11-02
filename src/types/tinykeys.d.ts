declare module 'tinykeys' {
  export {
    tinykeys,
    createKeybindingsHandler,
    matchKeyBindingPress,
    parseKeybinding,
  } from 'tinykeys/dist/tinykeys';

  export type {
    KeyBindingMap,
    KeyBindingPress,
    KeyBindingHandlerOptions,
    KeyBindingOptions,
  } from 'tinykeys/dist/tinykeys';
}
