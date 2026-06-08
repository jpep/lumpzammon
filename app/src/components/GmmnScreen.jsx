// The unified GMMN screen shell (Phase 8.5c-2): the fond photo as a full-screen
// backdrop with a dark veil for contrast, content centred on top. Ties the
// menu/lobby to the same look as the canvas board. The per-nick palette tints
// the content (buttons/title) via useTheme in the consuming screens.

import React, { useEffect } from 'react';
import { ensureNortechico, GMMN_FOND } from '../ui/gmmn';

export default function GmmnScreen({ children }) {
  useEffect(() => { ensureNortechico(); }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${GMMN_FOND})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'rgba(0,0,0,0.62)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 16,
      }}>
        {children}
      </div>
    </div>
  );
}
