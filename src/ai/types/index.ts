/**
 * AI Bot System - Core Type Definitions
 *
 * Based on ClassCaster AI Bot System Backend Spec
 */

// ============================================================================
// Tier Configuration
// ============================================================================

export type EnabledTiers = {
  tier0: boolean;      // Bot Simulation (No AI)
  tier0_5: boolean;    // Teacher Helper AI (Pre-Session Only)
  tier1: boolean;      // Keyword-Triggered Bots
  tier2: boolean;      // Intelligent Bot Questions (Live LLM)
  tier3: boolean;      // Teaching Assistant Mode (Answering Questions)
  tier4: boolean;      // AI Assessment (Exit Tickets)
  tier5: boolean;      // Adaptive Teaching Assistant (Future)
};

// ============================================================================
// Bot Definitions
// ============================================================================

export type BotSchedule =
  | {
      type: 'timed';
      intervalSeconds: number;
      maxQuestions: number;
    }
  | {
      type: 'keyword';
      keywordMap: Record<string, string[]>;
    };

export type Bot = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  tier: number; // 0, 0.5, 1, 2, 3, 4, 5
  schedule?: BotSchedule;
  remainingQuestions?: string[];
  lastMessageAt?: number; // timestamp
};

export type BotConfig = {
  activeBots: Bot[];
  scheduleMode: 'timed' | 'keyword' | 'mixed';
};

// ============================================================================
// Session Context
// ============================================================================

export type TranscriptChunk = {
  text: string;
  timestamp: number;
};

export type ChatMessage = {
  id: string;
  from: 'teacher' | 'student' | 'bot';
  senderId?: string;
  senderName?: string;
  sessionId: string;
  text: string;
  timestamp: number;
  botId?: string; // If from === 'bot'
};

export type SessionContext = {
  sessionId: string;
  teacherDescription?: string; // From AI Lesson Helper
  aiKeywords?: string[]; // Tier 0.5
  aiQuestions?: string[]; // Tier 0.5 (teacher-approved)
  botConfig?: BotConfig;
  liveTranscriptBuffer?: TranscriptChunk[]; // Tier 2+
  recentChatBuffer?: ChatMessage[]; // Tier 2+
  tierEnabled: EnabledTiers;
};

// ============================================================================
// AI API Request/Response Types
// ============================================================================

// Tier 0.5 - Pre-Session AI
export type GenerateKeywordsRequest = {
  lessonDescription: string;
};

export type GenerateKeywordsResponse = {
  keywords: string[];
};

export type GenerateQuestionsRequest = {
  lessonDescription: string;
  keywords: string[];
};

export type GenerateQuestionsResponse = {
  expectedQuestions: string[];
};

export type SetupAIRequest = {
  aiKeywords: string[];
  aiQuestions: string[];
};

export type SetupAIResponse = {
  ok: boolean;
};

// Tier 1 - Keyword Trigger
export type KeywordTriggerRequest = {
  sessionId: string;
  keyword: string;
};

export type KeywordTriggerResponse = {
  usedQuestion: string | null;
};

// Tier 2 - Contextual Questions
export type ContextualQuestionRequest = {
  sessionId: string;
  transcriptWindow: string;
  recentChat: Array<{ from: string; text: string }>;
  keywords: string[];
};

export type ContextualQuestionResponse = {
  contextualQuestion: string | null;
};

// Tier 3 - Answer Questions
export type AnswerQuestionRequest = {
  sessionId: string;
  questionText: string;
  context: {
    keywords: string[];
    transcriptWindow: string;
    recentChat: Array<{ from: string; text: string }>;
  };
};

export type AnswerQuestionResponse = {
  answer: string;
};

// Tier 4 - Exit Tickets
export type ExitTicketQuestion = {
  question: string;
  choices: string[];
  correctIndex: number;
};

export type FreeResponseQuestion = {
  question: string;
};

export type GenerateExitTicketRequest = {
  sessionId: string;
  transcriptSummary: string;
  keyConcepts: string[];
};

export type GenerateExitTicketResponse = {
  multipleChoice: ExitTicketQuestion[];
  freeResponse: FreeResponseQuestion[];
};

// ============================================================================
// Bot Schedule Request Types
// ============================================================================

export type ScheduleBotRequest = {
  sessionId: string;
  botId: string;
  questions: string[];
  triggers:
    | {
        type: 'timed';
        intervalSeconds: number;
        maxQuestions: number;
      }
    | {
        type: 'keyword';
        keywordMap: Record<string, string[]>;
      };
};

export type ScheduleBotResponse = {
  ok: boolean;
};

// ============================================================================
// Transcript Handling
// ============================================================================

export type AppendTranscriptRequest = {
  textChunk: string;
  timestamp: number;
};

export type AppendTranscriptResponse = {
  ok: boolean;
};
