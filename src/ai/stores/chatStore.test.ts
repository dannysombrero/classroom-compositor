/**
 * Chat Store Tests
 *
 * Tests for chat state management, message handling, and utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useChatStore,
  createChatMessage,
  formatMessageTime,
  getSenderDisplayName,
  groupConsecutiveMessages,
} from './chatStore';
import type { ChatMessage } from '../types';

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useChatStore.setState({
      messages: [],
      unreadCount: 0,
      isOpen: false,
      isMinimized: false,
      currentUserId: null,
      currentUserName: null,
      currentUserRole: null,
    });
  });

  describe('Message Management', () => {
    it('should add a message to the store', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        from: 'bot',
        sessionId: 'session-1',
        text: 'Hello!',
        timestamp: Date.now(),
        botId: 'test-bot',
        senderName: 'Test Bot',
      };

      useChatStore.getState().addMessage(message);

      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it('should set multiple messages at once', () => {
      const messages: ChatMessage[] = [
        createChatMessage('session-1', 'Message 1', 'bot', 'bot-1', 'Bot 1', 'bot-1'),
        createChatMessage('session-1', 'Message 2', 'student', 'student-1', 'Student'),
        createChatMessage('session-1', 'Message 3', 'teacher', 'teacher-1', 'Teacher'),
      ];

      useChatStore.getState().setMessages(messages);

      expect(useChatStore.getState().messages).toHaveLength(3);
      expect(useChatStore.getState().messages).toEqual(messages);
    });

    it('should clear all messages', () => {
      const messages: ChatMessage[] = [
        createChatMessage('session-1', 'Message 1', 'bot'),
        createChatMessage('session-1', 'Message 2', 'bot'),
      ];

      useChatStore.getState().setMessages(messages);
      expect(useChatStore.getState().messages).toHaveLength(2);

      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().unreadCount).toBe(0);
    });

    it('should get recent messages with limit', () => {
      const messages: ChatMessage[] = Array.from({ length: 15 }, (_, i) =>
        createChatMessage('session-1', `Message ${i + 1}`, 'bot')
      );

      useChatStore.getState().setMessages(messages);

      const recent = useChatStore.getState().getRecentMessages(5);
      expect(recent).toHaveLength(5);
      expect(recent[0].text).toBe('Message 11');
      expect(recent[4].text).toBe('Message 15');
    });

    it('should get message count', () => {
      const messages: ChatMessage[] = [
        createChatMessage('session-1', 'Message 1', 'bot'),
        createChatMessage('session-1', 'Message 2', 'bot'),
        createChatMessage('session-1', 'Message 3', 'bot'),
      ];

      useChatStore.getState().setMessages(messages);
      expect(useChatStore.getState().getMessageCount()).toBe(3);
    });
  });

  describe('Unread Count', () => {
    beforeEach(() => {
      useChatStore.getState().setCurrentUser('user-1', 'Test User', 'student');
    });

    it('should increment unread count when chat is closed', () => {
      const message = createChatMessage(
        'session-1',
        'Hello',
        'bot',
        'bot-1',
        'Bot'
      );

      useChatStore.getState().closeChat();
      useChatStore.getState().addMessage(message);

      expect(useChatStore.getState().unreadCount).toBe(1);
    });

    it('should not increment unread count when chat is open', () => {
      const message = createChatMessage(
        'session-1',
        'Hello',
        'bot',
        'bot-1',
        'Bot'
      );

      useChatStore.getState().openChat();
      useChatStore.getState().addMessage(message);

      expect(useChatStore.getState().unreadCount).toBe(0);
    });

    it('should not increment unread count for own messages', () => {
      const ownMessage = createChatMessage(
        'session-1',
        'My message',
        'student',
        'user-1',
        'Test User'
      );

      useChatStore.getState().closeChat();
      useChatStore.getState().addMessage(ownMessage);

      expect(useChatStore.getState().unreadCount).toBe(0);
    });

    it('should reset unread count when chat is opened', () => {
      useChatStore.setState({ unreadCount: 5 });

      useChatStore.getState().openChat();

      expect(useChatStore.getState().unreadCount).toBe(0);
    });

    it('should reset unread count when marked as read', () => {
      useChatStore.setState({ unreadCount: 5 });

      useChatStore.getState().markAsRead();

      expect(useChatStore.getState().unreadCount).toBe(0);
    });
  });

  describe('UI State', () => {
    it('should toggle chat open/closed', () => {
      expect(useChatStore.getState().isOpen).toBe(false);

      useChatStore.getState().toggleChat();
      expect(useChatStore.getState().isOpen).toBe(true);

      useChatStore.getState().toggleChat();
      expect(useChatStore.getState().isOpen).toBe(false);
    });

    it('should toggle minimize state', () => {
      expect(useChatStore.getState().isMinimized).toBe(false);

      useChatStore.getState().toggleMinimize();
      expect(useChatStore.getState().isMinimized).toBe(true);

      useChatStore.getState().toggleMinimize();
      expect(useChatStore.getState().isMinimized).toBe(false);
    });

    it('should open chat and reset minimize', () => {
      useChatStore.setState({ isOpen: false, isMinimized: true });

      useChatStore.getState().openChat();

      expect(useChatStore.getState().isOpen).toBe(true);
      expect(useChatStore.getState().isMinimized).toBe(false);
    });

    it('should close chat and reset minimize', () => {
      useChatStore.setState({ isOpen: true, isMinimized: true });

      useChatStore.getState().closeChat();

      expect(useChatStore.getState().isOpen).toBe(false);
      expect(useChatStore.getState().isMinimized).toBe(false);
    });
  });

  describe('User Management', () => {
    it('should set current user', () => {
      useChatStore.getState().setCurrentUser('user-1', 'John Doe', 'teacher');

      const state = useChatStore.getState();
      expect(state.currentUserId).toBe('user-1');
      expect(state.currentUserName).toBe('John Doe');
      expect(state.currentUserRole).toBe('teacher');
    });
  });
});

describe('Chat Utility Functions', () => {
  describe('createChatMessage', () => {
    it('should create a bot message', () => {
      const message = createChatMessage(
        'session-1',
        'Hello!',
        'bot',
        'bot-1',
        'Test Bot',
        'bot-1'
      );

      expect(message.sessionId).toBe('session-1');
      expect(message.text).toBe('Hello!');
      expect(message.from).toBe('bot');
      expect(message.senderId).toBe('bot-1');
      expect(message.senderName).toBe('Test Bot');
      expect(message.botId).toBe('bot-1');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it('should create a student message', () => {
      const message = createChatMessage(
        'session-1',
        'Question?',
        'student',
        'student-1',
        'Student Name'
      );

      expect(message.from).toBe('student');
      expect(message.senderId).toBe('student-1');
      expect(message.botId).toBeUndefined();
    });

    it('should create a teacher message', () => {
      const message = createChatMessage(
        'session-1',
        'Answer',
        'teacher',
        'teacher-1',
        'Teacher Name'
      );

      expect(message.from).toBe('teacher');
      expect(message.senderId).toBe('teacher-1');
    });
  });

  describe('formatMessageTime', () => {
    it('should format today\'s time as time only', () => {
      const now = new Date();
      const timestamp = now.getTime();

      const formatted = formatMessageTime(timestamp);

      // Should be in format like "3:45 PM"
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });

    it('should format past dates with date and time', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const timestamp = yesterday.getTime();

      const formatted = formatMessageTime(timestamp);

      // Should include month abbreviation
      expect(formatted).toMatch(/[A-Z][a-z]{2}/);
    });
  });

  describe('getSenderDisplayName', () => {
    it('should return sender name for bot', () => {
      const message = createChatMessage(
        'session-1',
        'Hi',
        'bot',
        'bot-1',
        'Engagement Bot',
        'bot-1'
      );

      expect(getSenderDisplayName(message)).toBe('Engagement Bot');
    });

    it('should return default "Bot" for unnamed bot', () => {
      const message = createChatMessage('session-1', 'Hi', 'bot');

      expect(getSenderDisplayName(message)).toBe('Bot');
    });

    it('should return sender name for teacher', () => {
      const message = createChatMessage(
        'session-1',
        'Hi',
        'teacher',
        'teacher-1',
        'Ms. Smith'
      );

      expect(getSenderDisplayName(message)).toBe('Ms. Smith');
    });

    it('should return default "Teacher" for unnamed teacher', () => {
      const message = createChatMessage('session-1', 'Hi', 'teacher');

      expect(getSenderDisplayName(message)).toBe('Teacher');
    });

    it('should return sender name for student', () => {
      const message = createChatMessage(
        'session-1',
        'Question',
        'student',
        'student-1',
        'John'
      );

      expect(getSenderDisplayName(message)).toBe('John');
    });

    it('should return default "Student" for unnamed student', () => {
      const message = createChatMessage('session-1', 'Question', 'student');

      expect(getSenderDisplayName(message)).toBe('Student');
    });
  });

  describe('groupConsecutiveMessages', () => {
    it('should group messages from same sender', () => {
      const messages: ChatMessage[] = [
        createChatMessage('s', 'Message 1', 'bot', 'bot-1', 'Bot'),
        createChatMessage('s', 'Message 2', 'bot', 'bot-1', 'Bot'),
        createChatMessage('s', 'Message 3', 'bot', 'bot-1', 'Bot'),
      ];

      const grouped = groupConsecutiveMessages(messages);

      expect(grouped).toHaveLength(1);
      expect(grouped[0]).toHaveLength(3);
    });

    it('should separate messages from different senders', () => {
      const messages: ChatMessage[] = [
        createChatMessage('s', 'Message 1', 'bot', 'bot-1', 'Bot'),
        createChatMessage('s', 'Message 2', 'student', 'student-1', 'Student'),
        createChatMessage('s', 'Message 3', 'bot', 'bot-1', 'Bot'),
      ];

      const grouped = groupConsecutiveMessages(messages);

      expect(grouped).toHaveLength(3);
      expect(grouped[0]).toHaveLength(1);
      expect(grouped[1]).toHaveLength(1);
      expect(grouped[2]).toHaveLength(1);
    });

    it('should separate messages beyond time window', () => {
      const now = Date.now();
      const messages: ChatMessage[] = [
        { ...createChatMessage('s', 'Message 1', 'bot', 'bot-1', 'Bot'), timestamp: now },
        { ...createChatMessage('s', 'Message 2', 'bot', 'bot-1', 'Bot'), timestamp: now + 30000 }, // 30s later
        { ...createChatMessage('s', 'Message 3', 'bot', 'bot-1', 'Bot'), timestamp: now + 70000 }, // 70s later (beyond 1min window)
      ];

      const grouped = groupConsecutiveMessages(messages);

      expect(grouped).toHaveLength(2);
      expect(grouped[0]).toHaveLength(2); // First two grouped
      expect(grouped[1]).toHaveLength(1); // Third separated
    });

    it('should handle empty message array', () => {
      const grouped = groupConsecutiveMessages([]);

      expect(grouped).toHaveLength(0);
    });
  });
});
