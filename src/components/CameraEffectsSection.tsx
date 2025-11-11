import type { CSSProperties } from "react";
import {
  useVideoEffectsStore,
  type EffectMode,
  type EffectQuality,
  type EffectEngine,
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
    engine,
    blurRadius,
    backgroundColor,
    chromaKeyColor,
    chromaKeyTolerance,
    edgeSoftness,
    setEnabled,
    setMode,
    setQuality,
    setEngine,
    setBlurRadius,
    setBackgroundColor,
    setChromaKeyColor,
    setChromaKeyTolerance,
    setEdgeSoftness,
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
          <option value="blur">Blur Background</option>
          <option value="removeBackground">Remove Background</option>
          <option value="chromaKey">Chroma Key</option>
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

      <label style={styles.row}>
        <span style={styles.rowLabel}>Engine</span>
        <select
          value={engine}
          onChange={(event) => {
            setEngine(event.target.value as EffectEngine);
            requestCurrentStreamFrame();
          }}
          style={styles.select}
        >
          <option value="mock">Mock</option>
          <option value="mediapipe">MediaPipe</option>
          <option value="onnx">ONNX</option>
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

      {mode === "removeBackground" && (
        <>
          <label style={styles.column}>
            <span>Background Color</span>
            <div style={styles.colorPickerRow}>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => {
                  setBackgroundColor(event.target.value);
                  requestCurrentStreamFrame();
                }}
                style={styles.colorInput}
              />
              <input
                type="text"
                value={backgroundColor}
                onChange={(event) => {
                  setBackgroundColor(event.target.value);
                  requestCurrentStreamFrame();
                }}
                placeholder="#00ff00"
                style={styles.textInput}
              />
            </div>
            <span style={styles.hint}>
              Color shown behind removed background
            </span>
          </label>

          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Edge softness</span>
              <span style={styles.sliderValue}>{edgeSoftness}px</span>
            </span>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={edgeSoftness}
              onChange={(event) => {
                setEdgeSoftness(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
          </label>
        </>
      )}

      {mode === "chromaKey" && (
        <>
          <label style={styles.column}>
            <span>Key Color</span>
            <div style={styles.colorPickerRow}>
              <input
                type="color"
                value={chromaKeyColor}
                onChange={(event) => {
                  setChromaKeyColor(event.target.value);
                  requestCurrentStreamFrame();
                }}
                style={styles.colorInput}
              />
              <input
                type="text"
                value={chromaKeyColor}
                onChange={(event) => {
                  setChromaKeyColor(event.target.value);
                  requestCurrentStreamFrame();
                }}
                placeholder="#00ff00"
                style={styles.textInput}
              />
            </div>
            <span style={styles.hint}>
              Color to remove (usually green or blue)
            </span>
          </label>

          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Tolerance</span>
              <span style={styles.sliderValue}>{chromaKeyTolerance}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={chromaKeyTolerance}
              onChange={(event) => {
                setChromaKeyTolerance(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
            <span style={styles.hint}>
              How much color variation to accept
            </span>
          </label>

          <label style={styles.sliderGroup}>
            <span style={styles.sliderLabel}>
              <span>Edge softness</span>
              <span style={styles.sliderValue}>{edgeSoftness}px</span>
            </span>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={edgeSoftness}
              onChange={(event) => {
                setEdgeSoftness(event.currentTarget.valueAsNumber);
                requestCurrentStreamFrame();
              }}
            />
          </label>
        </>
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
  colorPickerRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  colorInput: {
    width: 40,
    height: 28,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 4,
    cursor: "pointer",
  },
  textInput: {
    flex: 1,
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#f5f5f5",
    borderRadius: 4,
    padding: "6px",
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: "italic",
  },
};

export default CameraEffectsSection;
