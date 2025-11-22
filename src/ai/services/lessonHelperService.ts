/**
 * Tier 0.5 - AI Lesson Helper Service
 *
 * Pre-session AI endpoints for generating keywords and expected student questions
 * based on teacher's lesson description.
 */

import type {
  GenerateKeywordsRequest,
  GenerateKeywordsResponse,
  GenerateQuestionsRequest,
  GenerateQuestionsResponse,
  SetupAIRequest,
  SetupAIResponse,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

// For now, we'll use mock implementations that return realistic data
// In production, these would call actual LLM endpoints
const USE_MOCK_AI = true;

// Backend API base URL (to be configured based on environment)
const API_BASE_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:3000/api';

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Generate relevant keywords from a lesson description
 *
 * Tier 0.5 - Pre-session AI endpoint
 */
export async function generateKeywords(
  lessonDescription: string
): Promise<string[]> {
  if (USE_MOCK_AI) {
    return mockGenerateKeywords(lessonDescription);
  }

  const request: GenerateKeywordsRequest = {
    lessonDescription,
  };

  const response = await fetch(`${API_BASE_URL}/ai/generate-keywords`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate keywords: ${response.statusText}`);
  }

  const data: GenerateKeywordsResponse = await response.json();
  return data.keywords;
}

/**
 * Generate expected student questions based on lesson description and keywords
 *
 * Tier 0.5 - Pre-session AI endpoint
 */
export async function generateQuestions(
  lessonDescription: string,
  keywords: string[]
): Promise<string[]> {
  if (USE_MOCK_AI) {
    return mockGenerateQuestions(lessonDescription, keywords);
  }

  const request: GenerateQuestionsRequest = {
    lessonDescription,
    keywords,
  };

  const response = await fetch(`${API_BASE_URL}/ai/generate-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate questions: ${response.statusText}`);
  }

  const data: GenerateQuestionsResponse = await response.json();
  return data.expectedQuestions;
}

/**
 * Save teacher-approved keywords and questions to session
 *
 * Tier 0.5 - Session setup endpoint
 */
export async function setupSessionAI(
  sessionId: string,
  aiKeywords: string[],
  aiQuestions: string[]
): Promise<boolean> {
  // For now, we'll store in Firestore directly
  // In production, this would call a backend endpoint that validates and stores
  const { setSessionAIConfig } = await import('./firestoreSessionService');

  await setSessionAIConfig(sessionId, {
    aiKeywords,
    aiQuestions,
  });

  return true;
}

// ============================================================================
// Mock AI Implementations (for development/testing)
// ============================================================================

/**
 * Mock keyword generation using simple heuristics
 */
function mockGenerateKeywords(lessonDescription: string): Promise<string[]> {
  console.log('[Mock AI] Generating keywords for:', lessonDescription.substring(0, 50) + '...');

  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simple keyword extraction based on common lesson topics
      const keywords: string[] = [];

      // Tech/Programming lessons
      if (/\b(code|coding|program|javascript|python|function|variable)\b/i.test(lessonDescription)) {
        keywords.push('function', 'variable', 'debugging', 'syntax', 'code structure');
      }

      // 3D Modeling lessons
      if (/\b(3d|model|blender|mesh|extrude|vertex)\b/i.test(lessonDescription)) {
        keywords.push('extrude', 'mesh', 'vertex', 'modifier', 'material');
      }

      // Math lessons
      if (/\b(math|algebra|equation|solve|calculate)\b/i.test(lessonDescription)) {
        keywords.push('equation', 'variable', 'solve', 'graph', 'formula');
      }

      // Design lessons
      if (/\b(design|ui|ux|layout|color|typography)\b/i.test(lessonDescription)) {
        keywords.push('layout', 'color theory', 'typography', 'hierarchy', 'contrast');
      }

      // Science lessons
      if (/\b(science|experiment|hypothesis|lab|observe)\b/i.test(lessonDescription)) {
        keywords.push('hypothesis', 'experiment', 'variable', 'observation', 'conclusion');
      }

      // If no specific topic detected, use generic educational keywords
      if (keywords.length === 0) {
        keywords.push('concept', 'example', 'practice', 'application', 'understanding');
      }

      console.log('[Mock AI] Generated keywords:', keywords);
      resolve(keywords.slice(0, 8)); // Return max 8 keywords
    }, 1500); // Simulate 1.5s API call
  });
}

/**
 * Mock question generation based on keywords
 */
function mockGenerateQuestions(
  lessonDescription: string,
  keywords: string[]
): Promise<string[]> {
  console.log('[Mock AI] Generating questions for keywords:', keywords);

  return new Promise((resolve) => {
    setTimeout(() => {
      const questions: string[] = [];

      // Generate clarifying questions for each keyword
      keywords.forEach((keyword, index) => {
        if (index < 5) { // Limit to 5 questions max
          // Create student-appropriate clarifying questions
          const templates = [
            `Can you explain ${keyword} again?`,
            `Could you show an example of ${keyword}?`,
            `How do you use ${keyword} in practice?`,
            `What's the difference between ${keyword} and related concepts?`,
            `When should we apply ${keyword}?`,
          ];

          const template = templates[index % templates.length];
          questions.push(template);
        }
      });

      // Add a general question
      if (questions.length < 5) {
        questions.push('Can you clarify that last part?');
      }

      console.log('[Mock AI] Generated questions:', questions);
      resolve(questions);
    }, 2000); // Simulate 2s API call
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate lesson description
 */
export function validateLessonDescription(description: string): {
  valid: boolean;
  error?: string;
} {
  if (!description || description.trim().length === 0) {
    return { valid: false, error: 'Lesson description cannot be empty' };
  }

  if (description.trim().length < 10) {
    return {
      valid: false,
      error: 'Lesson description must be at least 10 characters',
    };
  }

  if (description.length > 1000) {
    return {
      valid: false,
      error: 'Lesson description must be less than 1000 characters',
    };
  }

  return { valid: true };
}

/**
 * Validate keywords array
 */
export function validateKeywords(keywords: string[]): {
  valid: boolean;
  error?: string;
} {
  if (!keywords || keywords.length === 0) {
    return { valid: false, error: 'Must have at least one keyword' };
  }

  if (keywords.length > 15) {
    return { valid: false, error: 'Too many keywords (max 15)' };
  }

  // Check for empty keywords
  if (keywords.some((k) => !k || k.trim().length === 0)) {
    return { valid: false, error: 'Keywords cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validate questions array
 */
export function validateQuestions(questions: string[]): {
  valid: boolean;
  error?: string;
} {
  if (!questions || questions.length === 0) {
    return { valid: false, error: 'Must have at least one question' };
  }

  if (questions.length > 20) {
    return { valid: false, error: 'Too many questions (max 20)' };
  }

  // Check for empty questions
  if (questions.some((q) => !q || q.trim().length === 0)) {
    return { valid: false, error: 'Questions cannot be empty' };
  }

  return { valid: true };
}
