import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Layer } from '../types/scene';
import { useAppStore } from '../app/store';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import { CameraEffectsSection } from './CameraEffectsSection';

interface LayerPropertiesPanelProps {
  layer: Layer | null;
}

const ALIGNMENT_OPTIONS: Array<{ value: 'left' | 'center' | 'right' }> = [
  { value: 'left' },
  { value: 'center' },
  { value: 'right' },
];

function renderAlignmentIcon(alignment: 'left' | 'center' | 'right') {
  switch (alignment) {
    case 'left':
      return (
        <>
          <line x1="2" y1="3" x2="26" y2="3" />
          <line x1="2" y1="9" x2="18" y2="9" />
          <line x1="2" y1="15" x2="22" y2="15" />
        </>
      );
    case 'center':
      return (
        <>
          <line x1="4" y1="3" x2="24" y2="3" />
          <line x1="2" y1="9" x2="26" y2="9" />
          <line x1="6" y1="15" x2="22" y2="15" />
        </>
      );
    case 'right':
    default:
      return (
        <>
          <line x1="2" y1="3" x2="26" y2="3" />
          <line x1="10" y1="9" x2="26" y2="9" />
          <line x1="6" y1="15" x2="26" y2="15" />
        </>
      );
  }
}

const IMAGE_SCALE_MIN_PERCENT = 5;
const IMAGE_SCALE_MAX_PERCENT = 400;

export function LayerPropertiesPanel({ layer }: LayerPropertiesPanelProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);

  const supportsFill = layer?.type === 'shape';
  const supportsText = layer?.type === 'text';
  const supportsImage = layer?.type === 'image';
  const supportsCamera = layer?.type === 'camera';

  const textValues = useMemo(() => {
    if (layer?.type !== 'text') return null;
    return layer;
  }, [layer]);

  const backgroundAlpha = textValues ? extractAlpha(textValues.backgroundColor) : 1;

  const shapeValues = useMemo(() => {
    if (layer?.type !== 'shape') return null;
    return layer;
  }, [layer]);

  const imageValues = useMemo(() => {
    if (layer?.type !== 'image') return null;
    return layer;
  }, [layer]);
  const [imageWidthInput, setImageWidthInput] = useState('');
  const [imageHeightInput, setImageHeightInput] = useState('');

  useEffect(() => {
    if (!imageValues) return;
    setImageWidthInput(Math.round(imageValues.transform.scale.x * 100).toString());
    setImageHeightInput(Math.round(imageValues.transform.scale.y * 100).toString());
  }, [imageValues?.id, imageValues?.transform.scale.x, imageValues?.transform.scale.y, imageValues?.scaleLocked]);

  const shapeFillAlpha = shapeValues ? extractAlpha(shapeValues.fillColor) : 1;

  if (!layer) {
    return (
      <div style={panelStyle.empty}>Select a layer to edit its properties.</div>
    );
  }

  return (
    <div style={panelStyle.container}>
      <div style={panelStyle.sectionTitle}>Properties</div>
      {supportsCamera && (
        <>
          <div style={panelStyle.sectionTitle}>Camera Effects</div>
          <div style={panelStyle.section}>
            <CameraEffectsSection />
          </div>
        </>
      )}

      {supportsImage && imageValues && (
        <div style={panelStyle.section}>
          <div style={panelStyle.labelRow}>
            <span>Scale lock</span>
            <button
              type="button"
              onClick={() => {
                const next = !(imageValues.scaleLocked ?? true);
                updateLayer(imageValues.id, { scaleLocked: next });
                requestCurrentStreamFrame();
              }}
              style={{
                ...panelStyle.lockToggle,
                ...((imageValues.scaleLocked ?? true) ? panelStyle.lockToggleActive : null),
              }}
            >
              {(imageValues.scaleLocked ?? true) ? '🔒 linked' : '🔓 free'}
            </button>
          </div>
          <div style={panelStyle.labelRow}>
            <span>Base Size</span>
            <span style={panelStyle.valueText}>
              {Math.round(imageValues.width)} × {Math.round(imageValues.height)} px
            </span>
          </div>
          <label style={panelStyle.labelRow}>
            <span>Width %</span>
            <input
              type="number"
              min={IMAGE_SCALE_MIN_PERCENT}
              max={IMAGE_SCALE_MAX_PERCENT}
              value={imageWidthInput}
              onChange={(event) => {
                const input = event.target.value;
                setImageWidthInput(input);
                if (input.trim() === '') {
                  return;
                }
                const raw = Number(input);
                if (Number.isNaN(raw)) {
                  return;
                }
                if (raw < IMAGE_SCALE_MIN_PERCENT) {
                  return;
                }
                const percent = Math.min(raw, IMAGE_SCALE_MAX_PERCENT);
                const scaleValue = percent / 100;
                const locked = imageValues.scaleLocked ?? true;
                updateLayer(imageValues.id, {
                  transform: {
                    ...imageValues.transform,
                    scale: {
                      x: scaleValue,
                      y: locked ? scaleValue : imageValues.transform.scale.y,
                    },
                  },
                });
                setImageWidthInput(percent.toString());
                if (locked) {
                  setImageHeightInput(percent.toString());
                }
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
              onBlur={() => {
                if (imageWidthInput.trim() === '') {
                  const fallback = clampPercent(Math.round(imageValues.transform.scale.x * 100));
                  setImageWidthInput(fallback.toString());
                  return;
                }
                const raw = Number(imageWidthInput);
                if (Number.isNaN(raw)) {
                  const fallback = clampPercent(Math.round(imageValues.transform.scale.x * 100));
                  setImageWidthInput(fallback.toString());
                  return;
                }
                const clamped = clampPercent(raw);
                setImageWidthInput(clamped.toString());
                const locked = imageValues.scaleLocked ?? true;
                const scaleValue = clamped / 100;
                updateLayer(imageValues.id, {
                  transform: {
                    ...imageValues.transform,
                    scale: {
                      x: scaleValue,
                      y: locked ? scaleValue : imageValues.transform.scale.y,
                    },
                  },
                });
                if (locked) {
                  setImageHeightInput(clamped.toString());
                }
                requestCurrentStreamFrame();
              }}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Height %</span>
            <input
              type="number"
              min={IMAGE_SCALE_MIN_PERCENT}
              max={IMAGE_SCALE_MAX_PERCENT}
              value={imageHeightInput}
              onChange={(event) => {
                const input = event.target.value;
                setImageHeightInput(input);
                if (input.trim() === '') {
                  return;
                }
                const raw = Number(input);
                if (Number.isNaN(raw)) {
                  return;
                }
                if (raw < IMAGE_SCALE_MIN_PERCENT) {
                  return;
                }
                const percent = Math.min(raw, IMAGE_SCALE_MAX_PERCENT);
                const scaleValue = percent / 100;
                const locked = imageValues.scaleLocked ?? true;
                updateLayer(imageValues.id, {
                  transform: {
                    ...imageValues.transform,
                    scale: {
                      x: locked ? scaleValue : imageValues.transform.scale.x,
                      y: scaleValue,
                    },
                  },
                });
                setImageHeightInput(percent.toString());
                if (locked) {
                  setImageWidthInput(percent.toString());
                }
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
              onBlur={() => {
                if (imageHeightInput.trim() === '') {
                  const fallback = clampPercent(Math.round(imageValues.transform.scale.y * 100));
                  setImageHeightInput(fallback.toString());
                  return;
                }
                const raw = Number(imageHeightInput);
                if (Number.isNaN(raw)) {
                  const fallback = clampPercent(Math.round(imageValues.transform.scale.y * 100));
                  setImageHeightInput(fallback.toString());
                  return;
                }
                const clamped = clampPercent(raw);
                setImageHeightInput(clamped.toString());
                const locked = imageValues.scaleLocked ?? true;
                const scaleValue = clamped / 100;
                updateLayer(imageValues.id, {
                  transform: {
                    ...imageValues.transform,
                    scale: {
                      x: locked ? scaleValue : imageValues.transform.scale.x,
                      y: scaleValue,
                    },
                  },
                });
                if (locked) {
                  setImageWidthInput(clamped.toString());
                }
                requestCurrentStreamFrame();
              }}
            />
          </label>
        </div>
      )}
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
                  <svg
                    width="28"
                    height="18"
                    viewBox="0 0 28 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    {renderAlignmentIcon(option.value)}
                  </svg>
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
          <div style={panelStyle.labelRow}>
            <span>Scale lock</span>
            <button
              type="button"
              onClick={() => {
                const next = !(shapeValues.scaleLocked ?? true);
                updateLayer(shapeValues.id, { scaleLocked: next });
                requestCurrentStreamFrame();
              }}
              style={{
                ...panelStyle.lockToggle,
                ...((shapeValues.scaleLocked ?? true) ? panelStyle.lockToggleActive : null),
              }}
            >
              {(shapeValues.scaleLocked ?? true) ? '🔒 linked' : '🔓 free'}
            </button>
          </div>
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
          <label style={panelStyle.labelRow}>
            <span>Width (px)</span>
            <input
              type="number"
              min={10}
              max={8000}
              value={Math.round(shapeValues.width)}
              onChange={(event) => {
                const raw = Number(event.target.value);
                if (Number.isNaN(raw)) return;
                const width = Math.max(1, Math.min(raw, 8000));
                updateLayer(shapeValues.id, { width });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
            />
          </label>
          <label style={panelStyle.labelRow}>
            <span>Height (px)</span>
            <input
              type="number"
              min={10}
              max={8000}
              value={Math.round(shapeValues.height)}
              onChange={(event) => {
                const raw = Number(event.target.value);
                if (Number.isNaN(raw)) return;
                const height = Math.max(1, Math.min(raw, 8000));
                updateLayer(shapeValues.id, { height });
                requestCurrentStreamFrame();
              }}
              style={panelStyle.numberInput}
            />
          </label>
        </div>
      )}

      {!supportsText && !supportsFill && !supportsImage && !supportsCamera && (
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

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return IMAGE_SCALE_MIN_PERCENT;
  return Math.min(IMAGE_SCALE_MAX_PERCENT, Math.max(IMAGE_SCALE_MIN_PERCENT, value));
}

const panelStyle: Record<string, CSSProperties> = {
  container: {
    paddingTop: '0',
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
  valueText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  lockToggle: {
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f5f5f5',
    fontSize: '11px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
  lockToggleActive: {
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
