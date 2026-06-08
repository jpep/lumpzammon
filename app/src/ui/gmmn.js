// Shared GMMN look-and-feel primitives (Phase 8.5c-2). The unified screen
// aesthetic: the fond photo background + the nortechico pixel font + a
// monochrome/ivory base, with the per-nick palette (useTheme) tinting accents
// (buttons, title, highlights). Used by the menu/lobby screens and the profile.

import nort100Url from '../assets/nortechico-100.otf?url';
import fond2Url from '../assets/fond2.jpg?url';

export const NORTECHICO = "'nortechico','Noto Sans',sans-serif";
export const GMMN_FOND = fond2Url;

const RAINBOW = 'linear-gradient(90deg,#ff0000,#ff8800,#ffdd00,#00cc44,#0088ff,#aa44ff,#ff44aa)';

// Register the nortechico @font-face once (idempotent, shared with CanvasBoard).
let _fontPromise = null;
export function ensureNortechico() {
  if (_fontPromise) return _fontPromise;
  _fontPromise = (async () => {
    try {
      if (![...document.fonts].some((f) => f.family === 'nortechico')) {
        const ff = new FontFace('nortechico', `url(${nort100Url})`);
        document.fonts.add(ff);
        await ff.load();
      }
      await document.fonts.load("60px 'nortechico'");
    } catch (e) { /* fall back to Noto Sans */ }
  })();
  return _fontPromise;
}

// Title style — rainbow gradient for the 'simon' easter-egg theme, else ivory/nick text.
export const gmmnTitle = (theme) => ({
  fontFamily: NORTECHICO,
  letterSpacing: 2,
  textShadow: '0 2px 12px rgba(0,0,0,0.7)',
  ...(theme.decorations === 'rainbow'
    ? { background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'rainbow-title-glow 4s linear infinite' }
    : { color: theme.textHighlight }),
});

export const gmmnDivider = (theme) => ({
  width: 120, height: 2, marginBottom: 24,
  background: theme.decorations === 'rainbow' ? RAINBOW : theme.gold,
});

export const gmmnButton = (theme) => ({
  background: theme.btnBg, color: theme.btnText, border: 'none', borderRadius: 8,
  padding: '14px 40px', fontSize: 18, cursor: 'pointer', fontWeight: 'bold',
  fontFamily: NORTECHICO, letterSpacing: 1, minWidth: 240,
  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
});

export const gmmnButtonSmall = (theme) => ({
  background: 'transparent', color: theme.btnOutlineText,
  border: `1px solid ${theme.btnOutlineBorder}`, borderRadius: 8,
  padding: '8px 24px', fontSize: 14, cursor: 'pointer', fontFamily: NORTECHICO,
});

export const gmmnInput = (theme) => ({
  background: 'rgba(0,0,0,0.45)', border: `2px solid ${theme.border}`, borderRadius: 8,
  color: theme.text, padding: '12px 16px', fontSize: 16, width: 260, outline: 'none',
  textAlign: 'center', fontFamily: NORTECHICO, letterSpacing: 1,
});
