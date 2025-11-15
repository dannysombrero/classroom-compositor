/**
 * Tests for session messaging utilities
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSessionMessage,
  isSessionMessageEnvelope,
  extractSessionMessage,
  postSessionMessage,
  addSessionMessageListener,
  SESSION_MESSAGE_SCOPE,
  SESSION_MESSAGE_VERSION,
  type SessionMessagePayload,
} from './sessionMessaging';

describe('sessionMessaging', () => {
  describe('createSessionMessage', () => {
    it('should wrap a message in an envelope', () => {
      const payload: SessionMessagePayload = {
        type: 'viewer-ready',
        viewerId: 'viewer-123',
        sessionId: 'session-456',
      };

      const envelope = createSessionMessage(payload);

      expect(envelope.scope).toBe(SESSION_MESSAGE_SCOPE);
      expect(envelope.version).toBe(SESSION_MESSAGE_VERSION);
      expect(envelope.message).toEqual(payload);
    });
  });

  describe('isSessionMessageEnvelope', () => {
    it('should return true for valid envelope', () => {
      const envelope = {
        scope: SESSION_MESSAGE_SCOPE,
        version: SESSION_MESSAGE_VERSION,
        message: { type: 'viewer-ready', viewerId: 'test' },
      };

      expect(isSessionMessageEnvelope(envelope)).toBe(true);
    });

    it('should return false for invalid scope', () => {
      const envelope = {
        scope: 'wrong-scope',
        version: SESSION_MESSAGE_VERSION,
        message: { type: 'viewer-ready', viewerId: 'test' },
      };

      expect(isSessionMessageEnvelope(envelope)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isSessionMessageEnvelope(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isSessionMessageEnvelope('string')).toBe(false);
      expect(isSessionMessageEnvelope(123)).toBe(false);
    });
  });

  describe('extractSessionMessage', () => {
    it('should extract message from valid event', () => {
      const payload: SessionMessagePayload = {
        type: 'stream-announce',
        streamId: 'stream-123',
        hasStream: true,
      };

      const event = new MessageEvent('message', {
        data: createSessionMessage(payload),
        origin: window.location.origin,
      });

      const extracted = extractSessionMessage(event);

      expect(extracted).toEqual(payload);
    });

    it('should return null for non-envelope data', () => {
      const event = new MessageEvent('message', {
        data: { some: 'random data' },
        origin: window.location.origin,
      });

      const extracted = extractSessionMessage(event);

      expect(extracted).toBeNull();
    });
  });

  describe('postSessionMessage', () => {
    it('should post wrapped message to target window', () => {
      const mockWindow = {
        postMessage: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      } as any;

      const payload: SessionMessagePayload = {
        type: 'deliver-stream',
        streamId: 'stream-123',
      };

      postSessionMessage(mockWindow, payload);

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: SESSION_MESSAGE_SCOPE,
          version: SESSION_MESSAGE_VERSION,
          message: payload,
        }),
        expect.any(String),
      );
    });

    it('should support custom origin', () => {
      const mockWindow = {
        postMessage: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      } as any;

      const payload: SessionMessagePayload = {
        type: 'viewer-ready',
        viewerId: 'viewer-123',
      };

      postSessionMessage(mockWindow, payload, { origin: 'http://custom-origin' });

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.anything(),
        'http://custom-origin',
      );
    });
  });

  describe('addSessionMessageListener', () => {
    it('should add listener and call handler for valid messages', () => {
      const handler = vi.fn();
      const removeListener = addSessionMessageListener(handler);

      const payload: SessionMessagePayload = {
        type: 'request-stream',
        viewerId: 'viewer-123',
        streamId: 'stream-123',
      };

      const event = new MessageEvent('message', {
        data: createSessionMessage(payload),
        origin: window.location.origin,
      });

      window.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith(payload, event);

      // Cleanup
      removeListener();
    });

    it('should not call handler for invalid messages', () => {
      const handler = vi.fn();
      const removeListener = addSessionMessageListener(handler);

      const event = new MessageEvent('message', {
        data: { invalid: 'data' },
        origin: window.location.origin,
      });

      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();

      // Cleanup
      removeListener();
    });

    it('should remove listener when cleanup function is called', () => {
      const handler = vi.fn();
      const removeListener = addSessionMessageListener(handler);

      removeListener();

      const payload: SessionMessagePayload = {
        type: 'viewer-ready',
        viewerId: 'viewer-123',
      };

      const event = new MessageEvent('message', {
        data: createSessionMessage(payload),
        origin: window.location.origin,
      });

      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Message Type Coverage', () => {
    it('should handle viewer-ready message', () => {
      const payload: SessionMessagePayload = {
        type: 'viewer-ready',
        viewerId: 'viewer-123',
        sessionId: 'session-456',
        capabilities: { acceptsStreamTransfer: true },
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('viewer-ready');
    });

    it('should handle stream-announce message', () => {
      const payload: SessionMessagePayload = {
        type: 'stream-announce',
        streamId: 'stream-123',
        label: 'Primary Stream',
        hasStream: true,
        transferSupported: false,
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('stream-announce');
    });

    it('should handle request-stream message', () => {
      const payload: SessionMessagePayload = {
        type: 'request-stream',
        viewerId: 'viewer-123',
        streamId: 'stream-123',
        sessionId: 'session-456',
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('request-stream');
    });

    it('should handle deliver-stream message', () => {
      const payload: SessionMessagePayload = {
        type: 'deliver-stream',
        streamId: 'stream-123',
        transferSupported: false,
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('deliver-stream');
    });

    it('should handle stream-ended message', () => {
      const payload: SessionMessagePayload = {
        type: 'stream-ended',
        streamId: 'stream-123',
        reason: 'presenter stopped streaming',
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('stream-ended');
    });

    it('should handle error message', () => {
      const payload: SessionMessagePayload = {
        type: 'error',
        code: 'STREAM_NOT_FOUND',
        message: 'The requested stream was not found',
        streamId: 'stream-123',
      };

      const envelope = createSessionMessage(payload);
      expect(envelope.message.type).toBe('error');
    });
  });
});
