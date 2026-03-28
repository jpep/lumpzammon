// Old-style casino theme: black, white, red, gold (default)
const defaultTheme = {
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

// Sepia theme for user "jugo" — warm browns, tans, parchment tones
const sepiaTheme = {
  bg: '#2b1d0e',
  bgPanel: '#3a2a17',
  bgBoard: '#6b4f2e',
  bgBar: '#2b1d0e',
  bgBearoff: '#2b1d0e',
  bgBearoffActive: '#4a3520',

  border: '#c9a96e',
  borderBoard: '#3a2a17',
  borderBtn: '#8b6914',

  text: '#f5e6c8',
  textSecondary: '#c9a96e',
  textMuted: '#7a6a52',
  textHighlight: '#f0d080',
  textYou: '#d4843a',

  btnBg: '#8b6914',
  btnText: '#f5e6c8',
  btnBgDanger: '#5a3e0a',
  btnOutlineBorder: '#c9a96e',
  btnOutlineText: '#c9a96e',

  accent: '#d4843a',
  gold: '#c9a96e',
  goldBright: '#f0d080',

  checkerWhite: ['#f5e6c8', '#c9a96e'],
  checkerBlack: ['#3a2a17', '#5a4a32'],

  triangleDark: '#7a5a30',
  triangleLight: '#c9a96e',

  diceBg: '#f5e6c8',
  diceDot: '#2b1d0e',
  diceUsedBg: '#5a4a32',
  diceUsedDot: '#3a2a17',
};

// Marine theme for user "pepo" — deep blues, teals, ocean tones
const marineTheme = {
  bg: '#0a1628',
  bgPanel: '#132238',
  bgBoard: '#1a4a5a',
  bgBar: '#0e1a2e',
  bgBearoff: '#0e1a2e',
  bgBearoffActive: '#1a2a4a',

  border: '#4a9ab5',
  borderBoard: '#1a2a3a',
  borderBtn: '#1a6a8a',

  text: '#e0f0ff',
  textSecondary: '#4a9ab5',
  textMuted: '#4a6a7a',
  textHighlight: '#70d0f0',
  textYou: '#3aaa7a',

  btnBg: '#1a6a8a',
  btnText: '#e0f0ff',
  btnBgDanger: '#1a3a5a',
  btnOutlineBorder: '#4a9ab5',
  btnOutlineText: '#4a9ab5',

  accent: '#3aaa7a',
  gold: '#4a9ab5',
  goldBright: '#70d0f0',

  checkerWhite: ['#e0f0ff', '#7abace'],
  checkerBlack: ['#132238', '#2a4a5a'],

  triangleDark: '#1a4a6a',
  triangleLight: '#4a9ab5',

  diceBg: '#e0f0ff',
  diceDot: '#0a1628',
  diceUsedBg: '#2a4a5a',
  diceUsedDot: '#1a2a3a',
};

// Rainbow theme for user "simon" — vibrant rainbow colors, stars ✦ and flowers ✿
const rainbowTheme = {
  bg: '#1a0a2e',             // deep purple night sky
  bgPanel: '#2a1248',        // dark violet panel
  bgBoard: '#3b1f6e',        // rich purple board
  bgBar: '#1a0a2e',          // matches page bg
  bgBearoff: '#1a0a2e',
  bgBearoffActive: '#4a2080',

  border: '#ff6ec7',          // hot pink border
  borderBoard: '#6a3d9a',     // purple board frame
  borderBtn: '#ff4da6',       // pink button border

  text: '#ffffff',             // white text
  textSecondary: '#ffda44',    // sunny yellow
  textMuted: '#8866aa',        // muted lavender
  textHighlight: '#00ffaa',    // bright mint green — active player
  textYou: '#ff6ec7',         // hot pink — (you!)

  btnBg: '#e63caa',           // vivid magenta
  btnText: '#ffffff',
  btnBgDanger: '#aa1470',     // deep magenta
  btnOutlineBorder: '#ff6ec7',
  btnOutlineText: '#ffda44',

  accent: '#ff6ec7',          // hot pink accent
  gold: '#ffda44',            // sunny yellow (replaces gold)
  goldBright: '#00ffaa',      // bright mint

  checkerWhite: ['#ff6ec7', '#ff4da6'],   // pink checker
  checkerBlack: ['#6a3d9a', '#4a2080'],   // purple checker

  triangleDark: '#e63caa',    // magenta triangles
  triangleLight: '#44bbff',   // sky blue triangles

  diceBg: '#ffda44',          // yellow dice
  diceDot: '#1a0a2e',         // deep purple dots
  diceUsedBg: '#4a2080',
  diceUsedDot: '#2a1248',

  // Special decorations flag — components can check for this
  decorations: 'rainbow',
};

// Returns the theme matching the given nickname
export function getTheme(nick) {
  const name = (nick || '').trim().toLowerCase();
  if (name === 'jugo') return sepiaTheme;
  if (name === 'pepo') return marineTheme;
  if (name === 'simon') return rainbowTheme;
  return defaultTheme;
}

export default defaultTheme;
