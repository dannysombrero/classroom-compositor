// src/pages/ThemePlaygroundSimple.tsx
// Simplified version for debugging

import { useState } from 'react';
import { theme, type PaletteName, type FontName } from '../theme';

export default function ThemePlaygroundSimple() {
  const [activePalette, setActivePalette] = useState<PaletteName>(theme.getActivePaletteName());
  const [activeFont, setActiveFont] = useState<FontName>(theme.getActiveFontName());

  const handlePaletteChange = (paletteName: PaletteName) => {
    console.log('Changing palette to:', paletteName);
    theme.setActivePalette(paletteName);
    setActivePalette(paletteName);
  };

  const handleFontChange = (fontName: FontName) => {
    console.log('Changing font to:', fontName);
    theme.setActiveFont(fontName);
    setActiveFont(fontName);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-background)',
      color: 'var(--color-text)',
      padding: '2rem',
      fontFamily: 'var(--font-family)',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', fontFamily: 'var(--font-family)' }}>Theme Playground (Simple)</h1>
      
      <div style={{ 
        padding: '1rem', 
        background: 'var(--color-surface)', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '2px solid var(--color-primary)',
        fontFamily: 'var(--font-family)',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontFamily: 'var(--font-family)' }}>
          🔍 <strong>Debug Info:</strong> Current font = <code style={{ 
            background: 'var(--color-background)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>{activeFont}</code>
        </p>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Color Palettes</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handlePaletteChange('warmEducator')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activePalette === 'warmEducator' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activePalette === 'warmEducator' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activePalette === 'warmEducator' ? 'var(--color-primary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: activePalette === 'warmEducator' ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            🟣 Warm Educator
          </button>
          <button
            onClick={() => handlePaletteChange('freshModern')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activePalette === 'freshModern' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activePalette === 'freshModern' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activePalette === 'freshModern' ? 'var(--color-primary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: activePalette === 'freshModern' ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            🟢 Fresh Modern
          </button>
          <button
            onClick={() => handlePaletteChange('playfulClassroom')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activePalette === 'playfulClassroom' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activePalette === 'playfulClassroom' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activePalette === 'playfulClassroom' ? 'var(--color-primary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: activePalette === 'playfulClassroom' ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            🔵 Playful Classroom
          </button>
          <button
            onClick={() => handlePaletteChange('midnightScholar')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activePalette === 'midnightScholar' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activePalette === 'midnightScholar' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activePalette === 'midnightScholar' ? 'var(--color-primary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: activePalette === 'midnightScholar' ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            🌙 Midnight Scholar
          </button>
          <button
            onClick={() => handlePaletteChange('forestAcademy')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activePalette === 'forestAcademy' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activePalette === 'forestAcademy' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activePalette === 'forestAcademy' ? 'var(--color-primary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: activePalette === 'forestAcademy' ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            🌲 Forest Academy
          </button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
          Click any palette to see colors change instantly below ⬇️
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontFamily: 'var(--font-family)' }}>Fonts</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleFontChange('dmSans')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activeFont === 'dmSans' ? 'var(--color-secondary)' : 'var(--color-surface)',
              color: activeFont === 'dmSans' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activeFont === 'dmSans' ? 'var(--color-secondary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: activeFont === 'dmSans' ? 600 : 400,
            }}
          >
            DM Sans
          </button>
          <button
            onClick={() => handleFontChange('plusJakartaSans')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activeFont === 'plusJakartaSans' ? 'var(--color-secondary)' : 'var(--color-surface)',
              color: activeFont === 'plusJakartaSans' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activeFont === 'plusJakartaSans' ? 'var(--color-secondary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: activeFont === 'plusJakartaSans' ? 600 : 400,
            }}
          >
            Plus Jakarta Sans
          </button>
          <button
            onClick={() => handleFontChange('inter')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activeFont === 'inter' ? 'var(--color-secondary)' : 'var(--color-surface)',
              color: activeFont === 'inter' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activeFont === 'inter' ? 'var(--color-secondary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: '"Inter", sans-serif',
              fontWeight: activeFont === 'inter' ? 600 : 400,
            }}
          >
            Inter
          </button>
          <button
            onClick={() => handleFontChange('comicSans')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activeFont === 'comicSans' ? 'var(--color-secondary)' : 'var(--color-surface)',
              color: activeFont === 'comicSans' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activeFont === 'comicSans' ? 'var(--color-secondary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: '"Comic Sans MS", cursive',
              fontWeight: activeFont === 'comicSans' ? 600 : 400,
            }}
          >
            🎪 Comic Sans (TEST)
          </button>
          <button
            onClick={() => handleFontChange('courier')}
            style={{
              padding: '0.875rem 1.25rem',
              background: activeFont === 'courier' ? 'var(--color-secondary)' : 'var(--color-surface)',
              color: activeFont === 'courier' ? 'white' : 'var(--color-text)',
              border: '2px solid ' + (activeFont === 'courier' ? 'var(--color-secondary)' : 'var(--color-border)'),
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: '"Courier New", monospace',
              fontWeight: activeFont === 'courier' ? 600 : 400,
            }}
          >
            ⌨️ Courier (TEST)
          </button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1rem', fontFamily: 'var(--font-family)' }}>
          Click any font to see the text below change ⬇️
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontFamily: 'var(--font-family)' }}>Sample Text</h2>
        <div style={{ 
          padding: '1.5rem', 
          background: 'var(--color-surface)', 
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: '1.5rem', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-family)', fontWeight: 600 }}>
            The quick brown fox jumps over the lazy dog.
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.6, marginTop: '1rem', fontFamily: 'var(--font-family)' }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.6, marginTop: '0.5rem', fontFamily: 'var(--font-family)' }}>
            abcdefghijklmnopqrstuvwxyz
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.6, marginTop: '0.5rem', fontFamily: 'var(--font-family)' }}>
            0123456789 !@#$%^&*()
          </p>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1rem', fontFamily: 'var(--font-family)' }}>
          👆 This text uses: <strong style={{ fontFamily: 'var(--font-family)' }}>{activeFont}</strong> font
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Color Swatches</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', background: 'var(--color-primary)', borderRadius: '8px' }} />
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Primary</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', background: 'var(--color-secondary)', borderRadius: '8px' }} />
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Secondary</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', background: 'var(--color-success)', borderRadius: '8px' }} />
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Success</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', background: 'var(--color-danger)', borderRadius: '8px' }} />
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Danger</p>
          </div>
        </div>
      </div>
    </div>
  );
}