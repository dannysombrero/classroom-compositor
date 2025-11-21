/**
 * Tier 0 Bot System Tests
 *
 * Tests for pre-scripted bot messages, scheduling, pause/resume functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startBot,
  stopBot,
  stopAllBots,
  pauseAllBots,
  resumeAllBots,
  getActiveBots,
  isBotActive,
  ENGAGEMENT_BOT,
  ENCOURAGEMENT_BOT,
  CHECK_IN_BOT,
} from './tier0';

// Mock the chat service
vi.mock('../services/chatService', () => ({
  sendBotMessage: vi.fn().mockResolvedValue(undefined),
}));

describe('Tier 0 Bot System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopAllBots(); // Clean slate
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stopAllBots();
  });

  describe('Bot Lifecycle', () => {
    it('should start a bot and mark it as active', () => {
      const sessionId = 'test-session-1';

      startBot(sessionId, ENGAGEMENT_BOT);

      expect(isBotActive(ENGAGEMENT_BOT.id)).toBe(true);
      expect(getActiveBots()).toHaveLength(1);
    });

    it('should not start the same bot twice', () => {
      const sessionId = 'test-session-1';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      startBot(sessionId, ENGAGEMENT_BOT);
      startBot(sessionId, ENGAGEMENT_BOT); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already running')
      );
      expect(getActiveBots()).toHaveLength(1);
    });

    it('should stop a bot and mark it as inactive', () => {
      const sessionId = 'test-session-1';

      startBot(sessionId, ENGAGEMENT_BOT);
      expect(isBotActive(ENGAGEMENT_BOT.id)).toBe(true);

      stopBot(ENGAGEMENT_BOT.id);
      expect(isBotActive(ENGAGEMENT_BOT.id)).toBe(false);
      expect(getActiveBots()).toHaveLength(0);
    });

    it('should stop all active bots', () => {
      const sessionId = 'test-session-1';

      startBot(sessionId, ENGAGEMENT_BOT);
      startBot(sessionId, ENCOURAGEMENT_BOT);
      startBot(sessionId, CHECK_IN_BOT);

      expect(getActiveBots()).toHaveLength(3);

      stopAllBots();

      expect(getActiveBots()).toHaveLength(0);
      expect(isBotActive(ENGAGEMENT_BOT.id)).toBe(false);
      expect(isBotActive(ENCOURAGEMENT_BOT.id)).toBe(false);
      expect(isBotActive(CHECK_IN_BOT.id)).toBe(false);
    });
  });

  describe('Message Scheduling', () => {
    it('should send first message immediately on start', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);

      // Allow microtask queue to flush
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[0],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );
    });

    it('should send messages at specified intervals', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync(); // First message

      expect(sendBotMessage).toHaveBeenCalledTimes(1);

      // Fast-forward to next interval (30 seconds for ENGAGEMENT_BOT)
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(2);

      // Fast-forward to third message
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(3);
    });

    it('should cycle through messages in order', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync();

      // First message
      expect(sendBotMessage).toHaveBeenLastCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[0],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );

      // Second message
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();
      expect(sendBotMessage).toHaveBeenLastCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[1],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );
    });

    it('should wrap around to first message after all messages sent', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');
      const messageCount = ENGAGEMENT_BOT.messages.length;

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync();

      // Send all messages
      for (let i = 1; i < messageCount; i++) {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      }

      expect(sendBotMessage).toHaveBeenCalledTimes(messageCount);

      // Next message should be first one again
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenLastCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[0],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );
    });
  });

  describe('Pause and Resume', () => {
    it('should pause all active bots', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync(); // First message

      expect(sendBotMessage).toHaveBeenCalledTimes(1);

      pauseAllBots();

      // Advance time - no new messages should be sent
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(1); // Still just 1
    });

    it('should resume bots with grace period', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync();

      pauseAllBots();
      resumeAllBots();

      // Grace period is 5 seconds - bot shouldn't send yet
      vi.advanceTimersByTime(4000);
      await vi.runOnlyPendingTimersAsync();
      expect(sendBotMessage).toHaveBeenCalledTimes(1); // Still first message only

      // After grace period + random buffer (5-10s), bot should send
      // Worst case: 5s grace + 10s buffer = 15s total
      vi.advanceTimersByTime(11000); // 4s + 11s = 15s total
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(2);
    });

    it('should apply randomized buffer to prevent simultaneous messages', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      // Start multiple bots
      startBot(sessionId, ENGAGEMENT_BOT);
      startBot(sessionId, ENCOURAGEMENT_BOT);
      startBot(sessionId, CHECK_IN_BOT);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(3); // All send first message

      pauseAllBots();
      resumeAllBots();

      // After minimum delay (5s grace + 5s min buffer = 10s)
      vi.advanceTimersByTime(10000);
      await vi.runOnlyPendingTimersAsync();

      const callsAt10s = vi.mocked(sendBotMessage).mock.calls.length;

      // After maximum delay (5s grace + 10s max buffer = 15s)
      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      const callsAt15s = vi.mocked(sendBotMessage).mock.calls.length;

      // All bots should have sent by 15s, but likely at different times
      expect(callsAt15s).toBeGreaterThan(callsAt10s);
      expect(callsAt15s).toBe(6); // 3 initial + 3 after resume
    });

    it('should maintain message sequence after pause/resume', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);
      await vi.runOnlyPendingTimersAsync();

      // Send second message
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenLastCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[1],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );

      pauseAllBots();
      resumeAllBots();

      // After resume, should send third message (index 2)
      vi.advanceTimersByTime(15000); // Max grace + buffer
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenLastCalledWith(
        sessionId,
        ENGAGEMENT_BOT.messages[2],
        ENGAGEMENT_BOT.id,
        ENGAGEMENT_BOT.displayName
      );
    });
  });

  describe('Multiple Bots', () => {
    it('should handle multiple bots with different intervals', async () => {
      const sessionId = 'test-session-1';
      const { sendBotMessage } = await import('../services/chatService');

      startBot(sessionId, ENGAGEMENT_BOT);    // 30s
      startBot(sessionId, ENCOURAGEMENT_BOT); // 45s
      startBot(sessionId, CHECK_IN_BOT);      // 60s
      await vi.runOnlyPendingTimersAsync();

      expect(sendBotMessage).toHaveBeenCalledTimes(3); // All send first

      // At 30s: ENGAGEMENT_BOT sends
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();
      expect(sendBotMessage).toHaveBeenCalledTimes(4);

      // At 45s: ENCOURAGEMENT_BOT sends
      vi.advanceTimersByTime(15000);
      await vi.runOnlyPendingTimersAsync();
      expect(sendBotMessage).toHaveBeenCalledTimes(5);

      // At 60s: ENGAGEMENT_BOT (2nd) and CHECK_IN_BOT send
      vi.advanceTimersByTime(15000);
      await vi.runOnlyPendingTimersAsync();
      expect(sendBotMessage).toHaveBeenCalledTimes(7);
    });
  });

  describe('Bot Definitions', () => {
    it('should have valid ENGAGEMENT_BOT configuration', () => {
      expect(ENGAGEMENT_BOT.id).toBe('engagement-bot');
      expect(ENGAGEMENT_BOT.displayName).toBe('Engagement Bot');
      expect(ENGAGEMENT_BOT.messages.length).toBeGreaterThan(0);
      expect(ENGAGEMENT_BOT.intervalSeconds).toBe(30);
    });

    it('should have valid ENCOURAGEMENT_BOT configuration', () => {
      expect(ENCOURAGEMENT_BOT.id).toBe('encouragement-bot');
      expect(ENCOURAGEMENT_BOT.displayName).toBe('Encouragement Bot');
      expect(ENCOURAGEMENT_BOT.messages.length).toBeGreaterThan(0);
      expect(ENCOURAGEMENT_BOT.intervalSeconds).toBe(45);
    });

    it('should have valid CHECK_IN_BOT configuration', () => {
      expect(CHECK_IN_BOT.id).toBe('check-in-bot');
      expect(CHECK_IN_BOT.displayName).toBe('Check-In Bot');
      expect(CHECK_IN_BOT.messages.length).toBeGreaterThan(0);
      expect(CHECK_IN_BOT.intervalSeconds).toBe(60);
    });
  });
});
