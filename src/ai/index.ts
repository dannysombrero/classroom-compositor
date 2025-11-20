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
export { ChatPanel, ChatWidget, ChatMessage, ChatInput } from './components/chat';
export { LessonHelperPanel } from './components/LessonHelperPanel';

// Services
export { initializeChat, sendMessageAsCurrentUser, sendBotMessage, sendChatMessage, subscribeToChatMessages } from './services/chatService';
export { generateKeywords, generateQuestions, setupSessionAI, validateLessonDescription, validateKeywords, validateQuestions } from './services/lessonHelperService';
export { setSessionAIConfig, getSessionAIConfig, saveLessonDescription } from './services/firestoreSessionService';

// Bots
export { startBot, stopBot, stopAllBots, pauseAllBots, resumeAllBots, getActiveBots, isBotActive, startBotsWithAIQuestions, ENGAGEMENT_BOT, ENCOURAGEMENT_BOT, CHECK_IN_BOT } from './bots/tier0';
export type { Tier0Bot } from './bots/tier0';
