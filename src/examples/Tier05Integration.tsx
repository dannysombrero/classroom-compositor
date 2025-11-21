/**
 * Tier 0.5 Integration Example
 *
 * Shows how to integrate AI Lesson Helper into the presenter workflow.
 * This example demonstrates the complete flow from lesson setup to bot activation.
 */

import { useState, useEffect } from 'react';
import {
  LessonHelperPanel,
  getSessionAIConfig,
  startBotsWithAIQuestions,
  startBot,
  ENGAGEMENT_BOT,
  ENCOURAGEMENT_BOT,
  CHECK_IN_BOT,
} from '../ai';
import type { SessionAIConfig } from '../ai/services/firestoreSessionService';

interface Tier05IntegrationExampleProps {
  sessionId: string;
  onBotsStarted: () => void;
}

/**
 * Example integration showing Tier 0.5 workflow in presenter page
 */
export function Tier05IntegrationExample({
  sessionId,
  onBotsStarted,
}: Tier05IntegrationExampleProps) {
  const [step, setStep] = useState<'setup' | 'ready' | 'live'>('setup');
  const [aiConfig, setAIConfig] = useState<SessionAIConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if session already has AI config
  useEffect(() => {
    loadAIConfig();
  }, [sessionId]);

  const loadAIConfig = async () => {
    setLoading(true);
    try {
      const config = await getSessionAIConfig(sessionId);
      if (config && config.aiQuestions && config.aiQuestions.length > 0) {
        setAIConfig(config);
        setStep('ready');
        console.log('✅ AI config loaded from session');
      } else {
        setStep('setup');
        console.log('📝 No AI config found, showing setup');
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
      setStep('setup');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonSetupComplete = (keywords: string[], questions: string[]) => {
    setAIConfig({
      aiKeywords: keywords,
      aiQuestions: questions,
      approvedAt: Date.now(),
    });
    setStep('ready');
    console.log('✅ Lesson setup complete!', { keywords, questions });
  };

  const handleSkipSetup = () => {
    setStep('ready');
    console.log('⏩ Skipped AI setup, will use Tier 0 fallback');
  };

  const handleStartBots = async () => {
    setStep('live');

    if (aiConfig?.aiQuestions && aiConfig.aiQuestions.length > 0) {
      // Tier 0.5: Use AI-generated questions
      console.log('🤖 Starting bots with AI questions (Tier 0.5)');
      await startBotsWithAIQuestions(sessionId, aiConfig.aiQuestions);
    } else {
      // Tier 0 fallback: Use hardcoded messages
      console.log('🤖 Starting bots with default messages (Tier 0 fallback)');
      startBot(sessionId, ENGAGEMENT_BOT);
      startBot(sessionId, ENCOURAGEMENT_BOT);
      startBot(sessionId, CHECK_IN_BOT);
    }

    onBotsStarted();
  };

  const handleEditSetup = () => {
    setStep('setup');
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Step 1: AI Lesson Setup */}
      {step === 'setup' && (
        <div style={styles.setupStep}>
          <LessonHelperPanel
            sessionId={sessionId}
            onComplete={handleLessonSetupComplete}
            onCancel={handleSkipSetup}
          />

          <div style={styles.hint}>
            💡 <strong>Tip:</strong> Setting up AI questions makes your bots ask relevant,
            lesson-specific questions instead of generic messages.
          </div>
        </div>
      )}

      {/* Step 2: Ready to Start */}
      {step === 'ready' && (
        <div style={styles.readyStep}>
          <div style={styles.card}>
            <h2 style={styles.title}>Ready to Start Session</h2>

            {aiConfig?.aiQuestions && aiConfig.aiQuestions.length > 0 ? (
              <div style={styles.aiSummary}>
                <div style={styles.successBadge}>
                  ✅ AI Setup Complete
                </div>

                <div style={styles.summarySection}>
                  <h3 style={styles.summaryTitle}>
                    Keywords ({aiConfig.aiKeywords?.length || 0})
                  </h3>
                  <div style={styles.keywordList}>
                    {aiConfig.aiKeywords?.map((keyword, i) => (
                      <span key={i} style={styles.keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={styles.summarySection}>
                  <h3 style={styles.summaryTitle}>
                    Bot Questions ({aiConfig.aiQuestions.length})
                  </h3>
                  <ul style={styles.questionList}>
                    {aiConfig.aiQuestions.slice(0, 3).map((q, i) => (
                      <li key={i} style={styles.question}>
                        {q}
                      </li>
                    ))}
                    {aiConfig.aiQuestions.length > 3 && (
                      <li style={styles.question}>
                        + {aiConfig.aiQuestions.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>

                <button onClick={handleEditSetup} style={styles.editButton}>
                  ✏️ Edit Setup
                </button>
              </div>
            ) : (
              <div style={styles.fallbackNotice}>
                <div style={styles.warningBadge}>
                  ⚠️ No AI Setup
                </div>
                <p style={styles.fallbackText}>
                  Bots will use default messages (Tier 0 mode).
                </p>
                <button onClick={handleEditSetup} style={styles.setupButton}>
                  🤖 Setup AI Questions
                </button>
              </div>
            )}

            <div style={styles.actions}>
              <button onClick={handleStartBots} style={styles.startButton}>
                {aiConfig?.aiQuestions
                  ? '🚀 Start Session with AI Bots'
                  : '▶️ Start Session (Default Bots)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Live */}
      {step === 'live' && (
        <div style={styles.liveStep}>
          <div style={styles.liveIndicator}>
            <span style={styles.liveDot} />
            <span>Bots Active</span>
          </div>
          <p style={styles.liveText}>
            {aiConfig?.aiQuestions
              ? `Bots are using ${aiConfig.aiQuestions.length} AI-generated questions`
              : 'Bots are using default messages'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 900,
    margin: '0 auto',
    padding: 20,
  },

  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 40,
    color: '#c084fc',
  },

  spinner: {
    width: 40,
    height: 40,
    border: '4px solid rgba(147, 51, 234, 0.2)',
    borderTop: '4px solid #9333ea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  setupStep: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  hint: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#93c5fd',
  },

  readyStep: {
    display: 'flex',
    justifyContent: 'center',
  },

  card: {
    background: '#1a1a1a',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },

  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#c084fc',
    margin: '0 0 20px',
  },

  aiSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  successBadge: {
    display: 'inline-block',
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#86efac',
    fontSize: 14,
    fontWeight: 600,
    alignSelf: 'flex-start',
  },

  warningBadge: {
    display: 'inline-block',
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 600,
    alignSelf: 'flex-start',
  },

  summarySection: {
    marginTop: 8,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#c084fc',
    marginBottom: 8,
  },

  keywordList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },

  keyword: {
    background: 'rgba(147, 51, 234, 0.2)',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    color: '#e9d5ff',
  },

  questionList: {
    margin: 0,
    padding: '0 0 0 20px',
    color: '#d4d4d4',
  },

  question: {
    fontSize: 13,
    marginBottom: 6,
  },

  editButton: {
    background: 'transparent',
    color: '#c084fc',
    border: '1px solid rgba(147, 51, 234, 0.4)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
    marginTop: 8,
  },

  fallbackNotice: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: 8,
  },

  fallbackText: {
    fontSize: 14,
    color: '#d4d4d4',
    margin: 0,
  },

  setupButton: {
    background: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid rgba(147, 51, 234, 0.2)',
  },

  startButton: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  liveStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 40,
  },

  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: 999,
    padding: '8px 16px',
    color: '#86efac',
    fontSize: 14,
    fontWeight: 600,
  },

  liveDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#10b981',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },

  liveText: {
    fontSize: 13,
    color: '#a3a3a3',
  },
};
