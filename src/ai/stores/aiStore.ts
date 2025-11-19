/**
 * AI Bot System - State Management
 *
 * Zustand store for managing AI bots, session context, and tier configuration
 */

import { create } from 'zustand';
import type {
  Bot,
  BotConfig,
  EnabledTiers,
  SessionContext,
  TranscriptChunk,
  ChatMessage,
} from '../types';

// ============================================================================
// State Interface
// ============================================================================

interface AIState {
  // Tier Configuration
  enabledTiers: EnabledTiers;

  // Session Context
  sessionContext: SessionContext | null;

  // Pre-Session AI (Tier 0.5)
  lessonDescription: string;
  generatedKeywords: string[];
  generatedQuestions: string[];
  approvedKeywords: string[];
  approvedQuestions: string[];

  // Bots
  activeBots: Bot[];
  botConfig: BotConfig | null;

  // Transcript (Tier 2+)
  liveTranscriptBuffer: TranscriptChunk[];
  transcriptBufferMaxMinutes: number;

  // Actions
  setEnabledTiers: (tiers: Partial<EnabledTiers>) => void;
  setSessionContext: (context: SessionContext | null) => void;

  // Pre-Session AI Actions (Tier 0.5)
  setLessonDescription: (description: string) => void;
  setGeneratedKeywords: (keywords: string[]) => void;
  setGeneratedQuestions: (questions: string[]) => void;
  setApprovedKeywords: (keywords: string[]) => void;
  setApprovedQuestions: (questions: string[]) => void;

  // Bot Actions
  addBot: (bot: Bot) => void;
  removeBot: (botId: string) => void;
  updateBot: (botId: string, updates: Partial<Bot>) => void;
  setBotConfig: (config: BotConfig | null) => void;

  // Transcript Actions (Tier 2+)
  appendTranscript: (chunk: TranscriptChunk) => void;
  clearTranscriptBuffer: () => void;

  // Helper Functions
  isTierEnabled: (tier: keyof EnabledTiers) => boolean;
  shouldUseDelayedScreenShare: () => boolean;
}

// ============================================================================
// Default Tier Configuration
// ============================================================================

const DEFAULT_TIERS: EnabledTiers = {
  tier0: true,      // Bot Simulation - Always available
  tier0_5: true,    // Teacher Helper AI - Available in v1
  tier1: false,     // Keyword-Triggered - Available in v1.1/v1.2
  tier2: false,     // Live LLM Questions - Available in v2
  tier3: false,     // Teaching Assistant - Available in v2
  tier4: false,     // Exit Tickets - Available in v3
  tier5: false,     // Adaptive Teaching - Available in v4+
};

// ============================================================================
// Store
// ============================================================================

export const useAIStore = create<AIState>((set, get) => ({
  // Initial State
  enabledTiers: DEFAULT_TIERS,
  sessionContext: null,
  lessonDescription: '',
  generatedKeywords: [],
  generatedQuestions: [],
  approvedKeywords: [],
  approvedQuestions: [],
  activeBots: [],
  botConfig: null,
  liveTranscriptBuffer: [],
  transcriptBufferMaxMinutes: 3, // Keep last 3 minutes

  // Tier Configuration Actions
  setEnabledTiers: (tiers: Partial<EnabledTiers>) => {
    set((state) => ({
      enabledTiers: { ...state.enabledTiers, ...tiers },
    }));
  },

  // Session Context Actions
  setSessionContext: (context: SessionContext | null) => {
    set({ sessionContext: context });
  },

  // Pre-Session AI Actions (Tier 0.5)
  setLessonDescription: (description: string) => {
    set({ lessonDescription: description });
  },

  setGeneratedKeywords: (keywords: string[]) => {
    set({ generatedKeywords: keywords });
  },

  setGeneratedQuestions: (questions: string[]) => {
    set({ generatedQuestions: questions });
  },

  setApprovedKeywords: (keywords: string[]) => {
    set({ approvedKeywords: keywords });
  },

  setApprovedQuestions: (questions: string[]) => {
    set({ approvedQuestions: questions });
  },

  // Bot Actions
  addBot: (bot: Bot) => {
    set((state) => ({
      activeBots: [...state.activeBots, bot],
    }));
  },

  removeBot: (botId: string) => {
    set((state) => ({
      activeBots: state.activeBots.filter((b) => b.id !== botId),
    }));
  },

  updateBot: (botId: string, updates: Partial<Bot>) => {
    set((state) => ({
      activeBots: state.activeBots.map((bot) =>
        bot.id === botId ? { ...bot, ...updates } : bot
      ),
    }));
  },

  setBotConfig: (config: BotConfig | null) => {
    set({ botConfig: config });
  },

  // Transcript Actions (Tier 2+)
  appendTranscript: (chunk: TranscriptChunk) => {
    set((state) => {
      const newBuffer = [...state.liveTranscriptBuffer, chunk];

      // Trim buffer to keep only last N minutes
      const cutoffTime = Date.now() - state.transcriptBufferMaxMinutes * 60 * 1000;
      const trimmedBuffer = newBuffer.filter((c) => c.timestamp >= cutoffTime);

      return { liveTranscriptBuffer: trimmedBuffer };
    });
  },

  clearTranscriptBuffer: () => {
    set({ liveTranscriptBuffer: [] });
  },

  // Helper Functions
  isTierEnabled: (tier: keyof EnabledTiers) => {
    return get().enabledTiers[tier];
  },

  shouldUseDelayedScreenShare: () => {
    // This is a placeholder - actual implementation should check monitor count
    // For now, delegate to the app store's monitor detection
    return false;
  },
}));

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get transcript text from buffer for AI context
 */
export function getTranscriptText(buffer: TranscriptChunk[]): string {
  return buffer.map((chunk) => chunk.text).join(' ');
}

/**
 * Get recent chat messages formatted for AI context
 */
export function getRecentChatContext(
  messages: ChatMessage[],
  limit: number = 20
): Array<{ from: string; text: string }> {
  return messages
    .slice(-limit)
    .map((msg) => ({
      from: msg.from,
      text: msg.text,
    }));
}

/**
 * Initialize session context when session starts
 */
export function initializeSessionContext(sessionId: string): SessionContext {
  const state = useAIStore.getState();

  return {
    sessionId,
    teacherDescription: state.lessonDescription || undefined,
    aiKeywords: state.approvedKeywords.length > 0 ? state.approvedKeywords : undefined,
    aiQuestions: state.approvedQuestions.length > 0 ? state.approvedQuestions : undefined,
    botConfig: state.botConfig || undefined,
    liveTranscriptBuffer: [],
    recentChatBuffer: [],
    tierEnabled: state.enabledTiers,
  };
}
