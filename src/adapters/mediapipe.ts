// Lightweight adapter around MediaPipe Selfie Segmentation.
// We load via CDN on demand so you don't have to install anything yet.

export interface ISegmenter {
    init(): Promise<void>;
    setVideo(input: HTMLVideoElement): void;
    getLatestMask(): HTMLCanvasElement | null; // alpha mask canvas (foreground ~ opaque)
    close(): void;
  }
  
  type MPModule = {
    SelfieSegmentation: any;
    SELFIE_SEGMENTATION: any;
  };
  
  let mpPromise: Promise<MPModule> | null = null;
  
  // Lazy loader – grabs UMD build from jsDelivr
  async function ensureMediaPipe(): Promise<MPModule> {
    if (mpPromise) return mpPromise;
  
    mpPromise = new Promise<MPModule>((resolve, reject) => {
      // If already present
      const existing =
        (window as any).selfieSegmentation ||
        ((window as any).SelfieSegmentation
          ? { SelfieSegmentation: (window as any) }
          : null);
  
      if (existing) {
        resolve(existing as MPModule);
        return;
      }
  
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
      script.async = true;
      script.onload = () => {
        const globalAny = window as any;
        const mod =
          globalAny.selfieSegmentation ||
          (globalAny.SelfieSegmentation
            ? { SelfieSegmentation: globalAny }
            : null);
  
        if (mod && (mod as any).SelfieSegmentation) {
          resolve(mod as MPModule);
        } else {
          reject(new Error("MediaPipe SelfieSegmentation not available on window"));
        }
      };
      script.onerror = () =>
        reject(new Error("Failed to load MediaPipe SelfieSegmentation script"));
      document.head.appendChild(script);
    });
  
    return mpPromise;
  }
  
  export class MediaPipeSegmenter implements ISegmenter {
    private selfie: any | null = null;
    private inputVideo: HTMLVideoElement | null = null;
    private maskCanvas: HTMLCanvasElement | null = null;
    private maskCtx: CanvasRenderingContext2D | null = null;
    private running = false;
  
    async init(): Promise<void> {
      const mp = await ensureMediaPipe();
  
      // Create processor
      const selfie = new mp.SelfieSegmentation.SelfieSegmentation({
        locateFile: (file: string) =>
          // static asset bundle for WASM, etc.
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
  
      // Options:
      // modelSelection: 0 (landscape) | 1 (general). 1 is usually better indoors.
      selfie.setOptions({ modelSelection: 1 });
      await selfie.initialize?.();
  
      // The callback receives a segmentationMask (an offscreen canvas) every request
      selfie.onResults((results: any) => {
        const mask = results.segmentationMask as HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;
        if (!mask) return;
  
        // Copy the mask into our own canvas so we control sizing/lifetime
        const w = mask.width || (mask as any).videoWidth || 0;
        const h = mask.height || (mask as any).videoHeight || 0;
        if (!w || !h) return;
  
        if (!this.maskCanvas) {
          this.maskCanvas = document.createElement("canvas");
          this.maskCanvas.width = w;
          this.maskCanvas.height = h;
          this.maskCtx = this.maskCanvas.getContext("2d");
        }
        if (!this.maskCtx) return;
  
        if (this.maskCanvas.width !== w || this.maskCanvas.height !== h) {
          this.maskCanvas.width = w;
          this.maskCanvas.height = h;
        }
        this.maskCtx.clearRect(0, 0, w, h);
        this.maskCtx.drawImage(mask as any, 0, 0, w, h);
      });
  
      this.selfie = selfie;
      this.running = false;
    }
  
    setVideo(input: HTMLVideoElement): void {
      this.inputVideo = input;
      // Kick a small request loop using requestVideoFrameCallback if available,
      // else rAF. We just request once per rendered frame.
      if (!this.selfie) return;
      if (this.running) return;
      this.running = true;
  
      const step = async () => {
        if (!this.running || !this.selfie || !this.inputVideo) return;
        try {
          await this.selfie.send({ image: this.inputVideo });
        } catch {
          // swallow occasional timing exceptions
        }
        if ("requestVideoFrameCallback" in this.inputVideo) {
          (this.inputVideo as any).requestVideoFrameCallback(() => {
            step();
          });
        } else {
          requestAnimationFrame(step);
        }
      };
  
      step();
    }
  
    getLatestMask(): HTMLCanvasElement | null {
      return this.maskCanvas;
    }
  
    close(): void {
      this.running = false;
      if (this.selfie?.close) {
        try { this.selfie.close(); } catch {}
      }
      this.selfie = null;
      this.inputVideo = null;
      this.maskCanvas = null;
      this.maskCtx = null;
    }
  }