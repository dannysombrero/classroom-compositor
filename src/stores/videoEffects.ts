import { create } from "zustand";

export type EffectMode = "off" | "blur" | "replace" | "remove" | "chroma";
export type EffectQuality = "fast" | "balanced" | "high";
export type EffectEngine = "mediapipe" | "onnx" | "mock";

interface VideoEffectsState {
  enabled: boolean;
  mode: EffectMode;
  quality: EffectQuality;
  engine: EffectEngine;
  background: string | null;

  // Live blur slider (pixels)
  blurRadius: number;

  setEnabled: (v: boolean) => void;
  setMode: (m: EffectMode) => void;
  setQuality: (q: EffectQuality) => void;
  setEngine: (e: EffectEngine) => void;
  setBackground: (b: string | null) => void;

  setBlurRadius: (px: number) => void;
}

export const useVideoEffectsStore = create<VideoEffectsState>((set) => ({
  enabled: false,
  mode: "off",
  quality: "balanced",
  engine: "mediapipe",
  background: null,

  blurRadius: 12,

  setEnabled: (v) => set({ enabled: v }),
  setMode: (m) => set({ mode: m }),
  setQuality: (q) => set({ quality: q }),
  setEngine: (e) => set({ engine: e }),
  setBackground: (b) => set({ background: b }),

  setBlurRadius: (px) =>
    set({
      blurRadius: Math.max(0, Math.min(48, Math.round(Number(px) || 0))),
    }),
}));