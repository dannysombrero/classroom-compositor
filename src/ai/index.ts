/**
 * AI Bot System - Public API
 *
 * Main entry point for the AI bot module
 */

// Types
export * from './types';

// Stores
export { useAIStore, getTranscriptText, getRecentChatContext, initializeSessionContext } from './stores/aiStore';
export { useChatStore, createChatMessage, formatMessageTime, getSenderDisplayName, groupConsecutiveMessages } from './stores/chatStore';

// Components
export { ChatPanel, ChatMessage, ChatInput } from './components/chat';

// Services
export { initializeChat, sendMessageAsCurrentUser, sendBotMessage, sendChatMessage, subscribeToChatMessages } from './services/chatService';
