import type { CSSProperties } from "react";
import {
  useVideoEffectsStore,
  type EffectMode,
  type EffectQuality,
} from "../stores/videoEffects";
import { requestCurrentStreamFrame } from "../utils/viewerStream";

interface CameraEffectsSectionProps {
  heading?: string;
}

export function CameraEffectsSection({ heading }: CameraEffectsSectionProps) {
  const {
    enabled,
    mode,
    quality,
    background,
    blurRadius,
    edgeSmoothing,
    edgeRefinement,
    threshold,
    setEnabled,
    setMode,
    setQuality,
    setBackground,
    setBlurRadius,
    setEdgeSmoothing,
    setEdgeRefinement,
    setThreshold,
  } = useVideoEffectsStore();

  const renderHeading = heading ? (
    <div style={styles.heading}>{heading}</div>
  ) : null;

  return (
    <div style={styles.container}>
      {renderHeading}
      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            requestCurrentStreamFrame();
          }}
        />
        <span>Effects enabled</span>
      </label>

      <label style={styles.row}>
        <span style={styles.rowLabel}>Mode</span>
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as EffectMode);
            requestCurrentStreamFrame();
          }}
          style={styles.select}
        >
          <option value="off">Off</option>
          <option value="blur">Blur</option>
          <option value="remove">BG Removal</option>
          <option value="replace">Replace</option>
        </select>
      </label>

      <label style={styles.row}>
        <span style={styles.rowLabel}>Quality</span>
        <select
          value={quality}
          onChange={(event) => {
            setQuality(event.target.value as EffectQuality);
            requestCurrentStreamFrame();
          }}
          style={styles.select}
        >
          <option value="fast">Fast</option>
          <option value="balanced">Balanced</option>
          <option value="high">High</option>
        </select>
      </label>


      {mode === "blur" && (
        <label style={styles.sliderGroup}>
          <span style={styles.sliderLabel}>
            <span>Blur strength</span>
            <span style={styles.sliderValue}>{blurRadius}px</span>
          </span>
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={blurRadius}
            onChange={(event) => {
              setBlurRadius(event.currentTarget.valueAsNumber);
              requestCurrentStreamFrame();
            }}
          />
        </label>
      )}

      {(mode === "remove" || mode === "replace") && (
        <>
          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Edge Smoothing</span>
              <span style={styles.sliderValue}>{Math.round(edgeSmoothing * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={edgeSmoothing}
              onChange={(event) => {
                setEdgeSmoothing(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
          </label>

          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Edge Refinement</span>
              <span style={styles.sliderValue}>{edgeRefinement > 0 ? '+' : ''}{edgeRefinement}</span>
            </span>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={edgeRefinement}
              onChange={(event) => {
                setEdgeRefinement(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
          </label>

          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Threshold</span>
              <span style={styles.sliderValue}>{Math.round(threshold * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(event) => {
                setThreshold(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
          </label>
        </>
      )}

      {mode === "replace" && (
        <label style={styles.column}>
          <span>Background (optional URL/data URI)</span>
          <input
            type="text"
            value={background ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setBackground(value || null);
              requestCurrentStreamFrame();
            }}
            placeholder="https://… or data:image/png;base64,…"
            style={styles.textInput}
          />
          <span style={styles.hint}>
            Leave empty for green screen effect
          </span>
        </label>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  heading: {
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.6)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  rowLabel: {
    opacity: 0.8,
  },
  select: {
    flex: 1,
    minWidth: 0,
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#f5f5f5",
    borderRadius: 4,
    padding: "4px 6px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  sliderGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  sliderLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontVariantNumeric: "tabular-nums",
  },
  sliderValue: {
    opacity: 0.8,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  textInput: {
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#f5f5f5",
    borderRadius: 4,
    padding: "6px",
  },
  hint: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: "italic",
  },
};

export default CameraEffectsSection;
