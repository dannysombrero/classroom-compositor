/**
 * ChatMessage - Individual message display component
 */

import type { ChatMessage as ChatMessageType } from '../../types';
import { formatMessageTime, getSenderDisplayName } from '../../stores/chatStore';
import { useChatStore } from '../../stores/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const currentUserId = useChatStore((state) => state.currentUserId);
  const isOwnMessage = message.senderId === currentUserId;

  // Color scheme based on sender type
  const getMessageStyle = () => {
    if (message.from === 'teacher') {
      return {
        background: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        nameColor: '#60a5fa',
      };
    } else if (message.from === 'bot') {
      return {
        background: 'rgba(147, 51, 234, 0.15)',
        borderColor: 'rgba(147, 51, 234, 0.3)',
        nameColor: '#c084fc',
      };
    } else {
      // student
      return {
        background: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.3)',
        nameColor: '#86efac',
      };
    }
  };

  const style = getMessageStyle();
  const displayName = getSenderDisplayName(message);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 12px',
          background: style.background,
          border: `1px solid ${style.borderColor}`,
          borderRadius: '8px',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        {/* Sender Name */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: style.nameColor,
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {message.from === 'bot' && '🤖'}
          {message.from === 'teacher' && '👨‍🏫'}
          {message.from === 'student' && '👤'}
          {displayName}
          {isOwnMessage && (
            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>(you)</span>
          )}
        </div>

        {/* Message Text */}
        <div
          style={{
            color: '#f5f5f5',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.text}
        </div>

        {/* Timestamp */}
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '6px',
            textAlign: 'right',
          }}
        >
          {formatMessageTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
