/**
 * Chat Service - Firebase integration for real-time chat
 *
 * Handles sending, receiving, and syncing chat messages via Firestore
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useChatStore, createChatMessage } from '../stores/chatStore';
import type { ChatMessage } from '../types';

// ============================================================================
// Firestore Data Types
// ============================================================================

interface ChatMessageDoc {
  sessionId: string;
  text: string;
  from: 'teacher' | 'student' | 'bot';
  senderId?: string;
  senderName?: string;
  timestamp: Timestamp;
  botId?: string;
}

// ============================================================================
// Send Message
// ============================================================================

/**
 * Send a chat message to Firestore
 */
export async function sendChatMessage(
  sessionId: string,
  text: string,
  from: 'teacher' | 'student' | 'bot',
  senderId?: string,
  senderName?: string,
  botId?: string
): Promise<void> {
  try {
    const messagesRef = collection(db, 'sessions', sessionId, 'chat');

    const messageDoc: ChatMessageDoc = {
      sessionId,
      text,
      from,
      senderId,
      senderName,
      timestamp: Timestamp.now(),
      botId,
    };

    await addDoc(messagesRef, messageDoc);
    console.log('💬 [Chat] Message sent:', text.substring(0, 50));
  } catch (error) {
    console.error('❌ [Chat] Failed to send message:', error);
    throw error;
  }
}

// ============================================================================
// Subscribe to Messages
// ============================================================================

/**
 * Subscribe to real-time chat updates for a session
 */
export function subscribeToChatMessages(
  sessionId: string,
  messageLimit: number = 100
): Unsubscribe {
  const messagesRef = collection(db, 'sessions', sessionId, 'chat');
  const q = query(
    messagesRef,
    where('sessionId', '==', sessionId),
    orderBy('timestamp', 'asc'),
    limit(messageLimit)
  );

  console.log('💬 [Chat] Subscribing to messages for session:', sessionId);

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as ChatMessageDoc;
        messages.push({
          id: doc.id,
          sessionId: data.sessionId,
          text: data.text,
          from: data.from,
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp.toMillis(),
          botId: data.botId,
        });
      });

      // Update store with all messages
      useChatStore.getState().setMessages(messages);
      console.log(`💬 [Chat] Received ${messages.length} message(s)`);
    },
    (error) => {
      console.error('❌ [Chat] Error subscribing to messages:', error);
    }
  );
}

// ============================================================================
// Chat Integration Hook
// ============================================================================

/**
 * Initialize chat for a session
 */
export function initializeChat(
  sessionId: string,
  userId: string,
  userName: string,
  role: 'teacher' | 'student'
): Unsubscribe {
  // Set current user in chat store
  useChatStore.getState().setCurrentUser(userId, userName, role);

  // Subscribe to messages
  const unsubscribe = subscribeToChatMessages(sessionId);

  console.log('💬 [Chat] Initialized for user:', userName, 'role:', role);

  return unsubscribe;
}

/**
 * Send a message from the current user
 */
export async function sendMessageAsCurrentUser(
  sessionId: string,
  text: string
): Promise<void> {
  const state = useChatStore.getState();

  if (!state.currentUserId || !state.currentUserName || !state.currentUserRole) {
    console.error('❌ [Chat] Cannot send message - user not set');
    return;
  }

  await sendChatMessage(
    sessionId,
    text,
    state.currentUserRole,
    state.currentUserId,
    state.currentUserName
  );
}

/**
 * Send a message from a bot
 */
export async function sendBotMessage(
  sessionId: string,
  text: string,
  botId: string,
  botName: string
): Promise<void> {
  await sendChatMessage(sessionId, text, 'bot', botId, botName, botId);
}
