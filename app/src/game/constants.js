// Shared constants — single source of truth so they can't drift across files.

// Player identities, re-exported from the rules engine.
export { P1, P2 } from './logic';

// Storage key prefixes (localStorage + Realtime DB). These were duplicated as
// string literals across the online/lobby/session/persistence code; centralize
// them here. Prefixes keep their trailing ':' so they work both for range
// listing (sList('bg:lobby:')) and for `${KEY}${id}` interpolation.
export const KEY_MATCH = 'bg:match:';
export const KEY_LOBBY = 'bg:lobby:';
export const KEY_SESSION = 'bg:session:';
export const KEY_LOCAL_GAME = 'bg:localGame:';
export const KEY_NICK = 'bg:nick';
