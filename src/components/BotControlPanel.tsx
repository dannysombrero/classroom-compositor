/**
 * BotControlPanel - Development panel for testing AI bots
 *
 * Allows starting/stopping Tier 0 bots for testing the chat system
 */

import { useState } from 'react';
import {
  startBot,
  stopBot,
  stopAllBots,
  isBotActive,
  ENGAGEMENT_BOT,
  ENCOURAGEMENT_BOT,
  CHECK_IN_BOT,
  type Tier0Bot
} from '../ai';
import { useSessionStore } from '../stores/sessionStore';

const AVAILABLE_BOTS: Tier0Bot[] = [
  ENGAGEMENT_BOT,
  ENCOURAGEMENT_BOT,
  CHECK_IN_BOT,
];

export function BotControlPanel() {
  const session = useSessionStore((state) => state.session);
  const [activeBots, setActiveBots] = useState<Set<string>>(new Set());

  if (!session?.id) {
    return null;
  }

  const toggleBot = (bot: Tier0Bot) => {
    const isActive = activeBots.has(bot.id);

    if (isActive) {
      stopBot(bot.id);
      setActiveBots((prev) => {
        const next = new Set(prev);
        next.delete(bot.id);
        return next;
      });
    } else {
      startBot(session.id, bot);
      setActiveBots((prev) => new Set(prev).add(bot.id));
    }
  };

  const handleStopAll = () => {
    stopAllBots();
    setActiveBots(new Set());
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 9998,
        background: 'rgba(15, 15, 15, 0.95)',
        border: '1px solid rgba(147, 51, 234, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        padding: '16px',
        minWidth: 280,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#c084fc',
            marginBottom: '4px',
          }}
        >
          🤖 Bot Control (Tier 0)
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
          Test pre-scripted bot messages
        </div>
      </div>

      {/* Bot List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {AVAILABLE_BOTS.map((bot) => {
          const isActive = activeBots.has(bot.id);

          return (
            <button
              key={bot.id}
              onClick={() => toggleBot(bot)}
              style={{
                padding: '10px 12px',
                background: isActive
                  ? 'rgba(147, 51, 234, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isActive
                  ? '1px solid rgba(147, 51, 234, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#f5f5f5',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {isActive ? '🟢' : '⚪'} {bot.displayName}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                {bot.messages.length} messages • {bot.intervalSeconds}s interval
              </div>
            </button>
          );
        })}
      </div>

      {/* Stop All Button */}
      {activeBots.size > 0 && (
        <button
          onClick={handleStopAll}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '8px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
        >
          Stop All Bots
        </button>
      )}
    </div>
  );
}
