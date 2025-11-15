/**
 * Tests for viewer stream utilities - focusing on reconnection paths
 * and fallback delivery mechanisms.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureCanvasStream,
  sendStreamToViewer,
  getStreamFromOpener,
  setCurrentStream,
  getCurrentStream,
} from './viewerStream';

describe('viewerStream - Reconnection and Fallback Tests', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockStream: MediaStream;
  let mockVideoTrack: MediaStreamTrack;

  beforeEach(() => {
    // Create a mock canvas
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 1920;
    mockCanvas.height = 1080;

    // Create a mock MediaStreamTrack
    mockVideoTrack = {
      id: 'mock-track-id',
      kind: 'video',
      label: 'Mock Video Track',
      enabled: true,
      muted: false,
      readyState: 'live',
      getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      stop: vi.fn(),
    } as any;

    // Create a mock MediaStream
    mockStream = {
      id: 'mock-stream-id',
      active: true,
      getVideoTracks: () => [mockVideoTrack],
      getAudioTracks: () => [],
      getTracks: () => [mockVideoTrack],
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Mock captureStream on canvas
    (mockCanvas as any).captureStream = vi.fn(() => mockStream);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('captureCanvasStream', () => {
    it('should capture a stream from canvas with default FPS', () => {
      const stream = captureCanvasStream(mockCanvas);

      expect(stream).toBeDefined();
      expect(stream?.getVideoTracks().length).toBe(1);
      expect((mockCanvas as any).captureStream).toHaveBeenCalledWith(30);
    });

    it('should capture a stream with custom FPS', () => {
      const stream = captureCanvasStream(mockCanvas, { fps: 60 });

      expect(stream).toBeDefined();
      expect((mockCanvas as any).captureStream).toHaveBeenCalledWith(60);
    });

    it('should return null if captureStream is not available', () => {
      const canvas = document.createElement('canvas');
      // Don't mock captureStream - it won't exist

      const stream = captureCanvasStream(canvas);

      expect(stream).toBeNull();
    });
  });

  describe('Stream Registry - Fallback Delivery Path', () => {
    it('should store and retrieve stream via setCurrentStream/getCurrentStream', () => {
      setCurrentStream(mockStream);

      const retrieved = getCurrentStream();

      expect(retrieved).toBe(mockStream);
      expect(retrieved?.id).toBe('mock-stream-id');
    });

    it('should clear stream when set to null', () => {
      setCurrentStream(mockStream);
      setCurrentStream(null);

      const retrieved = getCurrentStream();

      expect(retrieved).toBeNull();
    });

    it('should support getStreamFromOpener for cross-window access', () => {
      // Set up a mock opener window
      const mockOpener = {
        closed: false,
        __classroomCompositorStreams__: new Map([
          ['presenter:primary', mockStream]
        ]),
      };

      // Mock window.opener
      Object.defineProperty(window, 'opener', {
        value: mockOpener,
        configurable: true,
        writable: true,
      });

      const stream = getStreamFromOpener('presenter:primary');

      expect(stream).toBe(mockStream);
    });

    it('should return null if opener does not have the stream', () => {
      const mockOpener = {
        closed: false,
        __classroomCompositorStreams__: new Map(),
      };

      Object.defineProperty(window, 'opener', {
        value: mockOpener,
        configurable: true,
        writable: true,
      });

      const stream = getStreamFromOpener('nonexistent-stream');

      expect(stream).toBeNull();
    });

    it('should return null if opener is closed', () => {
      const mockOpener = {
        closed: true,
        __classroomCompositorStreams__: new Map([
          ['presenter:primary', mockStream]
        ]),
      };

      Object.defineProperty(window, 'opener', {
        value: mockOpener,
        configurable: true,
        writable: true,
      });

      const stream = getStreamFromOpener('presenter:primary');

      expect(stream).toBeNull();
    });
  });

  describe('sendStreamToViewer - Dual Delivery Path', () => {
    it('should send stream via both session messages and legacy postMessage', () => {
      // Create a mock viewer window
      const mockViewerWindow = {
        postMessage: vi.fn(),
        closed: false,
        location: { origin: 'http://localhost:5173' },
      } as any;

      sendStreamToViewer(mockViewerWindow, mockStream);

      // Should have called postMessage multiple times (session messages + legacy)
      expect(mockViewerWindow.postMessage).toHaveBeenCalled();

      // Verify the stream was stored in the registry
      const storedStream = getCurrentStream();
      expect(storedStream).toBe(mockStream);
    });

    it('should not send to a closed window', () => {
      const mockViewerWindow = {
        postMessage: vi.fn(),
        closed: true,
        location: { origin: 'http://localhost:5173' },
      } as any;

      // Should log a warning but not throw
      sendStreamToViewer(mockViewerWindow, mockStream);

      expect(mockViewerWindow.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Scenarios', () => {
    it('should allow viewer to reconnect and retrieve the same stream', () => {
      // Initial connection
      setCurrentStream(mockStream);

      // Simulate disconnection (viewer refreshes)
      // Stream remains in registry

      // Reconnect - viewer should be able to retrieve stream
      const reconnectedStream = getCurrentStream();

      expect(reconnectedStream).toBe(mockStream);
      expect(reconnectedStream?.id).toBe('mock-stream-id');
    });

    it('should handle stream replacement during reconnection', () => {
      const oldStream = mockStream;

      setCurrentStream(oldStream);

      // Create a new stream (presenter restarted canvas capture)
      const newVideoTrack = { ...mockVideoTrack, id: 'new-track-id' } as any;
      const newStream = {
        ...mockStream,
        id: 'new-stream-id',
        getVideoTracks: () => [newVideoTrack],
        getTracks: () => [newVideoTrack],
      } as any;

      setCurrentStream(newStream);

      const retrieved = getCurrentStream();

      expect(retrieved).toBe(newStream);
      expect(retrieved?.id).toBe('new-stream-id');
      expect(retrieved).not.toBe(oldStream);
    });
  });
});
