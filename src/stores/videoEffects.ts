import { create } from "zustand";

export type EffectMode = "off" | "blur" | "removeBackground" | "chromaKey";
export type EffectQuality = "fast" | "balanced" | "high";
export type EffectEngine = "mediapipe" | "onnx" | "mock";

interface VideoEffectsState {
  enabled: boolean;
  mode: EffectMode;
  quality: EffectQuality;
  engine: EffectEngine;

  // Blur settings
  blurRadius: number;

  // Background Removal settings
  backgroundColor: string; // Hex color to show behind removed background

  // Chroma Key settings
  chromaKeyColor: string; // Hex color to key out (default green)
  chromaKeyTolerance: number; // 0-100, how much color variation to accept
  edgeSoftness: number; // 0-20, feather amount in pixels

  setEnabled: (v: boolean) => void;
  setMode: (m: EffectMode) => void;
  setQuality: (q: EffectQuality) => void;
  setEngine: (e: EffectEngine) => void;

  setBlurRadius: (px: number) => void;
  setBackgroundColor: (color: string) => void;
  setChromaKeyColor: (color: string) => void;
  setChromaKeyTolerance: (tolerance: number) => void;
  setEdgeSoftness: (px: number) => void;
}

export const useVideoEffectsStore = create<VideoEffectsState>((set) => ({
  enabled: false,
  mode: "off",
  quality: "balanced",
  engine: "mock",

  blurRadius: 12,
  backgroundColor: "#00ff00", // Default green screen
  chromaKeyColor: "#00ff00", // Default green
  chromaKeyTolerance: 30,
  edgeSoftness: 2,

  setEnabled: (v) => set({ enabled: v }),
  setMode: (m) => set({ mode: m }),
  setQuality: (q) => set({ quality: q }),
  setEngine: (e) => set({ engine: e }),

  setBlurRadius: (px) =>
    set({
      blurRadius: Math.max(0, Math.min(48, Math.round(Number(px) || 0))),
    }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setChromaKeyColor: (color) => set({ chromaKeyColor: color }),
  setChromaKeyTolerance: (tolerance) =>
    set({
      chromaKeyTolerance: Math.max(0, Math.min(100, Math.round(Number(tolerance) || 0))),
    }),
  setEdgeSoftness: (px) =>
    set({
      edgeSoftness: Math.max(0, Math.min(20, Math.round(Number(px) || 0))),
    }),
}));