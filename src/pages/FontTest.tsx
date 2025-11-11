// src/pages/FontTest.tsx
// Direct font test without theme system

import { useState, useEffect } from 'react';

export default function FontTest() {
  const [currentFont, setCurrentFont] = useState('DM Sans');
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Check if fonts are loaded
    if (document.fonts) {
      document.fonts.ready.then(() => {
        console.log('✅ All fonts loaded');
        setFontsLoaded(true);
        document.fonts.forEach((font) => {
          console.log('📝 Loaded font:', font.family);
        });
      });
    }
  }, []);

  const fonts = [
    { name: 'DM Sans', family: '"DM Sans", sans-serif' },
    { name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif' },
    { name: 'Inter', family: '"Inter", sans-serif' },
    { name: 'Comic Sans', family: '"Comic Sans MS", cursive' },
    { name: 'Courier', family: '"Courier New", monospace' },
    { name: 'Arial', family: 'Arial, sans-serif' },
    { name: 'Times', family: '"Times New Roman", serif' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      color: '#e5e7eb',
      padding: '2rem',
    }}>
      <h1 style={{ marginBottom: '1rem' }}>Font Loading Test</h1>
      
      <div style={{ 
        padding: '1rem', 
        background: fontsLoaded ? '#10b981' : '#ef4444',
        color: 'white',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        {fontsLoaded ? '✅ Fonts loaded successfully' : '⏳ Loading fonts...'}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Select Font:</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {fonts.map((font) => (
            <button
              key={font.name}
              onClick={() => setCurrentFont(font.name)}
              style={{
                padding: '0.75rem 1rem',
                background: currentFont === font.name ? '#8b5cf6' : '#1a1d29',
                color: 'white',
                border: '2px solid ' + (currentFont === font.name ? '#8b5cf6' : '#333'),
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: font.family,
                fontSize: '0.9rem',
              }}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ 
        padding: '2rem', 
        background: '#1a1d29', 
        borderRadius: '12px',
        border: '2px solid #8b5cf6',
      }}>
        <h3 style={{ marginBottom: '1rem' }}>
          Current Font: <span style={{ color: '#8b5cf6' }}>{currentFont}</span>
        </h3>
        
        {fonts.map((font) => (
          <div 
            key={font.name}
            style={{ 
              marginBottom: '1.5rem',
              padding: '1rem',
              background: currentFont === font.name ? '#2a2e3a' : 'transparent',
              borderRadius: '8px',
              border: currentFont === font.name ? '2px solid #8b5cf6' : '1px solid #333',
            }}
          >
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#9ca3af', 
              marginBottom: '0.5rem',
              fontFamily: 'monospace'
            }}>
              {font.family}
            </div>
            <p style={{ 
              fontSize: '1.5rem', 
              margin: 0,
              fontFamily: font.family,
              lineHeight: 1.6,
            }}>
              The quick brown fox jumps over the lazy dog
            </p>
            <p style={{ 
              fontSize: '1.25rem', 
              margin: '0.5rem 0 0 0',
              fontFamily: font.family,
            }}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1d29', borderRadius: '8px' }}>
        <h3>Debug Info:</h3>
        <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
          {JSON.stringify({
            fontsLoaded,
            currentFont,
            availableFonts: fonts.map(f => f.name),
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}