import React from "react";
import { useVideoEffectsStore, type EffectMode, type EffectQuality, type EffectEngine } from "../stores/videoEffects";

export function PresenterEffectsControls() {
  const {
    enabled, mode, quality, engine,
    setEnabled, setMode, setQuality, setEngine,
  } = useVideoEffectsStore();

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Effects Enabled
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 72, opacity: 0.8 }}>Mode</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as EffectMode)}
        >
          <option value="off">Off</option>
          <option value="blur">Blur</option>
          <option value="replace">Replace</option>
          <option value="chroma">Chroma</option>
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 72, opacity: 0.8 }}>Quality</span>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as EffectQuality)}
        >
          <option value="fast">Fast</option>
          <option value="balanced">Balanced</option>
          <option value="high">High</option>
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 72, opacity: 0.8 }}>Engine</span>
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value as EffectEngine)}
        >
          <option value="mediapipe">MediaPipe</option>
          <option value="onnx">ONNX</option>
        </select>
      </label>
    </div>
  );
}