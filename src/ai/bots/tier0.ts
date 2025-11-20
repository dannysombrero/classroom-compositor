/**
 * Tier 0 Bots - Pre-scripted bot messages with timed scheduling
 *
 * Simple bot messages that are sent on a timer for testing and basic engagement.
 * No AI required - just pre-scripted questions/messages.
 */

import { sendBotMessage } from '../services/chatService';

// ============================================================================
// Bot Definitions
// ============================================================================

export interface Tier0Bot {
  id: string;
  displayName: string;
  messages: string[];
  intervalSeconds: number;
}

// ============================================================================
// Pre-defined Bots
// ============================================================================

export const ENGAGEMENT_BOT: Tier0Bot = {
  id: 'engagement-bot',
  displayName: 'Engagement Bot',
  messages: [
    'Welcome everyone! Ready to learn?',
    'Great discussion so far!',
    'Anyone have questions about this topic?',
    'Feel free to ask questions anytime!',
    'Remember to take notes on the key points!',
  ],
  intervalSeconds: 30,
};

export const ENCOURAGEMENT_BOT: Tier0Bot = {
  id: 'encouragement-bot',
  displayName: 'Encouragement Bot',
  messages: [
    'You\'re doing great! Keep up the good work!',
    'Don\'t hesitate to ask if something is unclear!',
    'Learning takes time - you\'re on the right track!',
    'Remember: mistakes are part of learning!',
    'Stay curious and keep asking questions!',
  ],
  intervalSeconds: 45,
};

export const CHECK_IN_BOT: Tier0Bot = {
  id: 'check-in-bot',
  displayName: 'Check-In Bot',
  messages: [
    'Quick check: Is everyone following along?',
    'React with 👍 if you understand, 🤔 if you have questions!',
    'How is the pace? Too fast, too slow, or just right?',
    'Any topics you\'d like to review?',
    'Take a moment to stretch and stay hydrated!',
  ],
  intervalSeconds: 60,
};

// ============================================================================
// Bot Scheduler
// ============================================================================

interface BotSchedule {
  bot: Tier0Bot;
  nextMessageIndex: number;
  intervalId: number;
  isPaused: boolean;
  sessionId: string;
}

const activeBots = new Map<string, BotSchedule>();

// Grace period after resume before any bot can send (ms)
const RESUME_GRACE_PERIOD = 5000; // 5 seconds
// Random buffer range per bot after grace period (ms)
const MIN_RANDOM_BUFFER = 5000; // 5 seconds
const MAX_RANDOM_BUFFER = 10000; // 10 seconds

/**
 * Start a bot with timed messages
 *
 * @param sessionId - Session ID
 * @param bot - Bot configuration
 * @param customQuestions - Optional custom questions (e.g., from Tier 0.5 AI)
 */
export function startBot(sessionId: string, bot: Tier0Bot, customQuestions?: string[]): void {
  if (activeBots.has(bot.id)) {
    console.warn(`🤖 [Tier 0] Bot ${bot.id} is already running`);
    return;
  }

  // Use custom questions if provided (Tier 0.5), otherwise use bot's default messages
  const messages = customQuestions && customQuestions.length > 0 ? customQuestions : bot.messages;

  if (customQuestions && customQuestions.length > 0) {
    console.log(`🤖 [Tier 0.5] Using ${customQuestions.length} AI-generated questions for ${bot.displayName}`);
  }

  let messageIndex = 0;

  const sendNextMessage = async () => {
    const message = messages[messageIndex];
    console.log(`🤖 [Tier 0] Sending from ${bot.displayName}: "${message}"`);

    try {
      await sendBotMessage(sessionId, message, bot.id, bot.displayName);
      console.log(`✅ [Tier 0] Message sent successfully`);
    } catch (error) {
      console.error(`❌ [Tier 0] Failed to send message:`, error);
    }

    messageIndex = (messageIndex + 1) % messages.length;
  };

  // Send first message immediately
  void sendNextMessage();

  // Schedule subsequent messages
  const intervalId = window.setInterval(() => {
    void sendNextMessage();
  }, bot.intervalSeconds * 1000);

  // Store the bot with its messages (so resume knows what to use)
  const botWithMessages = customQuestions ? { ...bot, messages: customQuestions } : bot;

  activeBots.set(bot.id, {
    bot: botWithMessages,
    nextMessageIndex: 1,
    intervalId,
    isPaused: false,
    sessionId,
  });

  console.log(`🤖 [Tier 0] Started bot: ${bot.displayName} (interval: ${bot.intervalSeconds}s)`);
}

/**
 * Stop a bot
 */
export function stopBot(botId: string): void {
  const schedule = activeBots.get(botId);
  if (!schedule) {
    console.warn(`🤖 [Tier 0] Bot ${botId} is not running`);
    return;
  }

  window.clearInterval(schedule.intervalId);
  activeBots.delete(botId);

  console.log(`🤖 [Tier 0] Stopped bot: ${schedule.bot.displayName}`);
}

/**
 * Stop all bots
 */
export function stopAllBots(): void {
  for (const [botId] of activeBots) {
    stopBot(botId);
  }
  console.log(`🤖 [Tier 0] All bots stopped`);
}

/**
 * Get list of active bots
 */
export function getActiveBots(): Tier0Bot[] {
  return Array.from(activeBots.values()).map((schedule) => schedule.bot);
}

/**
 * Check if a bot is running
 */
export function isBotActive(botId: string): boolean {
  return activeBots.has(botId);
}

/**
 * Start bots with AI-generated questions from session (Tier 0.5)
 *
 * This function loads the approved questions from the session and starts
 * the bots with those questions instead of hardcoded messages.
 *
 * @param sessionId - Session ID
 * @param aiQuestions - AI-generated and teacher-approved questions
 * @param bots - Optional array of bots to start (defaults to all 3 default bots)
 */
export async function startBotsWithAIQuestions(
  sessionId: string,
  aiQuestions: string[],
  bots?: Tier0Bot[]
): Promise<void> {
  const botsToStart = bots || [ENGAGEMENT_BOT, ENCOURAGEMENT_BOT, CHECK_IN_BOT];

  console.log(`🤖 [Tier 0.5] Starting ${botsToStart.length} bots with ${aiQuestions.length} AI questions`);

  // Distribute questions evenly among bots
  const questionsPerBot = Math.ceil(aiQuestions.length / botsToStart.length);

  botsToStart.forEach((bot, index) => {
    const startIndex = index * questionsPerBot;
    const endIndex = Math.min(startIndex + questionsPerBot, aiQuestions.length);
    const botQuestions = aiQuestions.slice(startIndex, endIndex);

    if (botQuestions.length > 0) {
      startBot(sessionId, bot, botQuestions);
    } else {
      console.warn(`🤖 [Tier 0.5] Not enough questions for ${bot.displayName}, skipping`);
    }
  });
}

/**
 * Pause all active bots (stops timers but keeps state)
 */
export function pauseAllBots(): void {
  for (const [botId, schedule] of activeBots) {
    if (!schedule.isPaused) {
      window.clearInterval(schedule.intervalId);
      schedule.isPaused = true;
      console.log(`⏸️ [Tier 0] Paused bot: ${schedule.bot.displayName}`);
    }
  }
  console.log(`⏸️ [Tier 0] All bots paused`);
}

/**
 * Resume all paused bots with grace period + randomized buffer
 */
export function resumeAllBots(): void {
  for (const [botId, schedule] of activeBots) {
    if (schedule.isPaused) {
      // Calculate total delay: grace period + random buffer per bot
      const randomBuffer = MIN_RANDOM_BUFFER + Math.random() * (MAX_RANDOM_BUFFER - MIN_RANDOM_BUFFER);
      const totalDelay = RESUME_GRACE_PERIOD + randomBuffer;

      console.log(
        `▶️ [Tier 0] Resuming bot: ${schedule.bot.displayName} in ${(totalDelay / 1000).toFixed(1)}s ` +
        `(${RESUME_GRACE_PERIOD / 1000}s grace + ${(randomBuffer / 1000).toFixed(1)}s buffer)`
      );

      // Schedule first message after delay
      setTimeout(() => {
        const sendNextMessage = async () => {
          const message = schedule.bot.messages[schedule.nextMessageIndex];
          console.log(`🤖 [Tier 0] Sending from ${schedule.bot.displayName}: "${message}"`);

          try {
            await sendBotMessage(schedule.sessionId, message, schedule.bot.id, schedule.bot.displayName);
            console.log(`✅ [Tier 0] Message sent successfully`);
          } catch (error) {
            console.error(`❌ [Tier 0] Failed to send message:`, error);
          }

          schedule.nextMessageIndex = (schedule.nextMessageIndex + 1) % schedule.bot.messages.length;
        };

        // Send first message
        void sendNextMessage();

        // Resume regular interval
        const intervalId = window.setInterval(() => {
          void sendNextMessage();
        }, schedule.bot.intervalSeconds * 1000);

        schedule.intervalId = intervalId;
        schedule.isPaused = false;
      }, totalDelay);
    }
  }
  console.log(`▶️ [Tier 0] All bots resuming with grace period`);
}
