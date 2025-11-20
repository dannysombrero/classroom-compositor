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

  // BG Removal controls
  edgeSmoothing: number; // 0-1, controls temporal smoothing (higher = smoother but more lag)
  edgeRefinement: number; // -10 to +10, negative = shrink mask, positive = grow mask
  threshold: number; // 0-1, segmentation confidence threshold

  setEnabled: (v: boolean) => void;
  setMode: (m: EffectMode) => void;
  setQuality: (q: EffectQuality) => void;
  setEngine: (e: EffectEngine) => void;
  setBackground: (b: string | null) => void;

  setBlurRadius: (px: number) => void;
  setEdgeSmoothing: (v: number) => void;
  setEdgeRefinement: (v: number) => void;
  setThreshold: (v: number) => void;
}

export const useVideoEffectsStore = create<VideoEffectsState>((set) => ({
  enabled: false,
  mode: "off",
  quality: "balanced",
  engine: "mediapipe",
  background: null,

  blurRadius: 12,
  edgeSmoothing: 0.7, // Default: moderate smoothing
  edgeRefinement: 0, // Default: no refinement
  threshold: 0.5, // Default: medium confidence

  setEnabled: (v) => set({ enabled: v }),
  setMode: (m) => set({ mode: m }),
  setQuality: (q) => set({ quality: q }),
  setEngine: (e) => set({ engine: e }),
  setBackground: (b) => set({ background: b }),

  setBlurRadius: (px) =>
    set({
      blurRadius: Math.max(0, Math.min(48, Math.round(Number(px) || 0))),
    }),
  setEdgeSmoothing: (v) =>
    set({
      edgeSmoothing: Math.max(0, Math.min(1, Number(v) || 0)),
    }),
  setEdgeRefinement: (v) =>
    set({
      edgeRefinement: Math.max(-10, Math.min(10, Math.round(Number(v) || 0))),
    }),
  setThreshold: (v) =>
    set({
      threshold: Math.max(0, Math.min(1, Number(v) || 0)),
    }),
}));