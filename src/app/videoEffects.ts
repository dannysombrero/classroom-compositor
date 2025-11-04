import { create } from "zustand";

export type EffectMode = "off" | "blur" | "replace" | "chroma";
export type EffectQuality = "fast" | "balanced" | "high";
export type EffectEngine = "mediapipe" | "onnx" | "mock";

interface VideoEffectsState {
  enabled: boolean;
  mode: EffectMode;
  quality: EffectQuality;
  engine: EffectEngine;
  background?: string | null;

  // NEW: live blur slider (pixels)
  blurRadius: number;

  setEnabled: (v: boolean) => void;
  setMode: (m: EffectMode) => void;
  setQuality: (q: EffectQuality) => void;
  setEngine: (e: EffectEngine) => void;
  setBackground: (b: string | null | undefined) => void;

  // NEW
  setBlurRadius: (px: number) => void;
}

export const useVideoEffectsStore = create<VideoEffectsState>((set) => ({
  enabled: false,
  mode: "off",
  quality: "balanced",
  engine: "mock",
  background: null,

  // sensible default so change is obvious
  blurRadius: 12,

  setEnabled: (v) => set({ enabled: v }),
  setMode: (m) => set({ mode: m }),
  setQuality: (q) => set({ quality: q }),
  setEngine: (e) => set({ engine: e }),
  setBackground: (b) => set({ background: b ?? null }),

  // NEW
  setBlurRadius: (px) => set({ blurRadius: Math.max(0, Math.min(48, Math.round(px))) }),
}));