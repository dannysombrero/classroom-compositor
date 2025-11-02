import { useMemo, type CSSProperties } from 'react';
import type { Layer } from '../types/scene';
import { useAppStore } from '../app/store';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

interface LayerPropertiesPanelProps {
  layer: Layer | null;
}

const ALIGNMENT_OPTIONS: Array<{ value: 'left' | 'center' | 'right'; label: string }> = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
];

export function LayerPropertiesPanel({ layer }: LayerPropertiesPanelProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);

  const supportsFill = layer?.type === 'shape';
  const supportsText = layer?.type === 'text';

  const textValues = useMemo(() => {
    if (layer?.type !== 'text') return null;
    return layer;
  }, [layer]);

  const backgroundAlpha = textValues ? extractAlpha(textValues.backgroundColor) : 1;

  const shapeValues = useMemo(() => {
    if (layer?.type !== 'shape') return null;
    return layer;
  }, [layer]);

  const shapeFillAlpha = shapeValues ? extractAlpha(shapeValues.fillColor) : 1;

  if (!layer) {
    return (
      <div style={panelStyle.empty}>Select a layer to edit its properties.</div>
    );
  }

  return (
    <div style={panelStyle.container}>
      <div style={panelStyle.sectionTitle}>Properties</div>
      {supportsText && textValues && (
        <div style={panelStyle.section}>
          <label style={panelStyle.label}>
            Text
            <textarea
              value={textValues.content}
              onChange={(event) => {
                updateLayer(textValues.id, { content: event.target.value });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.textarea}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Font Size</span>
            <input
              type="number"
              min={12}
              max={200}
              value={textValues.fontSize}
              onChange={(event) => {
                const next = Number(event.target.value || textValues.fontSize);
                updateLayer(textValues.id, { fontSize: next });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
            />
          </label>
          <div style={panelStyle.label}>
            <span>Alignment</span>
            <div style={panelStyle.alignmentRow}>
              {ALIGNMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    updateLayer(textValues.id, { textAlign: option.value });
                    requestCurrentStreamFrame();
                  }}
                  style={{
                    ...panelStyle.alignmentButton,
                    ...(textValues.textAlign === option.value
                      ? panelStyle.alignmentButtonActive
                      : null),
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label style={panelStyle.labelRow}>
            <span>Text Color</span>
            <input
              type="color"
              value={normalizeColor(textValues.textColor)}
              onChange={(event) => {
                updateLayer(textValues.id, { textColor: event.target.value });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.colorInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Background</span>
            <input
              type="color"
              value={normalizeColor(textValues.backgroundColor)}
              onChange={(event) => {
                const next = event.target.value;
                const { r, g, b } = hexToRgb(next);
                const rgba = `rgba(${r}, ${g}, ${b}, ${backgroundAlpha.toFixed(2)})`;
                updateLayer(textValues.id, { backgroundColor: rgba });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.colorInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Bg Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={backgroundAlpha}
              onChange={(event) => {
                const alpha = Number(event.target.value);
                const { r, g, b } = hexToRgb(normalizeColor(textValues.backgroundColor));
                const rgba = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
                updateLayer(textValues.id, { backgroundColor: rgba });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.rangeInput}
            />
          </label>
        </div>
      )}

      {supportsFill && shapeValues && (
        <div style={panelStyle.section}>
          <label style={panelStyle.labelRow}>
            <span>Fill</span>
            <input
              type="color"
              value={normalizeColor(shapeValues.fillColor)}
              onChange={(event) => {
                const next = event.target.value;
                const { r, g, b } = hexToRgb(next);
                const rgba = `rgba(${r}, ${g}, ${b}, ${shapeFillAlpha.toFixed(2)})`;
                updateLayer(shapeValues.id, { fillColor: rgba });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.colorInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Fill Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={shapeFillAlpha}
              onChange={(event) => {
                const alpha = Number(event.target.value);
                const { r, g, b } = hexToRgb(normalizeColor(shapeValues.fillColor));
                const rgba = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
                updateLayer(shapeValues.id, { fillColor: rgba });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.rangeInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Border</span>
            <input
              type="color"
              value={normalizeColor(shapeValues.strokeColor ?? '#ffffff')}
              onChange={(event) => {
                updateLayer(shapeValues.id, { strokeColor: event.target.value });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.colorInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Border px</span>
            <input
              type="number"
              min={0}
              max={40}
              value={shapeValues.strokeWidth ?? 0}
              onChange={(event) => {
                const next = Number(event.target.value || 0);
                updateLayer(shapeValues.id, { strokeWidth: next });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
            />
          </label>
        </div>
      )}

      {!supportsText && !supportsFill && (
        <div style={panelStyle.emptySecondary}>No editable properties for this layer yet.</div>
      )}
    </div>
  );
}

function normalizeColor(color: string | undefined): string {
  if (!color) return '#ffffff';
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) return color;
  // Fallback: create temporary element to compute hex
  if (typeof document !== 'undefined') {
    const element = document.createElement('div');
    element.style.color = color;
    document.body.appendChild(element);
    const computed = getComputedStyle(element).color;
    document.body.removeChild(element);
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
    if (match) {
      const [r, g, b] = match.slice(1).map((value) => Number(value));
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return '#ffffff';
}

function extractAlpha(color: string | undefined): number {
  if (!color) return 1;
  if (color.startsWith('#')) return 1;
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/.exec(color);
  if (match) {
    return match[4] !== undefined ? Number(match[4]) : 1;
  }
  return 1;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

const panelStyle: Record<string, CSSProperties> = {
  container: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    gap: '4px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    gap: '8px',
  },
  alignmentRow: {
    display: 'flex',
    gap: '4px',
  },
  alignmentButton: {
    flex: 1,
    padding: '6px 0',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#f5f5f5',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  },
  alignmentButtonActive: {
    background: 'rgba(0, 166, 255, 0.25)',
    borderColor: 'rgba(0, 166, 255, 0.8)',
  },
  numberInput: {
    width: '70px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#f5f5f5',
    borderRadius: '4px',
    padding: '4px',
  },
  colorInput: {
    width: '40px',
    height: '24px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'transparent',
    padding: 0,
  },
  textarea: {
    minHeight: '68px',
    resize: 'vertical',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: '#f5f5f5',
    padding: '8px',
    fontFamily: 'inherit',
  },
  rangeInput: {
    flex: 1,
  },
  empty: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.55)',
    padding: '20px 0',
    textAlign: 'center',
  },
  emptySecondary: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    padding: '12px 0',
    textAlign: 'center',
  },
};
