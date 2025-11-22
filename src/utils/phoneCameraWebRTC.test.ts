/**
 * Phone Camera WebRTC Tests
 *
 * Tests for phone camera streaming functionality including:
 * - Callback management
 * - Connection lifecycle
 * - Stream handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setPhoneCameraStreamCallback,
  setPhoneCameraDisconnectCallback,
  stopPhoneCamera,
  stopPhoneCameraHost,
  getActivePhoneCameras,
  getPhoneCamera,
} from './phoneCameraWebRTC';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(() => vi.fn()), // Returns unsubscribe function
  addDoc: vi.fn().mockResolvedValue({ id: 'test-doc' }),
}));

// Mock RTCPeerConnection
const mockPeerConnection = {
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test-sdp' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'test-sdp' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  addTransceiver: vi.fn(),
  close: vi.fn(),
  connectionState: 'new',
  localDescription: { sdp: 'a=ice-ufrag:test123\r\n' },
  remoteDescription: { sdp: 'a=ice-ufrag:remote123\r\n' },
  onicecandidate: null,
  ontrack: null,
  onconnectionstatechange: null,
  getSenders: vi.fn().mockReturnValue([]),
};

vi.stubGlobal('RTCPeerConnection', vi.fn(() => mockPeerConnection));
vi.stubGlobal('RTCSessionDescription', vi.fn((desc) => desc));
vi.stubGlobal('RTCIceCandidate', vi.fn((cand) => cand));

describe('Phone Camera WebRTC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any existing connections
    stopPhoneCameraHost();
  });

  afterEach(() => {
    stopPhoneCameraHost();
  });

  describe('Callback Management', () => {
    it('should set stream callback without error', () => {
      const callback = vi.fn();
      expect(() => setPhoneCameraStreamCallback(callback)).not.toThrow();
    });

    it('should set disconnect callback without error', () => {
      const callback = vi.fn();
      expect(() => setPhoneCameraDisconnectCallback(callback)).not.toThrow();
    });

    it('should accept null-like callbacks for cleanup', () => {
      // Set real callback first
      setPhoneCameraStreamCallback(vi.fn());
      // Then set empty callback (cleanup pattern from PresenterPage)
      expect(() => setPhoneCameraStreamCallback(() => {})).not.toThrow();
    });
  });

  describe('Connection Queries', () => {
    it('should return empty array when no cameras connected', () => {
      const cameras = getActivePhoneCameras();
      expect(cameras).toEqual([]);
    });

    it('should return null for non-existent camera', () => {
      const camera = getPhoneCamera('non-existent-id');
      expect(camera).toBeNull();
    });
  });

  describe('Connection Cleanup', () => {
    it('should not throw when stopping non-existent camera', () => {
      expect(() => stopPhoneCamera('non-existent-id')).not.toThrow();
    });

    it('should not throw when stopping host with no connections', () => {
      expect(() => stopPhoneCameraHost()).not.toThrow();
    });
  });
});
