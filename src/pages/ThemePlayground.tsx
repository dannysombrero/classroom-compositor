// src/pages/ThemePlayground.tsx

import { useState, useEffect } from 'react';
import {
  theme,
  palettes,
  fonts,
  type PaletteName,
  type FontName,
} from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function ThemePlayground() {
  const [activePalette, setActivePalette] = useState<PaletteName>(theme.getActivePaletteName());
  const [activeFont, setActiveFont] = useState<FontName>(theme.getActiveFontName());
  const [, forceUpdate] = useState({});

  const handlePaletteChange = (paletteName: PaletteName) => {
    theme.setActivePalette(paletteName);
    setActivePalette(paletteName);
    // Force re-render to apply new colors
    forceUpdate({});
  };

  const handleFontChange = (fontName: FontName) => {
    console.log('Changing font to:', fontName);
    theme.setActiveFont(fontName);
    setActiveFont(fontName);
    // Force re-render to apply new font
    forceUpdate({});
    console.log('Font family variable:', getComputedStyle(document.documentElement).getPropertyValue('--font-family'));
  };

  useEffect(() => {
    console.log('Theme Playground mounted');
    console.log('Active palette:', theme.getActivePaletteName());
    console.log('Active font:', theme.getActiveFontName());
    console.log('Font family from CSS:', getComputedStyle(document.documentElement).getPropertyValue('--font-family'));
  }, []);

  return (
    <div
      key={`${activePalette}-${activeFont}`}
      style={{
        minHeight: '100vh',
        background: 'var(--color-background)',
        color: 'var(--color-text)',
        padding: '2rem',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            🎨 Theme Playground
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem' }}>
            Experiment with different color palettes and fonts for your educator-friendly design
          </p>
        </div>

        {/* Theme Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>Choose your app's color scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {Object.entries(palettes).map(([key, palette]) => (
                  <button
                    key={key}
                    onClick={() => handlePaletteChange(key as PaletteName)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: activePalette === key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: activePalette === key ? 'var(--color-surface-active)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{palette.name}</span>
                      {activePalette === key && <Badge variant="primary">Active</Badge>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', background: palette.primary }} />
                      <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', background: palette.secondary }} />
                      <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-sm)', background: palette.success }} />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Select your preferred font</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(fonts).map(([key, font]) => (
                  <button
                    key={key}
                    onClick={() => handleFontChange(key as FontName)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: activeFont === key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: activeFont === key ? 'var(--color-surface-active)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      fontFamily: font.fontFamily,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{font.name}</span>
                      {activeFont === key && <Badge variant="primary">Active</Badge>}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Component Showcase */}
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>All button variants with current theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="success">Success Button</Button>
                <Button variant="danger">Danger Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Button variant="primary" disabled>Disabled Button</Button>
              </div>
            </CardContent>
          </Card>

          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Form inputs with theme styling</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gap: '1rem', maxWidth: '500px' }}>
                <Input placeholder="Normal input" />
                <Input placeholder="Disabled input" disabled />
                <Input placeholder="Error input" error />
                <Input type="email" placeholder="Email input" />
                <Input type="password" placeholder="Password input" />
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Small indicators and labels</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="neutral">Neutral</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Color Palette Display */}
          <Card>
            <CardHeader>
              <CardTitle>Current Color Palette</CardTitle>
              <CardDescription>All colors in the active theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {Object.entries(theme.colors).filter(([key]) => !key.includes('name')).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div
                      style={{
                        height: '4rem',
                        borderRadius: 'var(--radius-md)',
                        background: value,
                        border: '1px solid var(--color-border)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Typography Scale */}
          <Card>
            <CardHeader>
              <CardTitle>Typography Scale</CardTitle>
              <CardDescription>Font sizes and weights</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: theme.typography.fontSize['4xl'], fontWeight: theme.typography.fontWeight.bold }}>
                  Heading 1 - 4xl Bold
                </div>
                <div style={{ fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.semibold }}>
                  Heading 2 - 3xl Semibold
                </div>
                <div style={{ fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.semibold }}>
                  Heading 3 - 2xl Semibold
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.medium }}>
                  Heading 4 - xl Medium
                </div>
                <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.medium }}>
                  Large Text - lg Medium
                </div>
                <div style={{ fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.normal }}>
                  Body Text - base Normal
                </div>
                <div style={{ fontSize: theme.typography.fontSize.sm, color: 'var(--color-text-muted)' }}>
                  Small Text - sm Normal
                </div>
                <div style={{ fontSize: theme.typography.fontSize.xs, color: 'var(--color-text-subtle)' }}>
                  Extra Small Text - xs Normal
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-world Example */}
          <Card>
            <CardHeader>
              <CardTitle>Real-world Example</CardTitle>
              <CardDescription>How it looks in a typical UI</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ background: 'var(--color-background)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, marginBottom: '0.25rem' }}>
                      Welcome back, Teacher! 👋
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                      Ready to start your next lesson?
                    </p>
                  </div>
                  <Badge variant="success">Live</Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Active Students</div>
                    <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>24</div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Session Time</div>
                    <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-secondary)' }}>45m</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Button variant="primary">Start Recording</Button>
                  <Button variant="outline">Share Screen</Button>
                  <Button variant="ghost">Settings</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '3rem', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '0.875rem' }}>
            💡 Tip: Changes are applied instantly. Pick your favorite combination and start building!
          </p>
        </div>
      </div>
    </div>
  );
}