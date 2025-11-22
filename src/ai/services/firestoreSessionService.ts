/**
 * Firestore Session Service - Session AI Configuration Storage
 *
 * Handles storing and retrieving AI-generated keywords and questions
 * for Tier 0.5 functionality.
 */

import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// ============================================================================
// Types
// ============================================================================

export type SessionAIConfig = {
  lessonDescription?: string;
  aiKeywords?: string[];
  aiQuestions?: string[];
  generatedAt?: number;
  approvedAt?: number;
};

// ============================================================================
// Session AI Configuration
// ============================================================================

/**
 * Store AI-generated and teacher-approved content for a session
 */
export async function setSessionAIConfig(
  sessionId: string,
  config: SessionAIConfig
): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);

  try {
    // Update the session document with AI config
    await updateDoc(sessionRef, {
      aiConfig: {
        ...config,
        approvedAt: Date.now(),
      },
    });

    console.log(`✅ [Session AI] Saved config for session: ${sessionId}`);
  } catch (error) {
    // If session doesn't exist yet, create it
    if ((error as any).code === 'not-found') {
      await setDoc(
        sessionRef,
        {
          sessionId,
          aiConfig: {
            ...config,
            approvedAt: Date.now(),
          },
          createdAt: Date.now(),
        },
        { merge: true }
      );

      console.log(`✅ [Session AI] Created session with AI config: ${sessionId}`);
    } else {
      throw error;
    }
  }
}

/**
 * Get AI configuration for a session
 */
export async function getSessionAIConfig(
  sessionId: string
): Promise<SessionAIConfig | null> {
  const sessionRef = doc(db, 'sessions', sessionId);

  try {
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return data.aiConfig || null;
  } catch (error) {
    console.error(`❌ [Session AI] Failed to get config for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Store lesson description (before generating keywords/questions)
 */
export async function saveLessonDescription(
  sessionId: string,
  lessonDescription: string
): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);

  try {
    await updateDoc(sessionRef, {
      'aiConfig.lessonDescription': lessonDescription,
      'aiConfig.generatedAt': Date.now(),
    });

    console.log(`✅ [Session AI] Saved lesson description for: ${sessionId}`);
  } catch (error) {
    // If session doesn't exist, create it
    if ((error as any).code === 'not-found') {
      await setDoc(
        sessionRef,
        {
          sessionId,
          aiConfig: {
            lessonDescription,
            generatedAt: Date.now(),
          },
          createdAt: Date.now(),
        },
        { merge: true }
      );

      console.log(`✅ [Session AI] Created session with lesson description: ${sessionId}`);
    } else {
      throw error;
    }
  }
}
