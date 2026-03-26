// Old-style casino theme: black, white, red, gold
const theme = {
  // Backgrounds
  bg: '#0a0a0a',           // page background — near black
  bgPanel: '#1a1a1a',      // panels, modals, inputs
  bgBoard: '#346934',      // board felt — deep casino green
  bgBar: '#111',            // bar zone
  bgBearoff: '#111',        // bear-off zone
  bgBearoffActive: '#2a0a0a', // bear-off when highlighted

  // Borders
  border: '#b8860b',        // gold — primary borders
  borderBoard: '#222',      // board frame
  borderBtn: '#8b0000',     // dark red button borders

  // Text
  text: '#ffffff',          // primary text — white
  textSecondary: '#d4af37', // gold — secondary labels
  textMuted: '#666',        // muted/disabled text
  textHighlight: '#ffd700', // bright gold — active player, actions
  textYou: '#cc0000',       // red — (you!) tag

  // Buttons
  btnBg: '#8b0000',         // dark red
  btnText: '#ffffff',
  btnBgDanger: '#4a0000',   // darker red for destructive
  btnOutlineBorder: '#b8860b', // gold outline
  btnOutlineText: '#d4af37',

  // Accents
  accent: '#cc0000',        // red accent
  gold: '#d4af37',          // gold
  goldBright: '#ffd700',    // bright gold

  // Checkers
  checkerWhite: ['#f0f0f0', '#999'],      // [fill, border]
  checkerBlack: ['#1a1a1a', '#444'],

  // Board triangles
  triangleDark: '#873232',  // dark red
  triangleLight: '#dec46e', // gold

  // Dice
  diceBg: '#ffffff',
  diceDot: '#0a0a0a',
  diceUsedBg: '#444',
  diceUsedDot: '#222',
};

export default theme;
