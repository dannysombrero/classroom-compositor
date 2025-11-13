# Classroom Compositor - Phase 1-3 Implementation Guide

## Table of Contents

- [Phase 1: Agent 1 - Lifecycle Leak Fixes](#phase-1-agent-1---lifecycle-leak-fixes)
- [Phase 1: Agent 2 - Viewer Handshake + shadcn/ui](#phase-1-agent-2---viewer-handshake--shadcnui)
- [Phase 1: Merge Strategy](#phase-1-merge-strategy)
- [Phase 2: UI Redesign + Modularization](#phase-2-ui-redesign--modularization)
- [Phase 3: Performance Optimization](#phase-3-performance-optimization)

---

## Phase 1: Agent 1 - Lifecycle Leak Fixes

**Branch**: `feature/lifecycle-fixes`
**Duration**: 5 days
**Goal**: Fix MediaStream and RAF memory leaks with reference counting

### Day 1-2: Extract Capture Logic

#### Step 1: Create usePresenterCapture hook

**File**: `src/hooks/usePresenterCapture.ts`

```typescript
import { useCallback } from 'react';
import { useAppStore } from '@/app/store';
import { startScreenCapture } from '@/media/mediaCapture';
import { createCameraSource, stopSource } from '@/media/sourceManager';

export function usePresenterCapture() {
  const addLayer = useAppStore(s => s.addLayer);
  const updateLayer = useAppStore(s => s.updateLayer);
  const getCurrentScene = useAppStore(s => s.getCurrentScene);

  const startScreen = useCallback(async () => {
    try {
      const track = await startScreenCapture();
      const scene = getCurrentScene();
      if (!scene) return;

      const screenLayer: ScreenLayer = {
        type: 'screen',
        id: crypto.randomUUID(),
        name: 'Screen Share',
        visible: true,
        locked: false,
        zIndex: scene.layers.length,
        transform: {
          x: 100,
          y: 100,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        trackId: track.id,
        uniformScale: true,
      };

      addLayer(screenLayer);
    } catch (err) {
      console.error('Failed to start screen capture:', err);
    }
  }, [addLayer, getCurrentScene]);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      const source = await createCameraSource(deviceId);
      const scene = getCurrentScene();
      if (!scene) return;

      const cameraLayer: CameraLayer = {
        type: 'camera',
        id: crypto.randomUUID(),
        name: 'Camera',
        visible: true,
        locked: false,
        zIndex: scene.layers.length,
        transform: {
          x: 50,
          y: 50,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        trackId: source.track.id,
        circleDiameter: 320,
        videoOffsetX: 0,
        videoOffsetY: 0,
        videoScale: 1,
      };

      addLayer(cameraLayer);
    } catch (err) {
      console.error('Failed to start camera:', err);
    }
  }, [addLayer, getCurrentScene]);

  const stopMediaSource = useCallback((layerId: string) => {
    stopSource(layerId);
  }, []);

  return {
    startScreen,
    startCamera,
    stopSource: stopMediaSource,
  };
}
```

#### Step 2: Update PresenterPage

**File**: `src/pages/PresenterPage.tsx`

Add import at top:
```typescript
import { usePresenterCapture } from '@/hooks/usePresenterCapture';
```

Inside component:
```typescript
export function PresenterPage() {
  const capture = usePresenterCapture();

  // Replace old handlers with:
  // capture.startScreen()
  // capture.startCamera()
  // capture.stopSource(layerId)
}
```

#### Step 3: Test

```bash
npm run build
npm run dev
```

**Checklist**:
- [ ] Add screen capture works
- [ ] Add camera works
- [ ] Remove layers stops sources

**Commit**:
```bash
git add src/hooks/usePresenterCapture.ts src/pages/PresenterPage.tsx
git commit -m "Extract capture logic to usePresenterCapture hook"
```

---

### Day 2-3: Implement Reference Counting

#### Step 1: Create reference counter utility

**File**: `src/utils/trackReferenceCounter.ts`

```typescript
const trackRefCounts = new Map<MediaStreamTrack, number>();
const trackCleanupCallbacks = new Map<MediaStreamTrack, (() => void)[]>();

export function incrementTrackRef(track: MediaStreamTrack): void {
  const currentCount = trackRefCounts.get(track) || 0;
  trackRefCounts.set(track, currentCount + 1);
  console.debug(`Track ${track.id} ref count: ${currentCount} → ${currentCount + 1}`);
}

export function decrementTrackRef(track: MediaStreamTrack): void {
  const currentCount = trackRefCounts.get(track) || 0;

  if (currentCount <= 0) {
    console.warn(`Attempted to decrement track ${track.id} with zero refs`);
    return;
  }

  const newCount = currentCount - 1;
  trackRefCounts.set(track, newCount);
  console.debug(`Track ${track.id} ref count: ${currentCount} → ${newCount}`);

  if (newCount === 0) {
    const callbacks = trackCleanupCallbacks.get(track) || [];
    callbacks.forEach(cb => cb());

    track.stop();

    trackRefCounts.delete(track);
    trackCleanupCallbacks.delete(track);
    console.debug(`Track ${track.id} stopped and cleaned up`);
  }
}

export function onTrackCleanup(track: MediaStreamTrack, callback: () => void): void {
  const callbacks = trackCleanupCallbacks.get(track) || [];
  callbacks.push(callback);
  trackCleanupCallbacks.set(track, callbacks);
}

export function getTrackRefCount(track: MediaStreamTrack): number {
  return trackRefCounts.get(track) || 0;
}

export function forceCleanupTrack(track: MediaStreamTrack): void {
  console.warn(`Force cleaning up track ${track.id}`);

  const callbacks = trackCleanupCallbacks.get(track) || [];
  callbacks.forEach(cb => cb());

  track.stop();

  trackRefCounts.delete(track);
  trackCleanupCallbacks.delete(track);
}
```

**Commit**:
```bash
git add src/utils/trackReferenceCounter.ts
git commit -m "Add MediaStreamTrack reference counting utility"
```

---

### Day 3: Update sourceManager

**File**: `src/media/sourceManager.ts`

Add imports:
```typescript
import {
  incrementTrackRef,
  decrementTrackRef,
  onTrackCleanup
} from '@/utils/trackReferenceCounter';
```

Update `createCameraSource`:
```typescript
export async function createCameraSource(deviceId?: string) {
  // ... existing code to get track ...

  const track = stream.getVideoTracks()[0];
  incrementTrackRef(track);  // ADD THIS

  const videoElement = document.createElement('video');
  videoElement.srcObject = stream;
  videoElement.muted = true;
  await videoElement.play();

  const sourceId = crypto.randomUUID();
  const source: CameraSource = {
    type: 'camera',
    track,
    videoElement,
    deviceId,
  };

  sources.set(sourceId, source);

  // Register cleanup callback
  onTrackCleanup(track, () => {
    videoElement.srcObject = null;
    videoElement.remove();
    sources.delete(sourceId);
  });

  return source;
}
```

Update `stopSource`:
```typescript
export function stopSource(sourceId: string) {
  const source = sources.get(sourceId);
  if (!source) return;

  if (source.type === 'camera' && source.track) {
    decrementTrackRef(source.track);  // CHANGE from track.stop()
  } else if (source.type === 'screen' && source.track) {
    decrementTrackRef(source.track);  // CHANGE from track.stop()
  }

  // Cleanup callback handles the rest
}
```

Update `replaceVideoTrack`:
```typescript
export function replaceVideoTrack(
  sourceId: string,
  newTrack: MediaStreamTrack
) {
  const source = sources.get(sourceId);
  if (!source || source.type !== 'camera') return;

  const oldTrack = source.track;

  incrementTrackRef(newTrack);  // ADD THIS

  if (source.videoElement) {
    const stream = new MediaStream([newTrack]);
    source.videoElement.srcObject = stream;
  }

  source.track = newTrack;

  if (oldTrack) {
    decrementTrackRef(oldTrack);  // CHANGE from oldTrack.stop()
  }
}
```

**Test**:
```bash
npm run build
npm run dev
```

**Checklist**:
- [ ] Add camera → remove camera (track stops)
- [ ] Add camera → apply effects → remove (track stays alive during effect)
- [ ] Switch camera devices (old track stops, new works)

**Commit**:
```bash
git add src/media/sourceManager.ts
git commit -m "Integrate reference counting into sourceManager"
```

---

### Day 4: Fix RAF Cleanup

Check `src/components/PresenterCanvas.tsx` for RAF cleanup:

```typescript
useEffect(() => {
  let rafId: number;

  const renderLoop = () => {
    rafId = requestAnimationFrame(renderLoop);
    // ... render logic
  };

  rafId = requestAnimationFrame(renderLoop);

  // ENSURE THIS EXISTS
  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
}, [/* dependencies */]);
```

Check `src/hooks/useBackgroundEffects.ts` if it has RAF:

```typescript
useEffect(() => {
  if (!effectsEnabled || !inputTrack) return;

  let rafId: number;

  const processFrame = () => {
    rafId = requestAnimationFrame(processFrame);
    // ... effects processing
  };

  rafId = requestAnimationFrame(processFrame);

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
}, [effectsEnabled, inputTrack]);
```

**Commit**:
```bash
git add src/components/PresenterCanvas.tsx src/hooks/useBackgroundEffects.ts
git commit -m "Ensure RAF loops are properly cleaned up on unmount"
```

---

### Day 4: Add Debug Utilities

**File**: `src/utils/debugMediaLeaks.ts`

```typescript
export function logActiveMediaTracks() {
  if (typeof navigator === 'undefined') return;

  navigator.mediaDevices.enumerateDevices().then(devices => {
    console.group('📹 Active Media Devices');
    devices.forEach(device => {
      console.log(`${device.kind}: ${device.label || 'Unknown'}`);
    });
    console.groupEnd();
  });
}

export function logDOMVideoElements() {
  const videos = document.querySelectorAll('video');
  console.group(`🎥 DOM Video Elements (${videos.length})`);
  videos.forEach((video, i) => {
    const stream = video.srcObject as MediaStream;
    console.log(`Video ${i}:`, {
      src: video.src || 'MediaStream',
      tracks: stream?.getTracks().length || 0,
      playing: !video.paused,
      parent: video.parentElement?.tagName,
    });
  });
  console.groupEnd();
}

export function enableLeakMonitoring() {
  const interval = setInterval(() => {
    console.log('🔍 Leak Monitor Check:');
    logActiveMediaTracks();
    logDOMVideoElements();
  }, 10000);

  return () => clearInterval(interval);
}
```

**Commit**:
```bash
git add src/utils/debugMediaLeaks.ts
git commit -m "Add debug utilities for monitoring media leaks"
```

---

### Day 5: Integration Testing

**Test Checklist**:

#### Camera Lifecycle
- [ ] Add camera layer → Video appears, ref count increments
- [ ] Remove camera layer → Video disappears, track stops, ref count goes to 0
- [ ] DevTools: No detached video elements

#### Background Effects
- [ ] Add camera → Enable blur → Blur applies
- [ ] Disable blur → Original track stays alive during cleanup
- [ ] Remove camera with blur active → Both tracks clean up gracefully

#### Screen Share
- [ ] Add screen share → Screen appears, ref count increments
- [ ] Remove screen share → Track stops, ref count goes to 0

#### Multiple Cameras
- [ ] Add camera 1 and camera 2
- [ ] Remove camera 1 → Only camera 1's track stops
- [ ] Camera 2 still works

#### Device Switching
- [ ] Add camera → Switch device → Old track stops, new track starts

#### Memory Leak Check
- [ ] DevTools Memory tab → Take heap snapshot
- [ ] Add 5 cameras → remove all
- [ ] Take another snapshot → No detached video elements

**Final Commit**:
```bash
git add .
git commit -m "Cleanup and add documentation for lifecycle fixes"
git push origin feature/lifecycle-fixes
```

---

## Phase 1: Agent 2 - Viewer Handshake + shadcn/ui

**Branch**: `feature/viewer-ui`
**Duration**: 5 days
**Goal**: Replace window.currentStream hack + install UI components

### Day 1-2: Extract Viewer Logic

#### Step 1: Create useViewerOrchestration hook

**File**: `src/hooks/useViewerOrchestration.ts`

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

export function useViewerOrchestration() {
  const [viewerWindow, setViewerWindow] = useState<Window | null>(null);
  const { sessionId, isLive } = useSessionStore();

  const openViewer = useCallback(() => {
    if (viewerWindow && !viewerWindow.closed) {
      viewerWindow.focus();
      return;
    }

    const viewer = window.open('/viewer', '_blank', 'width=1920,height=1080');

    if (!viewer) {
      console.error('Failed to open viewer window - popup blocked?');
      return;
    }

    setViewerWindow(viewer);
  }, [viewerWindow]);

  const closeViewer = useCallback(() => {
    if (viewerWindow && !viewerWindow.closed) {
      viewerWindow.close();
    }
    setViewerWindow(null);
  }, [viewerWindow]);

  useEffect(() => {
    if (!viewerWindow) return;

    const checkInterval = setInterval(() => {
      if (viewerWindow.closed) {
        setViewerWindow(null);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [viewerWindow]);

  useEffect(() => {
    return () => {
      if (viewerWindow && !viewerWindow.closed) {
        viewerWindow.close();
      }
    };
  }, [viewerWindow]);

  return {
    openViewer,
    closeViewer,
    viewerWindow,
    isViewerOpen: viewerWindow !== null && !viewerWindow.closed,
  };
}
```

#### Step 2: Update PresenterPage

**File**: `src/pages/PresenterPage.tsx`

Add import:
```typescript
import { useViewerOrchestration } from '@/hooks/useViewerOrchestration';
```

Use the hook:
```typescript
export function PresenterPage() {
  const viewer = useViewerOrchestration();

  // Replace old openViewer calls with:
  // viewer.openViewer()
  // viewer.closeViewer()
}
```

**Test**:
```bash
npm run build
npm run dev
```

**Checklist**:
- [ ] Click "Open Viewer" → window opens

**Commit**:
```bash
git add src/hooks/useViewerOrchestration.ts src/pages/PresenterPage.tsx
git commit -m "Extract viewer orchestration logic to dedicated hook"
```

---

### Day 2: Implement postMessage Protocol

**File**: `src/utils/sessionMessaging.ts`

```typescript
export interface StreamHandoffMessage {
  type: 'STREAM_HANDOFF';
  sessionId: string;
  streamId: string;
  timestamp: number;
}

export interface ViewerReadyMessage {
  type: 'VIEWER_READY';
  sessionId: string;
  timestamp: number;
}

export interface StreamStopMessage {
  type: 'STREAM_STOP';
  sessionId: string;
  timestamp: number;
}

export type ViewerMessage =
  | StreamHandoffMessage
  | ViewerReadyMessage
  | StreamStopMessage;

export function isStreamHandoffMessage(msg: any): msg is StreamHandoffMessage {
  return msg?.type === 'STREAM_HANDOFF'
    && typeof msg.sessionId === 'string'
    && typeof msg.streamId === 'string';
}

export function isViewerReadyMessage(msg: any): msg is ViewerReadyMessage {
  return msg?.type === 'VIEWER_READY'
    && typeof msg.sessionId === 'string';
}

export function isStreamStopMessage(msg: any): msg is StreamStopMessage {
  return msg?.type === 'STREAM_STOP'
    && typeof msg.sessionId === 'string';
}

export function createStreamHandoffMessage(
  sessionId: string,
  streamId: string
): StreamHandoffMessage {
  return {
    type: 'STREAM_HANDOFF',
    sessionId,
    streamId,
    timestamp: Date.now(),
  };
}

export function createViewerReadyMessage(sessionId: string): ViewerReadyMessage {
  return {
    type: 'VIEWER_READY',
    sessionId,
    timestamp: Date.now(),
  };
}

export function createStreamStopMessage(sessionId: string): StreamStopMessage {
  return {
    type: 'STREAM_STOP',
    sessionId,
    timestamp: Date.now(),
  };
}

export function sendMessageToViewer(
  viewerWindow: Window,
  message: ViewerMessage
): void {
  if (viewerWindow.closed) {
    console.warn('Cannot send message - viewer window is closed');
    return;
  }

  viewerWindow.postMessage(message, '*');
  console.debug('Sent to viewer:', message.type);
}

export function sendMessageToPresenter(message: ViewerMessage): void {
  if (!window.opener) {
    console.warn('Cannot send message - no opener window');
    return;
  }

  window.opener.postMessage(message, '*');
  console.debug('Sent to presenter:', message.type);
}
```

**Commit**:
```bash
git add src/utils/sessionMessaging.ts
git commit -m "Add type-safe postMessage protocol for viewer handshake"
```

---

### Day 3: Update sessionStore

**File**: `src/stores/sessionStore.ts`

Add stream registry:

```typescript
import { create } from 'zustand';

interface SessionState {
  sessionId: string | null;
  joinCode: string | null;
  isLive: boolean;
  streamRegistry: Map<string, MediaStream>;

  setSessionId: (id: string) => void;
  setJoinCode: (code: string) => void;
  goLive: (code: string) => void;
  stopLive: () => void;
  registerStream: (stream: MediaStream, sessionId: string) => void;
  getStream: (sessionId: string) => MediaStream | null;
  unregisterStream: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  joinCode: null,
  isLive: false,
  streamRegistry: new Map(),

  setSessionId: (id) => set({ sessionId: id }),
  setJoinCode: (code) => set({ joinCode: code }),

  goLive: (code) => set({
    isLive: true,
    joinCode: code,
    sessionId: crypto.randomUUID(),
  }),

  stopLive: () => {
    const { streamRegistry } = get();
    streamRegistry.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });

    set({
      isLive: false,
      joinCode: null,
      sessionId: null,
      streamRegistry: new Map(),
    });
  },

  registerStream: (stream, sessionId) => {
    const { streamRegistry } = get();
    streamRegistry.set(sessionId, stream);
    set({ streamRegistry: new Map(streamRegistry) });
  },

  getStream: (sessionId) => {
    const { streamRegistry } = get();
    return streamRegistry.get(sessionId) || null;
  },

  unregisterStream: (sessionId) => {
    const { streamRegistry } = get();
    streamRegistry.delete(sessionId);
    set({ streamRegistry: new Map(streamRegistry) });
  },
}));
```

**Commit**:
```bash
git add src/stores/sessionStore.ts
git commit -m "Add stream registry to sessionStore for viewer handshake"
```

---

### Day 3: Update Presenter Side

**File**: `src/hooks/useViewerOrchestration.ts`

Update to handle postMessage:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import {
  sendMessageToViewer,
  createStreamHandoffMessage,
  isViewerReadyMessage
} from '@/utils/sessionMessaging';

export function useViewerOrchestration() {
  const [viewerWindow, setViewerWindow] = useState<Window | null>(null);
  const { sessionId, isLive, getStream } = useSessionStore();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isViewerReadyMessage(event.data)) {
        const stream = getStream(event.data.sessionId);

        if (stream && viewerWindow) {
          const message = createStreamHandoffMessage(
            event.data.sessionId,
            stream.id
          );
          sendMessageToViewer(viewerWindow, message);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [viewerWindow, getStream]);

  const openViewer = useCallback(() => {
    if (viewerWindow && !viewerWindow.closed) {
      viewerWindow.focus();
      return;
    }

    const url = sessionId
      ? `/viewer?sessionId=${sessionId}`
      : '/viewer';

    const viewer = window.open(url, '_blank', 'width=1920,height=1080');

    if (!viewer) {
      console.error('Failed to open viewer window');
      return;
    }

    setViewerWindow(viewer);
  }, [viewerWindow, sessionId]);

  const closeViewer = useCallback(() => {
    if (viewerWindow && !viewerWindow.closed) {
      viewerWindow.close();
    }
    setViewerWindow(null);
  }, [viewerWindow]);

  useEffect(() => {
    if (!viewerWindow) return;

    const checkInterval = setInterval(() => {
      if (viewerWindow.closed) {
        setViewerWindow(null);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [viewerWindow]);

  useEffect(() => {
    return () => {
      if (viewerWindow && !viewerWindow.closed) {
        viewerWindow.close();
      }
    };
  }, [viewerWindow]);

  return {
    openViewer,
    closeViewer,
    viewerWindow,
    isViewerOpen: viewerWindow !== null && !viewerWindow.closed,
  };
}
```

**Commit**:
```bash
git add src/hooks/useViewerOrchestration.ts
git commit -m "Add postMessage handoff to presenter side"
```

---

### Day 4: Update Viewer Side

**File**: `src/pages/ViewerHostPage.tsx`

Replace window.currentStream logic:

```typescript
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import {
  sendMessageToPresenter,
  createViewerReadyMessage,
  isStreamHandoffMessage,
} from '@/utils/sessionMessaging';

export function ViewerHostPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { sessionId, setSessionId } = useSessionStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('sessionId');

    if (urlSessionId) {
      setSessionId(urlSessionId);

      const message = createViewerReadyMessage(urlSessionId);
      sendMessageToPresenter(message);
    }
  }, [setSessionId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isStreamHandoffMessage(event.data)) {
        const receivedStream = useSessionStore.getState().getStream(event.data.sessionId);

        if (receivedStream) {
          setStream(receivedStream);
        } else {
          console.error('Stream not found in registry:', event.data.sessionId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!stream) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-white">Waiting for stream...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black">
      <video
        autoPlay
        playsInline
        muted={false}
        ref={(video) => {
          if (video) {
            video.srcObject = stream;
          }
        }}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
```

**Commit**:
```bash
git add src/pages/ViewerHostPage.tsx
git commit -m "Implement postMessage stream handoff on viewer side"
```

---

### Day 4: Connect Canvas Stream

**File**: `src/pages/PresenterPage.tsx`

Register canvas stream when going live:

```typescript
import { useSessionStore } from '@/stores/sessionStore';

export function PresenterPage() {
  const { goLive, registerStream, sessionId } = useSessionStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGoLive = useCallback(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    goLive(code);

    if (canvasRef.current) {
      const stream = canvasRef.current.captureStream(30);

      const currentSessionId = useSessionStore.getState().sessionId;
      if (currentSessionId) {
        registerStream(stream, currentSessionId);
      }
    }
  }, [goLive, registerStream]);

  // ... rest
}
```

**Commit**:
```bash
git add src/pages/PresenterPage.tsx
git commit -m "Register canvas stream for viewer handoff"
```

---

### Day 5: Install shadcn/ui

#### Step 1: Install Tailwind

```bash
npm install -D tailwindcss@latest postcss autoprefixer
npx tailwindcss init -p
```

#### Step 2: Configure Tailwind

**File**: `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

#### Step 3: Create theme CSS

**File**: `src/shadcn-theme.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

#### Step 4: Import in main.tsx

**File**: `src/main.tsx`

```typescript
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './shadcn-theme.css';  // ADD THIS
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

**Commit**:
```bash
git add tailwind.config.js postcss.config.js src/shadcn-theme.css src/main.tsx package.json
git commit -m "Setup TailwindCSS and shadcn theme"
```

#### Step 5: Initialize shadcn

```bash
npx shadcn@latest init
```

**Answer prompts:**
- TypeScript? **Yes**
- Style? **Default**
- Base color? **Slate**
- Global CSS? **src/shadcn-theme.css**
- CSS variables? **Yes**
- Tailwind config? **tailwind.config.js**
- Import alias components? **@/components**
- Import alias utils? **@/lib/utils**
- React Server Components? **No**

#### Step 6: Install components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add switch
npx shadcn@latest add dropdown-menu
npx shadcn@latest add popover
npx shadcn@latest add sheet
npx shadcn@latest add label
npx shadcn@latest add separator
npx shadcn@latest add avatar
npx shadcn@latest add badge
npx shadcn@latest add card
npx shadcn@latest add scroll-area
```

#### Step 7: Update vite.config.ts

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ... rest
});
```

#### Step 8: Update tsconfig.json

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    // ... existing
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Test**:
```bash
npm run build
```

**Commit**:
```bash
git add src/components/ui/ vite.config.ts tsconfig.json package.json
git commit -m "Install shadcn/ui components"
git push origin feature/viewer-ui
```

---

### Day 5: Test Viewer Flow

**Test Checklist**:

#### Viewer Handshake
- [ ] Click "Go Live" → Join code appears
- [ ] Click "Open Viewer" → Window opens with sessionId in URL
- [ ] Console: "Sent to presenter: VIEWER_READY"
- [ ] Console: "Sent to viewer: STREAM_HANDOFF"
- [ ] Video appears in viewer window

#### Multiple Viewers
- [ ] Open viewer 1 → Receives stream
- [ ] Open viewer 2 → Also receives stream

#### Cleanup
- [ ] Close viewer → No errors
- [ ] Stop live → Stream stops in viewers

#### shadcn Components
- [ ] src/components/ui/ directory exists
- [ ] 15+ component files present
- [ ] npm run build succeeds

---

## Phase 1: Merge Strategy

### Step 1: Merge Agent 1

```bash
# Switch to base branch
git checkout claude/ui-updates-011CUyKK2z5EVZvTdZqJQtty

# Merge lifecycle fixes
git merge feature/lifecycle-fixes

# Should be clean merge
```

### Step 2: Merge Agent 2

```bash
# Still on base branch
git merge feature/viewer-ui

# Resolve conflict in PresenterPage.tsx
```

**Expected conflict in** `src/pages/PresenterPage.tsx`:

```typescript
<<<<<<< HEAD
import { usePresenterCapture } from '@/hooks/usePresenterCapture';
=======
import { useViewerOrchestration } from '@/hooks/useViewerOrchestration';
>>>>>>> feature/viewer-ui
```

**Resolution** (keep both):

```typescript
import { usePresenterCapture } from '@/hooks/usePresenterCapture';
import { useViewerOrchestration } from '@/hooks/useViewerOrchestration';

export function PresenterPage() {
  const capture = usePresenterCapture();
  const viewer = useViewerOrchestration();

  // ... rest
}
```

### Step 3: Test merged code

```bash
npm install
npm run build
npm run dev
```

**Full integration test:**
- [ ] Add camera → works
- [ ] Remove camera → no leaks (check DevTools)
- [ ] Go Live → join code appears
- [ ] Open viewer → stream appears
- [ ] Multiple viewers work
- [ ] Close viewer → clean
- [ ] Stop live → clean

### Step 4: Push merged branch

```bash
git add .
git commit -m "Merge Phase 1: lifecycle fixes + viewer handshake + shadcn"
git push origin claude/ui-updates-011CUyKK2z5EVZvTdZqJQtty
```

---

## Phase 2: UI Redesign + Modularization

**Duration**: Weeks 4-9 (6 weeks)
**Goal**: Rebuild UI with Figma designs while modularizing PresenterPage

### Week 4-5: Design in Figma

**Tasks**:
1. Complete Figma design following guidelines (see `docs/figma-guidelines.md`)
2. Design layers panel, toolbars, dialogs
3. Use shadcn components in Figma (plugin)
4. Test prototype interactions
5. Canvas area = gray placeholder

**Deliverable**: Complete Figma design file ready for code export

---

### Week 6-7: Modularize PresenterPage

Create new hook files to extract logic from PresenterPage.

#### Create usePresenterHotkeys

**File**: `src/hooks/usePresenterHotkeys.ts`

```typescript
import { useEffect } from 'react';
import { useAppStore } from '@/app/store';
import tinykeys from 'tinykeys';

export function usePresenterHotkeys() {
  const { selection, deleteLayer, duplicateLayer, undo, redo } = useAppStore();

  useEffect(() => {
    return tinykeys(window, {
      'Delete': () => {
        selection.forEach(id => deleteLayer(id));
      },
      'Backspace': () => {
        selection.forEach(id => deleteLayer(id));
      },
      'Meta+d': (e) => {
        e.preventDefault();
        selection.forEach(id => duplicateLayer(id));
      },
      'Control+d': (e) => {
        e.preventDefault();
        selection.forEach(id => duplicateLayer(id));
      },
      'Meta+z': (e) => {
        e.preventDefault();
        undo();
      },
      'Control+z': (e) => {
        e.preventDefault();
        undo();
      },
      'Meta+Shift+z': (e) => {
        e.preventDefault();
        redo();
      },
      'Control+Shift+z': (e) => {
        e.preventDefault();
        redo();
      },
      'f': () => {
        // Enter presentation mode
      },
      'p': () => {
        // Enter preview mode
      },
    });
  }, [selection, deleteLayer, duplicateLayer, undo, redo]);
}
```

#### Create usePresenterLayout

**File**: `src/hooks/usePresenterLayout.ts`

```typescript
import { useState, useCallback } from 'react';

export function usePresenterLayout() {
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  const toggleLayersPanel = useCallback(() => {
    setLayersPanelOpen(prev => !prev);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const openPreview = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const enterPresentationMode = useCallback(() => {
    setPresentationMode(true);
  }, []);

  const exitPresentationMode = useCallback(() => {
    setPresentationMode(false);
  }, []);

  return {
    layersPanelOpen,
    setLayersPanelOpen,
    toggleLayersPanel,
    settingsOpen,
    openSettings,
    closeSettings,
    previewOpen,
    openPreview,
    closePreview,
    presentationMode,
    enterPresentationMode,
    exitPresentationMode,
  };
}
```

#### Refactor PresenterPage

**File**: `src/pages/PresenterPage.tsx` (after modularization)

```typescript
import { usePresenterCapture } from '@/hooks/usePresenterCapture';
import { useViewerOrchestration } from '@/hooks/useViewerOrchestration';
import { usePresenterHotkeys } from '@/hooks/usePresenterHotkeys';
import { usePresenterLayout } from '@/hooks/usePresenterLayout';
import { TopMenuBar } from '@/components/layout/TopMenuBar';
import { LeftToolbar } from '@/components/layout/LeftToolbar';
import { LayersPanel } from '@/components/layout/LayersPanel';
import { PresenterCanvas } from '@/components/PresenterCanvas';

export function PresenterPage() {
  // Hooks handle domain logic
  const capture = usePresenterCapture();
  const viewer = useViewerOrchestration();
  const layout = usePresenterLayout();
  usePresenterHotkeys();

  // Component is now just layout composition
  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-900">
      <TopMenuBar
        onGoLive={viewer.openViewer}
        onPreview={layout.openPreview}
        onPresent={layout.enterPresentationMode}
        onSettings={layout.openSettings}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftToolbar
          onAddCamera={capture.startCamera}
          onAddScreen={capture.startScreen}
          onToggleLayers={layout.toggleLayersPanel}
        />

        <div className="flex-1 relative">
          <PresenterCanvas />
        </div>

        <LayersPanel
          open={layout.layersPanelOpen}
          onClose={() => layout.setLayersPanelOpen(false)}
        />
      </div>
    </div>
  );
}
```

**Result**: PresenterPage goes from 900+ lines to ~40 lines

---

### Week 8-9: Integrate Figma Components

#### Extract from Figma

Open Figma Dev Mode for each component:
1. TopMenuBar
2. LeftToolbar
3. LayersPanel
4. GoLiveDialog
5. SettingsDialog
6. PreviewDialog

Copy:
- JSX structure
- Tailwind classes
- Component logic (useState, handlers)

#### Create wrapper components

**Pattern**:

```typescript
// Figma generated component
export function LayersPanel({ layers, onReorder, onToggleVisibility, ... }) {
  // Figma's UI logic
}

// Your integration wrapper
export function LayersPanelConnected() {
  const layers = useAppStore(s => s.getCurrentScene()?.layers ?? []);
  const reorderLayers = useAppStore(s => s.reorderLayers);
  const updateLayer = useAppStore(s => s.updateLayer);

  return (
    <LayersPanel
      layers={layers}
      onReorder={reorderLayers}
      onToggleVisibility={(id) => {
        const layer = layers.find(l => l.id === id);
        if (layer) {
          updateLayer(id, { visible: !layer.visible });
        }
      }}
    />
  );
}
```

#### Directory structure

```
src/
├── components/
│   ├── figma/           # Figma-generated components
│   │   ├── LayersPanel.tsx
│   │   ├── TopMenuBar.tsx
│   │   ├── LeftToolbar.tsx
│   │   └── ...
│   ├── connected/       # Wrappers that connect to store
│   │   ├── LayersPanelConnected.tsx
│   │   ├── TopMenuBarConnected.tsx
│   │   └── ...
│   ├── ui/             # shadcn components
│   └── PresenterCanvas.tsx  # Keep existing
```

---

## Phase 3: Performance Optimization

**Duration**: Weeks 10-13 (4 weeks)
**Goal**: Optimize rendering and history

### Week 10: Canvas Rendering Optimization

#### Throttle RAF when idle

**File**: `src/components/PresenterCanvas.tsx`

```typescript
useEffect(() => {
  let rafId: number;
  let dirtyRef = { current: false };

  const renderLoop = () => {
    rafId = requestAnimationFrame(renderLoop);

    // Check if we need to render
    const hasActiveVideo = layers.some(l =>
      l.type === 'camera' || l.type === 'screen'
    );

    // Skip render if not dirty AND (not streaming OR no video)
    if (!dirtyRef.current && !(isStreaming && hasActiveVideo)) {
      return;
    }

    // Render scene
    drawScene(ctx, scene);
    dirtyRef.current = false;
  };

  rafId = requestAnimationFrame(renderLoop);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
  };
}, [layers, scene, isStreaming]);

// Mark dirty on updates
const handleLayerUpdate = (id, updates) => {
  updateLayer(id, updates);
  dirtyRef.current = true;
};
```

#### Finalize dirty rect clipping

```typescript
const drawScene = (ctx, scene, dirtyRect?) => {
  if (dirtyRect) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    ctx.clip();
  }

  // Draw only visible layers
  const visibleLayers = scene.layers.filter(l => l.visible);

  // Viewport culling
  const viewport = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  };

  visibleLayers
    .filter(layer => intersects(layer, viewport))
    .forEach(layer => drawLayer(ctx, layer));

  if (dirtyRect) {
    ctx.restore();
  }
};
```

---

### Week 11-12: History System Refactor

**Current**: Full scene clones on every edit

**Goal**: Structural sharing with layer-level diffs

**File**: `src/app/store.ts`

```typescript
interface HistoryEntry {
  type: 'UPDATE_LAYER' | 'ADD_LAYER' | 'REMOVE_LAYER' | 'REORDER_LAYERS';
  timestamp: number;
  layerId?: string;
  before?: any;
  after?: any;
}

// Instead of:
history.push(structuredClone(scene));

// Do:
history.push({
  type: 'UPDATE_LAYER',
  timestamp: Date.now(),
  layerId: id,
  before: oldLayer,
  after: newLayer,
});
```

**Undo implementation**:

```typescript
undo: () => {
  const entry = history.pop();
  if (!entry) return;

  switch (entry.type) {
    case 'UPDATE_LAYER':
      // Restore old layer state
      updateLayer(entry.layerId, entry.before);
      break;
    case 'ADD_LAYER':
      // Remove layer
      removeLayer(entry.layerId);
      break;
    case 'REMOVE_LAYER':
      // Re-add layer
      addLayer(entry.before);
      break;
  }

  future.push(entry);
}
```

---

### Week 13: Video Effects Finalization

Complete MediaPipe adapter and remove diagnostics.

**File**: `src/lib/video-effects/mediapipe-adapter.ts`

Replace `any` types with proper interfaces, finalize effect implementations, remove verbose console logs.

---

## Testing Checklist - Full App

After all phases complete:

### Core Features
- [ ] Add/remove all layer types (camera, screen, text, image, shape)
- [ ] Transform layers (move, resize, rotate)
- [ ] Layer visibility toggle
- [ ] Layer lock toggle
- [ ] Drag-drop reorder layers
- [ ] Group layers
- [ ] Expand/collapse groups
- [ ] Multi-select layers
- [ ] Undo/redo

### Media Capture
- [ ] Camera capture starts/stops cleanly
- [ ] Screen capture starts/stops cleanly
- [ ] Switch camera devices
- [ ] Background effects (blur, replacement)
- [ ] No memory leaks (DevTools check)

### Streaming
- [ ] Go Live generates join code
- [ ] Open viewer window
- [ ] Stream appears in viewer
- [ ] Multiple viewers work
- [ ] Viewer reconnection
- [ ] Stop Live cleans up properly

### UI
- [ ] Top menu bar responsive
- [ ] Left toolbar icons work
- [ ] Layers panel slides out/in
- [ ] Layers panel auto-hide on mouse leave
- [ ] All dialogs open/close
- [ ] Keyboard shortcuts work
- [ ] Dark theme applies correctly

### Performance
- [ ] Idle CPU usage < 5%
- [ ] Canvas updates smooth (60fps)
- [ ] No dropped frames during streaming
- [ ] Large scenes (50+ layers) perform well
- [ ] Memory stays stable over time

### Persistence
- [ ] Scene saves to IndexedDB
- [ ] Scene loads on refresh
- [ ] Undo/redo persists
- [ ] No data loss

---

## Summary Timeline

| Phase | Duration | Parallel? | Deliverable |
|-------|----------|-----------|-------------|
| **Phase 1** | 3 weeks | ✅ Yes (2 agents) | Clean foundations + shadcn |
| **Phase 2** | 6 weeks | No | New UI + modular code |
| **Phase 3** | 4 weeks | No | Optimized performance |
| **Total** | **13 weeks** | | Production-ready app |

---

## Branch Strategy

```
claude/ui-updates-011CUyKK2z5EVZvTdZqJQtty (base)
├── feature/lifecycle-fixes (Agent 1)
└── feature/viewer-ui (Agent 2)

After Phase 1 merge → continue on base branch for Phase 2 and 3
```

---

**END OF IMPLEMENTATION GUIDE**
