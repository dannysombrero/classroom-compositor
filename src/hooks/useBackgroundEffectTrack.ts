import { useEffect, useRef, useState } from "react";
import { useVideoEffectsStore } from "../stores/videoEffects";
import { MediaPipeSegmenter } from "../adapters/mediapipe";

function log(...args: any[]) {
  console.log("%c[Effects]", "color:#0ff", ...args);
}

/**
 * Background effects hook
 * - Supports blur, background removal (ML), and chroma key (color-based)
 * - Keeps one output track; slider updates are live without replacing tracks
 * - Modes:
 *    - OFF: passthrough raw
 *    - blur: background blur (mock = full frame, mediapipe = background only)
 *    - removeBackground: ML segmentation with solid color background
 *    - chromaKey: Traditional color-based green screen keying
 */
export function useBackgroundEffectTrack(rawTrack: MediaStreamTrack | null) {
  const [processed, setProcessed] = useState<MediaStreamTrack | null>(null);

  const loopRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const srcStreamRef = useRef<MediaStream | null>(null);

  const outCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const outStreamRef = useRef<MediaStream | null>(null);
  const currentTrackRef = useRef<MediaStreamTrack | null>(null);

  const segmenterRef = useRef<MediaPipeSegmenter | null>(null);

  const {
    enabled,
    mode,
    engine,
    blurRadius,
    backgroundColor,
    chromaKeyColor,
    chromaKeyTolerance,
    edgeSoftness,
  } = useVideoEffectsStore();

  // Live slider values (don't rebuild pipeline when they change)
  const blurRef = useRef<number>(blurRadius);
  const bgColorRef = useRef<string>(backgroundColor);
  const chromaColorRef = useRef<string>(chromaKeyColor);
  const chromaToleranceRef = useRef<number>(chromaKeyTolerance);
  const edgeSoftnessRef = useRef<number>(edgeSoftness);

  useEffect(() => {
    blurRef.current = blurRadius;
  }, [blurRadius]);

  useEffect(() => {
    bgColorRef.current = backgroundColor;
  }, [backgroundColor]);

  useEffect(() => {
    chromaColorRef.current = chromaKeyColor;
  }, [chromaKeyColor]);

  useEffect(() => {
    chromaToleranceRef.current = chromaKeyTolerance;
  }, [chromaKeyTolerance]);

  useEffect(() => {
    edgeSoftnessRef.current = edgeSoftness;
  }, [edgeSoftness]);

  const teardown = () => {
    if (loopRef.current != null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (processed && processed !== rawTrack) {
      try { processed.stop?.(); } catch {}
    }
    if (outStreamRef.current) {
      outStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      outStreamRef.current = null;
    }
    if (videoRef.current) {
      try { (videoRef.current as HTMLVideoElement).srcObject = null; } catch {}
      videoRef.current = null;
    }
    srcStreamRef.current = null;

    outCanvasRef.current = null;
    outCtxRef.current = null;
    blurCanvasRef.current = null;
    blurCtxRef.current = null;
    fgCanvasRef.current = null;
    fgCtxRef.current = null;

    if (segmenterRef.current) {
      try { segmenterRef.current.close(); } catch {}
      segmenterRef.current = null;
    }

    currentTrackRef.current = null;
    setProcessed(null);
  };

  useEffect(() => {
    // Always teardown before (re)starting
    teardown();

    if (!rawTrack) {
      log("No rawTrack -> passthrough null");
      return;
    }

    log("Hook init:", { enabled, mode, engine, rawId: rawTrack.id });

    // Effects off -> passthrough
    if (!enabled || mode === "off") {
      setProcessed(rawTrack);
      currentTrackRef.current = rawTrack;
      log("Mode OFF -> passthrough", { trackId: rawTrack.id });
      return;
    }

    // Build once
    const video = document.createElement("video");
    videoRef.current = video;
    video.muted = true;
    video.playsInline = true;
    const srcStream = new MediaStream([rawTrack]);
    srcStreamRef.current = srcStream;
    video.srcObject = srcStream;

    // Output canvas
    const outCanvas = document.createElement("canvas");
    outCanvasRef.current = outCanvas;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) {
      setProcessed(rawTrack);
      currentTrackRef.current = rawTrack;
      log("2D context unavailable -> passthrough");
      return;
    }
    outCtxRef.current = outCtx;

    // Staging canvases
    const blurCanvas = document.createElement("canvas");
    blurCanvasRef.current = blurCanvas;
    const blurCtx = blurCanvas.getContext("2d");
    blurCtxRef.current = blurCtx;

    const fgCanvas = document.createElement("canvas");
    fgCanvasRef.current = fgCanvas;
    const fgCtx = fgCanvas.getContext("2d");
    fgCtxRef.current = fgCtx;

    // Output stream ONCE
    const outStream = outCanvas.captureStream?.(30) ?? null;
    outStreamRef.current = outStream;
    const outTrack = outStream?.getVideoTracks?.()[0] ?? null;

    if (outTrack) {
      setProcessed(outTrack);
      currentTrackRef.current = outTrack;
      log("Created processed output track", { processedId: outTrack.id });
    } else {
      setProcessed(rawTrack);
      currentTrackRef.current = rawTrack;
      log("captureStream not available -> passthrough");
    }

    // MediaPipe required for removeBackground mode, or if explicitly selected for blur
    const useMP = mode === "removeBackground" || engine === "mediapipe";
    if (useMP) {
      log("Initializing MediaPipe segmenter…");
      const seg = new MediaPipeSegmenter();
      segmenterRef.current = seg;
      seg.init()
        .then(() => {
          log("MediaPipe ready.");
          if (videoRef.current) seg.setVideo(videoRef.current);
        })
        .catch((e) => {
          log("MediaPipe init FAILED, falling back:", e);
          segmenterRef.current = null;
        });
    } else {
      log("Engine is mock or mode is chromaKey -> no MediaPipe needed");
    }

    // Helper: Parse hex color to RGB
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 255, 0]; // Default green
    };

    // Helper: Calculate color distance (Euclidean in RGB space)
    const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number => {
      return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
    };

    // Helper: Apply chroma key to create alpha mask
    const applyChromaKey = (
      imageData: ImageData,
      keyColor: [number, number, number],
      tolerance: number,
      edgeSoftness: number
    ): ImageData => {
      const data = imageData.data;
      const maxDistance = Math.sqrt(255 ** 2 * 3); // Max possible distance in RGB
      const toleranceDistance = (tolerance / 100) * maxDistance;
      const softnessDistance = (edgeSoftness / 20) * maxDistance * 0.5; // Scale softness

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const distance = colorDistance(r, g, b, keyColor[0], keyColor[1], keyColor[2]);

        if (distance <= toleranceDistance) {
          // Fully transparent (key color)
          if (softnessDistance > 0 && distance > toleranceDistance - softnessDistance) {
            // Edge feathering - gradually fade alpha
            const alpha = (distance - (toleranceDistance - softnessDistance)) / softnessDistance;
            data[i + 3] = Math.round(alpha * 255);
          } else {
            data[i + 3] = 0;
          }
        }
        // else keep original alpha
      }

      return imageData;
    };

    const draw = () => {
      const v = videoRef.current;
      const octx = outCtxRef.current;
      const oc = outCanvasRef.current;
      const bc = blurCanvasRef.current;
      const bctx = blurCtxRef.current;
      const fc = fgCanvasRef.current;
      const fctx = fgCtxRef.current;

      if (!v || !octx || !oc) {
        loopRef.current = requestAnimationFrame(draw);
        return;
      }

      const vw = v.videoWidth | 0;
      const vh = v.videoHeight | 0;
      if (!vw || !vh) {
        loopRef.current = requestAnimationFrame(draw);
        return;
      }

      // Resize canvases as needed
      if (oc.width !== vw || oc.height !== vh) { oc.width = vw; oc.height = vh; }
      if (bc && (bc.width !== vw || bc.height !== vh)) { bc.width = vw; bc.height = vh; }
      if (fc && (fc.width !== vw || fc.height !== vh)) { fc.width = vw; fc.height = vh; }

      const px = Math.max(0, Math.min(48, blurRef.current | 0));

      if (mode === "chromaKey") {
        // CHROMA KEY MODE - Color-based keying
        if (!fc || !fctx) {
          // Fallback: show original video
          octx.clearRect(0, 0, oc.width, oc.height);
          octx.drawImage(v, 0, 0, oc.width, oc.height);
        } else {
          // Draw video to foreground canvas
          fctx.clearRect(0, 0, fc.width, fc.height);
          fctx.drawImage(v, 0, 0, fc.width, fc.height);

          // Get image data and apply chroma key
          const imageData = fctx.getImageData(0, 0, fc.width, fc.height);
          const keyColor = hexToRgb(chromaColorRef.current);
          const tolerance = chromaToleranceRef.current;
          const softness = edgeSoftnessRef.current;

          const maskedData = applyChromaKey(imageData, keyColor, tolerance, softness);
          fctx.putImageData(maskedData, 0, 0);

          // Draw solid background color, then composite keyed video on top
          octx.clearRect(0, 0, oc.width, oc.height);
          octx.fillStyle = bgColorRef.current;
          octx.fillRect(0, 0, oc.width, oc.height);
          octx.drawImage(fc, 0, 0, oc.width, oc.height);
        }
      } else if (mode === "removeBackground") {
        // BACKGROUND REMOVAL MODE - ML-based segmentation
        const maskCanvas = segmenterRef.current?.getLatestMask() ?? null;

        if (!maskCanvas || !fc || !fctx) {
          // Fallback: no segmentation available, show original video
          octx.clearRect(0, 0, oc.width, oc.height);
          octx.drawImage(v, 0, 0, oc.width, oc.height);
        } else {
          // Clear output canvas
          octx.clearRect(0, 0, oc.width, oc.height);

          // Draw solid background color
          octx.fillStyle = bgColorRef.current;
          octx.fillRect(0, 0, oc.width, oc.height);

          // Extract foreground (person) with mask
          fctx.clearRect(0, 0, fc.width, fc.height);
          fctx.drawImage(v, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "destination-in";
          fctx.drawImage(maskCanvas, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "source-over";

          // Apply edge softness if requested
          const softness = edgeSoftnessRef.current;
          if (softness > 0) {
            fctx.filter = `blur(${softness}px)`;
            const temp = fctx.getImageData(0, 0, fc.width, fc.height);
            fctx.putImageData(temp, 0, 0);
            fctx.filter = "none";
          }

          // Composite foreground over solid background
          octx.drawImage(fc, 0, 0, oc.width, oc.height);
        }
      } else if (mode === "blur") {
        // BLUR MODE
        if (!useMP) {
          // MOCK: full-frame blur directly to output
          octx.filter = px ? `blur(${px}px)` : "none";
          octx.drawImage(v, 0, 0, oc.width, oc.height);
          octx.filter = "none";
        } else {
          // MEDIAPIPE: blur background, overlay sharp foreground masked by segmentation
          if (!bc || !bctx || !fc || !fctx) {
            // Fallback to full-frame blur if staging contexts missing
            octx.filter = px ? `blur(${px}px)` : "none";
            octx.drawImage(v, 0, 0, oc.width, oc.height);
            octx.filter = "none";
          } else {
            // 1) blurred background
            bctx.filter = px ? `blur(${px}px)` : "none";
            bctx.drawImage(v, 0, 0, bc.width, bc.height);
            bctx.filter = "none";

            // Start with blurred background
            octx.clearRect(0, 0, oc.width, oc.height);
            octx.drawImage(bc, 0, 0, oc.width, oc.height);

            // 2) sharp foreground masked by segmentation
            const maskCanvas = segmenterRef.current?.getLatestMask() ?? null;

            if (maskCanvas) {
              // Build sharp FG layer
              fctx.clearRect(0, 0, fc.width, fc.height);
              fctx.drawImage(v, 0, 0, fc.width, fc.height);

              // Keep only FG pixels
              fctx.globalCompositeOperation = "destination-in";
              fctx.drawImage(maskCanvas, 0, 0, fc.width, fc.height);
              fctx.globalCompositeOperation = "source-over";

              // Composite FG over blurred BG
              octx.drawImage(fc, 0, 0, oc.width, oc.height);
            }
          }
        }
      }

      // DIAGNOSTIC border (optional - remove in production)
      octx.save();
      octx.strokeStyle = "magenta";
      octx.lineWidth = 8;
      octx.strokeRect(0, 0, oc.width, oc.height);
      octx.restore();

      loopRef.current = requestAnimationFrame(draw);
    };

    const handleLoaded = () => {
      void video.play().then(() => {
        draw();
        log("Video playing; draw loop started.");
      }).catch(() => {
        draw();
        log("Video play blocked (autoplay), draw loop still started.");
      });
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("loadeddata", handleLoaded);

    return () => {
      log("Tearing down effects pipeline.");
      teardown();
    };
  }, [rawTrack, enabled, mode, engine]);

  return processed;
}
