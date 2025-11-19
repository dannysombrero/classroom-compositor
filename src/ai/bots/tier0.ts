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
}

const activeBots = new Map<string, BotSchedule>();

/**
 * Start a bot with timed messages
 */
export function startBot(sessionId: string, bot: Tier0Bot): void {
  if (activeBots.has(bot.id)) {
    console.warn(`🤖 [Tier 0] Bot ${bot.id} is already running`);
    return;
  }

  let messageIndex = 0;

  const sendNextMessage = async () => {
    const message = bot.messages[messageIndex];
    console.log(`🤖 [Tier 0] Sending from ${bot.displayName}: "${message}"`);

    try {
      await sendBotMessage(sessionId, message, bot.id, bot.displayName);
      console.log(`✅ [Tier 0] Message sent successfully`);
    } catch (error) {
      console.error(`❌ [Tier 0] Failed to send message:`, error);
    }

    messageIndex = (messageIndex + 1) % bot.messages.length;
  };

  // Send first message immediately
  void sendNextMessage();

  // Schedule subsequent messages
  const intervalId = window.setInterval(() => {
    void sendNextMessage();
  }, bot.intervalSeconds * 1000);

  activeBots.set(bot.id, {
    bot,
    nextMessageIndex: 1,
    intervalId,
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
