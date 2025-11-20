/**
 * Lesson Helper Panel - Tier 0.5 AI Setup UI
 *
 * Allows teachers to:
 * 1. Enter lesson description
 * 2. Generate keywords and questions using AI
 * 3. Review and edit generated content
 * 4. Approve and save to session
 */

import { useState } from 'react';
import {
  generateKeywords,
  generateQuestions,
  setupSessionAI,
  validateLessonDescription,
  validateKeywords,
  validateQuestions,
} from '../services/lessonHelperService';
import { saveLessonDescription } from '../services/firestoreSessionService';

interface LessonHelperPanelProps {
  sessionId: string;
  onComplete: (keywords: string[], questions: string[]) => void;
  onCancel?: () => void;
}

type Step = 'description' | 'generating' | 'review' | 'saving' | 'complete';

export function LessonHelperPanel({ sessionId, onComplete, onCancel }: LessonHelperPanelProps) {
  const [step, setStep] = useState<Step>('description');
  const [lessonDescription, setLessonDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleGenerate = async () => {
    // Validate lesson description
    const validation = validateLessonDescription(lessonDescription);
    if (!validation.valid) {
      setError(validation.error || 'Invalid lesson description');
      return;
    }

    setError(null);
    setStep('generating');

    try {
      // Save lesson description
      await saveLessonDescription(sessionId, lessonDescription);

      // Generate keywords
      console.log('🤖 Generating keywords...');
      const generatedKeywords = await generateKeywords(lessonDescription);
      setKeywords(generatedKeywords);

      // Generate questions
      console.log('🤖 Generating questions...');
      const generatedQuestions = await generateQuestions(lessonDescription, generatedKeywords);
      setQuestions(generatedQuestions);

      setStep('review');
    } catch (err) {
      console.error('Failed to generate AI content:', err);
      setError('Failed to generate keywords and questions. Please try again.');
      setStep('description');
    }
  };

  const handleApprove = async () => {
    // Validate before saving
    const keywordValidation = validateKeywords(keywords);
    if (!keywordValidation.valid) {
      setError(keywordValidation.error || 'Invalid keywords');
      return;
    }

    const questionValidation = validateQuestions(questions);
    if (!questionValidation.valid) {
      setError(questionValidation.error || 'Invalid questions');
      return;
    }

    setError(null);
    setStep('saving');

    try {
      await setupSessionAI(sessionId, keywords, questions);
      setStep('complete');
      onComplete(keywords, questions);
    } catch (err) {
      console.error('Failed to save AI config:', err);
      setError('Failed to save configuration. Please try again.');
      setStep('review');
    }
  };

  const handleRegenerate = () => {
    setStep('description');
    setError(null);
  };

  const handleAddKeyword = () => {
    setKeywords([...keywords, '']);
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleUpdateKeyword = (index: number, value: string) => {
    const updated = [...keywords];
    updated[index] = value;
    setKeywords(updated);
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, '']);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.title}>🤖 AI Lesson Helper</h2>
        <p style={styles.subtitle}>Tier 0.5 - Pre-Session Setup</p>
      </div>

      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {/* Step 1: Lesson Description */}
      {step === 'description' && (
        <div style={styles.content}>
          <label style={styles.label}>
            Describe your lesson:
            <textarea
              value={lessonDescription}
              onChange={(e) => setLessonDescription(e.target.value)}
              placeholder="e.g., Introduction to 3D modeling in Blender. Students will learn how to use basic tools like extrude, loop cut, and modifiers to create a simple 3D object."
              style={styles.textarea}
              rows={6}
            />
          </label>

          <div style={styles.hint}>
            The AI will generate relevant keywords and expected student questions based on your description.
          </div>

          <div style={styles.actions}>
            {onCancel && (
              <button onClick={onCancel} style={styles.secondaryButton}>
                Cancel
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={lessonDescription.trim().length < 10}
              style={{
                ...styles.primaryButton,
                opacity: lessonDescription.trim().length < 10 ? 0.5 : 1,
              }}
            >
              🤖 Generate Keywords & Questions
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 'generating' && (
        <div style={styles.content}>
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p>Generating keywords and questions...</p>
            <p style={styles.loadingHint}>This may take a few seconds</p>
          </div>
        </div>
      )}

      {/* Step 3: Review & Edit */}
      {step === 'review' && (
        <div style={styles.content}>
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Keywords ({keywords.length})</h3>
              <button onClick={handleAddKeyword} style={styles.addButton}>
                + Add
              </button>
            </div>

            <div style={styles.list}>
              {keywords.map((keyword, index) => (
                <div key={index} style={styles.listItem}>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => handleUpdateKeyword(index, e.target.value)}
                    style={styles.input}
                    placeholder="Enter keyword"
                  />
                  <button
                    onClick={() => handleRemoveKeyword(index)}
                    style={styles.removeButton}
                    title="Remove keyword"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Expected Questions ({questions.length})</h3>
              <button onClick={handleAddQuestion} style={styles.addButton}>
                + Add
              </button>
            </div>

            <div style={styles.list}>
              {questions.map((question, index) => (
                <div key={index} style={styles.listItem}>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => handleUpdateQuestion(index, e.target.value)}
                    style={styles.input}
                    placeholder="Enter question"
                  />
                  <button
                    onClick={() => handleRemoveQuestion(index)}
                    style={styles.removeButton}
                    title="Remove question"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.actions}>
            <button onClick={handleRegenerate} style={styles.secondaryButton}>
              ← Back to Description
            </button>
            <button
              onClick={handleApprove}
              style={styles.primaryButton}
              disabled={keywords.length === 0 || questions.length === 0}
            >
              ✅ Approve & Save
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Saving */}
      {step === 'saving' && (
        <div style={styles.content}>
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p>Saving configuration...</p>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div style={styles.content}>
          <div style={styles.success}>
            <div style={styles.successIcon}>✅</div>
            <h3>AI Setup Complete!</h3>
            <p>
              Your bots will use these {questions.length} questions during the session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#1a1a1a',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 12,
    padding: 24,
    color: '#eaeaea',
    maxWidth: 700,
    margin: '0 auto',
  },

  header: {
    marginBottom: 24,
    borderBottom: '1px solid rgba(147, 51, 234, 0.2)',
    paddingBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: '#c084fc',
  },

  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    margin: '4px 0 0',
  },

  error: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: 12,
    color: '#fca5a5',
    marginBottom: 16,
    fontSize: 14,
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
  },

  textarea: {
    background: '#0a0a0a',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 8,
    padding: 12,
    color: '#eaeaea',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 120,
  },

  input: {
    flex: 1,
    background: '#0a0a0a',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#eaeaea',
    fontSize: 13,
  },

  hint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },

  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  primaryButton: {
    background: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    background: 'transparent',
    color: '#c084fc',
    border: '1px solid rgba(147, 51, 234, 0.4)',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '40px 20px',
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

  loadingHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    color: '#c084fc',
  },

  addButton: {
    background: 'rgba(147, 51, 234, 0.2)',
    color: '#c084fc',
    border: '1px solid rgba(147, 51, 234, 0.3)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  listItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },

  removeButton: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },

  success: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: '40px 20px',
    textAlign: 'center',
  },

  successIcon: {
    fontSize: 48,
  },
};

// Add keyframe animation for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
