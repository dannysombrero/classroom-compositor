/**
 * Chat System - State Management
 *
 * Zustand store for managing chat messages and real-time updates
 */

import { create } from 'zustand';
import type { ChatMessage } from '../types';

// ============================================================================
// State Interface
// ============================================================================

interface ChatState {
  // Messages
  messages: ChatMessage[];
  unreadCount: number;

  // UI State
  isOpen: boolean;
  isMinimized: boolean;

  // User Info
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserRole: 'teacher' | 'student' | null;

  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  // UI Actions
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleMinimize: () => void;
  markAsRead: () => void;

  // User Actions
  setCurrentUser: (userId: string, userName: string, role: 'teacher' | 'student') => void;

  // Helper Functions
  getRecentMessages: (limit: number) => ChatMessage[];
  getMessageCount: () => number;
}

// ============================================================================
// Store
// ============================================================================

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial State
  messages: [],
  unreadCount: 0,
  isOpen: false,
  isMinimized: false,
  currentUserId: null,
  currentUserName: null,
  currentUserRole: null,

  // Message Actions
  addMessage: (message: ChatMessage) => {
    set((state) => {
      const newMessages = [...state.messages, message];

      // Increment unread count if chat is closed or minimized and message is from someone else
      const isOwnMessage = message.senderId === state.currentUserId;
      const shouldIncrementUnread = (!state.isOpen || state.isMinimized) && !isOwnMessage;

      return {
        messages: newMessages,
        unreadCount: shouldIncrementUnread ? state.unreadCount + 1 : state.unreadCount,
      };
    });
  },

  setMessages: (messages: ChatMessage[]) => {
    set({ messages });
  },

  clearMessages: () => {
    set({ messages: [], unreadCount: 0 });
  },

  // UI Actions
  toggleChat: () => {
    set((state) => {
      const newIsOpen = !state.isOpen;
      return {
        isOpen: newIsOpen,
        unreadCount: newIsOpen ? 0 : state.unreadCount,
        isMinimized: false,
      };
    });
  },

  openChat: () => {
    set({ isOpen: true, unreadCount: 0, isMinimized: false });
  },

  closeChat: () => {
    set({ isOpen: false, isMinimized: false });
  },

  toggleMinimize: () => {
    set((state) => ({ isMinimized: !state.isMinimized }));
  },

  markAsRead: () => {
    set({ unreadCount: 0 });
  },

  // User Actions
  setCurrentUser: (userId: string, userName: string, role: 'teacher' | 'student') => {
    set({
      currentUserId: userId,
      currentUserName: userName,
      currentUserRole: role,
    });
  },

  // Helper Functions
  getRecentMessages: (limit: number) => {
    const { messages } = get();
    return messages.slice(-limit);
  },

  getMessageCount: () => {
    return get().messages.length;
  },
}));

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new chat message
 */
export function createChatMessage(
  sessionId: string,
  text: string,
  from: 'teacher' | 'student' | 'bot',
  senderId?: string,
  senderName?: string,
  botId?: string
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    text,
    from,
    senderId,
    senderName,
    timestamp: Date.now(),
    botId,
  };
}

/**
 * Format timestamp for display
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } else {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

/**
 * Get display name for a message sender
 */
export function getSenderDisplayName(message: ChatMessage): string {
  if (message.from === 'bot') {
    return message.senderName || 'Bot';
  }
  if (message.from === 'teacher') {
    return message.senderName || 'Teacher';
  }
  return message.senderName || 'Student';
}

/**
 * Group messages by sender for UI optimization
 */
export function groupConsecutiveMessages(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  let currentGroup: ChatMessage[] = [];

  for (const message of messages) {
    if (currentGroup.length === 0) {
      currentGroup.push(message);
    } else {
      const lastMessage = currentGroup[currentGroup.length - 1];
      const isSameSender = lastMessage.senderId === message.senderId;
      const timeDiff = message.timestamp - lastMessage.timestamp;
      const isWithinTimeWindow = timeDiff < 60000; // 1 minute

      if (isSameSender && isWithinTimeWindow) {
        currentGroup.push(message);
      } else {
        groups.push(currentGroup);
        currentGroup = [message];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}
