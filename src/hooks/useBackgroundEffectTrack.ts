import { useEffect, useRef, useState } from "react";
import { useVideoEffectsStore } from "../stores/videoEffects";
import { MediaPipeSegmenter } from "../adapters/mediapipe";

function log(...args: any[]) {
  console.log("%c[Effects]", "color:#0ff", ...args);
}

/**
 * Background effects hook (diagnostic build)
 * - Logs clearly which path is taken
 * - Draws a magenta border on processed frames (easy visual confirmation)
 * - Keeps one output track; slider updates are live without replacing tracks
 * - Modes:
 *    - OFF / non-blur: passthrough raw
 *    - engine !== "mediapipe": full-frame blur (mock)
 *    - engine === "mediapipe": background-only blur (subject sharp)
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
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const previousMaskRef = useRef<ImageData | null>(null);

  const { enabled, mode, engine, blurRadius, background, edgeSmoothing, edgeRefinement, threshold } = useVideoEffectsStore();

  // Live slider values (don't rebuild pipeline when they change)
  const blurRef = useRef<number>(blurRadius);
  const edgeSmoothingRef = useRef<number>(edgeSmoothing);
  const edgeRefinementRef = useRef<number>(edgeRefinement);
  const thresholdRef = useRef<number>(threshold);

  useEffect(() => {
    blurRef.current = blurRadius;
    log("blurRadius changed ->", blurRadius);
  }, [blurRadius]);

  useEffect(() => {
    edgeSmoothingRef.current = edgeSmoothing;
    log("edgeSmoothing changed ->", edgeSmoothing);
  }, [edgeSmoothing]);

  useEffect(() => {
    edgeRefinementRef.current = edgeRefinement;
    log("edgeRefinement changed ->", edgeRefinement);
  }, [edgeRefinement]);

  useEffect(() => {
    thresholdRef.current = threshold;
    log("threshold changed ->", threshold);
  }, [threshold]);

  const teardown = () => {
    log("Teardown: cleaning up effects pipeline");
    if (loopRef.current != null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (processed && processed !== rawTrack) {
      try { processed.stop?.(); } catch {}
    }
    if (outStreamRef.current) {
      log("Teardown: stopping output stream tracks");
      outStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      outStreamRef.current = null;
    }
    if (videoRef.current) {
      try { (videoRef.current as HTMLVideoElement).srcObject = null; } catch {}
      videoRef.current = null;
    }
    // Note: Don't stop srcStreamRef tracks - they're shared with the source
    // Just clear the reference to allow GC
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

    // Effects off or unsupported mode -> passthrough
    if (!enabled || (mode !== "blur" && mode !== "replace" && mode !== "remove")) {
      setProcessed(rawTrack);
      currentTrackRef.current = rawTrack;
      log("Mode OFF or unsupported -> passthrough", { trackId: rawTrack.id });
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
      const stack = new Error().stack ?? 'no stack';
      log("🆕 [EFFECTS-STREAM-CREATE] Created effects canvas stream", {
        streamId: outStream?.id,
        trackId: outTrack.id,
        trackType: outTrack.constructor.name,
        rawTrackId: rawTrack?.id,
        caller: stack.split('\n')[2]?.trim()
      });
    } else {
      setProcessed(rawTrack);
      currentTrackRef.current = rawTrack;
      log("captureStream not available -> passthrough");
    }

    // MediaPipe required for replace/remove modes, or if explicitly selected for blur
    const useMP = mode === "replace" || mode === "remove" || engine === "mediapipe";
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
      log("Engine is mock -> full-frame effect path");
    }

    // Load background image if provided for replace mode
    if (mode === "replace" && background) {
      log("Loading background image:", background);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        log("Background image loaded successfully");
        backgroundImageRef.current = img;
      };
      img.onerror = (e) => {
        log("Background image failed to load:", e);
        backgroundImageRef.current = null;
      };
      img.src = background;
    }

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

      // Helper function to process the segmentation mask with threshold, smoothing, and refinement
      const processMask = (maskCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        if (!oc) return maskCanvas;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskCanvas.width;
        tempCanvas.height = maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return maskCanvas;

        // Draw the raw mask
        tempCtx.drawImage(maskCanvas, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // Apply threshold
        const thresh = thresholdRef.current;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255;
          data[i + 3] = alpha >= thresh ? 255 : 0;
        }

        // Apply temporal smoothing (EMA)
        const smoothing = edgeSmoothingRef.current;
        if (previousMaskRef.current && smoothing > 0) {
          const prevData = previousMaskRef.current.data;
          for (let i = 3; i < data.length; i += 4) {
            const current = data[i] / 255;
            const previous = prevData[i] / 255;
            data[i] = Math.round((smoothing * previous + (1 - smoothing) * current) * 255);
          }
        }

        // Store current mask for next frame
        previousMaskRef.current = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
        previousMaskRef.current.data.set(data);

        // Apply edge refinement (dilate/erode)
        const refinement = Math.round(edgeRefinementRef.current);
        if (refinement !== 0) {
          const kernelSize = Math.abs(refinement);
          const refined = new Uint8ClampedArray(data.length);
          refined.set(data);

          for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
              const idx = (y * tempCanvas.width + x) * 4 + 3;

              if (refinement > 0) {
                // Dilate (grow mask): if any neighbor is opaque, make this opaque
                let maxAlpha = data[idx];
                for (let dy = -kernelSize; dy <= kernelSize; dy++) {
                  for (let dx = -kernelSize; dx <= kernelSize; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < tempCanvas.height && nx >= 0 && nx < tempCanvas.width) {
                      const nidx = (ny * tempCanvas.width + nx) * 4 + 3;
                      maxAlpha = Math.max(maxAlpha, data[nidx]);
                    }
                  }
                }
                refined[idx] = maxAlpha;
              } else {
                // Erode (shrink mask): if any neighbor is transparent, make this transparent
                let minAlpha = data[idx];
                for (let dy = -kernelSize; dy <= kernelSize; dy++) {
                  for (let dx = -kernelSize; dx <= kernelSize; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < tempCanvas.height && nx >= 0 && nx < tempCanvas.width) {
                      const nidx = (ny * tempCanvas.width + nx) * 4 + 3;
                      minAlpha = Math.min(minAlpha, data[nidx]);
                    }
                  }
                }
                refined[idx] = minAlpha;
              }
            }
          }

          // Copy refined alpha back
          for (let i = 3; i < data.length; i += 4) {
            data[i] = refined[i];
          }
        }

        tempCtx.putImageData(imageData, 0, 0);
        return tempCanvas;
      };

      if (mode === "remove") {
        // BACKGROUND REMOVAL MODE - transparent background with foreground only
        const rawMask = segmenterRef.current?.getLatestMask() ?? null;

        if (!rawMask || !fc || !fctx) {
          // Fallback: no segmentation available, show original video
          octx.clearRect(0, 0, oc.width, oc.height);
          octx.drawImage(v, 0, 0, oc.width, oc.height);
        } else {
          // Process the mask with threshold, smoothing, and refinement
          const processedMask = processMask(rawMask);

          // Clear output canvas (transparent background)
          octx.clearRect(0, 0, oc.width, oc.height);

          // Extract foreground (person) with processed mask
          fctx.clearRect(0, 0, fc.width, fc.height);
          fctx.drawImage(v, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "destination-in";
          fctx.drawImage(processedMask, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "source-over";

          // Draw only the foreground on transparent background
          octx.drawImage(fc, 0, 0, oc.width, oc.height);
        }
      } else if (mode === "replace") {
        // BACKGROUND REPLACEMENT MODE
        const rawMask = segmenterRef.current?.getLatestMask() ?? null;

        if (!rawMask || !fc || !fctx) {
          // Fallback: no segmentation available, show original video
          octx.clearRect(0, 0, oc.width, oc.height);
          octx.drawImage(v, 0, 0, oc.width, oc.height);
        } else {
          // Process the mask with threshold, smoothing, and refinement
          const processedMask = processMask(rawMask);

          // Clear output canvas
          octx.clearRect(0, 0, oc.width, oc.height);

          // Draw replacement background (image or solid color)
          const bgImg = backgroundImageRef.current;
          if (bgImg && bgImg.complete) {
            // Draw background image (cover fit)
            const imgAspect = bgImg.width / bgImg.height;
            const canvasAspect = oc.width / oc.height;
            let drawWidth, drawHeight, drawX, drawY;

            if (imgAspect > canvasAspect) {
              drawHeight = oc.height;
              drawWidth = drawHeight * imgAspect;
              drawX = (oc.width - drawWidth) / 2;
              drawY = 0;
            } else {
              drawWidth = oc.width;
              drawHeight = drawWidth / imgAspect;
              drawX = 0;
              drawY = (oc.height - drawHeight) / 2;
            }

            octx.drawImage(bgImg, drawX, drawY, drawWidth, drawHeight);
          } else {
            // Default: green screen effect (solid green background)
            octx.fillStyle = "#00ff00";
            octx.fillRect(0, 0, oc.width, oc.height);
          }

          // Extract foreground (person) with processed mask
          fctx.clearRect(0, 0, fc.width, fc.height);
          fctx.drawImage(v, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "destination-in";
          fctx.drawImage(processedMask, 0, 0, fc.width, fc.height);
          fctx.globalCompositeOperation = "source-over";

          // Composite foreground over replacement background
          octx.drawImage(fc, 0, 0, oc.width, oc.height);
        }
      } else if (!useMP) {
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
          // IMPORTANT: if no mask, we do NOT draw sharp fg at all,
          // leaving the blurred frame visible (so fallback looks blurred).
        }
      }

      // DIAGNOSTIC border
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
  }, [rawTrack, enabled, mode, engine, background]);

  return processed;
}