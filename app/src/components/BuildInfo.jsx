import React, { useState } from 'react';

export default function BuildInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 8,
          left: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#2c1810',
          border: '1px solid #8b4513',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 50,
          color: '#d4a574',
          fontSize: 16,
          fontFamily: 'serif',
          fontStyle: 'italic',
          fontWeight: 'bold',
        }}
        title="Build info"
      >
        i
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            bottom: 42,
            left: 8,
            background: '#2c1810',
            border: '1px solid #8b4513',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#f5f5dc',
            fontSize: 12,
            lineHeight: 1.6,
            zIndex: 50,
            maxWidth: 320,
            fontFamily: 'monospace',
          }}
        >
          <div><strong>commit:</strong> {__BUILD_COMMIT__}</div>
          <div><strong>message:</strong> {__BUILD_MESSAGE__}</div>
          <div><strong>author:</strong> {__BUILD_AUTHOR__}</div>
          <div><strong>date:</strong> {__BUILD_DATE__}</div>
        </div>
      )}
    </>
  );
}
