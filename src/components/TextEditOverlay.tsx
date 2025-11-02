import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useAppStore } from '../app/store';
import type { TextLayer } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { measureTextBlock } from '../utils/layerGeometry';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

interface TextEditOverlayProps {
  layout: CanvasLayout;
  layer: TextLayer;
  onFinish: (cancelled: boolean) => void;
}

/**
 * Editable textarea overlay for in-place text editing.
 */
export function TextEditOverlay({ layout, layer, onFinish }: TextEditOverlayProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);
  const [value, setValue] = useState(layer.content);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const originalContentRef = useRef(layer.content);
  const finishedRef = useRef(false);

  useEffect(() => {
    setValue(layer.content);
    originalContentRef.current = layer.content;
    finishedRef.current = false;
  }, [layer.id]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  const metrics = useMemo(
    () => measureTextBlock(value, layer.fontSize, layer.font, layer.padding),
    [value, layer.fontSize, layer.font, layer.padding]
  );

  const scaleX = Math.abs(layer.transform.scale.x);
  const scaleY = Math.abs(layer.transform.scale.y);

  const widthScene = metrics.width * scaleX;
  const heightScene = metrics.height * scaleY;

  const leftPx = layout.x + (layer.transform.pos.x - widthScene / 2) * layout.scaleX;
  const topPx = layout.y + (layer.transform.pos.y - heightScene / 2) * layout.scaleY;
  const widthPx = Math.max(widthScene * layout.scaleX, 48);
  const heightPx = Math.max(heightScene * layout.scaleY, 32);
  const paddingX = layer.padding * scaleX * layout.scaleX;
  const paddingY = layer.padding * scaleY * layout.scaleY;
  const fontSizePx = layer.fontSize * scaleY * layout.scaleY;
  const lineHeightPx = metrics.lineHeight * scaleY * layout.scaleY;
  const borderRadiusPx = layer.borderRadius * layout.scaleX;

  const finish = (cancelled: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(cancelled);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setValue(next);
    updateLayer(layer.id, { content: next });
    requestCurrentStreamFrame();
  };

  const handleBlur = () => {
    finish(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      const original = originalContentRef.current;
      if (value !== original) {
        setValue(original);
        updateLayer(layer.id, { content: original });
        requestCurrentStreamFrame();
      }
      finish(true);
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      finish(false);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      style={{
        position: 'fixed',
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        padding: `${paddingY}px ${paddingX}px`,
        fontSize: `${fontSizePx}px`,
        lineHeight: `${lineHeightPx}px`,
        fontFamily: layer.font,
        color: layer.textColor,
        caretColor: layer.textColor,
        background: layer.backgroundColor,
        border: '1px solid rgba(0, 166, 255, 0.9)',
        borderRadius: `${borderRadiusPx}px`,
        boxShadow: '0 0 0 1px rgba(0, 166, 255, 0.45)',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
        outline: 'none',
        textAlign: layer.textAlign ?? 'center',
        pointerEvents: 'auto',
        zIndex: 32,
      }}
    />
  );
}
