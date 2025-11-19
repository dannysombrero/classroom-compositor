/**
 * ChatInput - Message input component with send button
 */

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = 'Type a message...' }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmedText = text.trim();
    if (trimmedText) {
      onSend(trimmedText);
      setText('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(147, 51, 234, 0.3)',
          borderRadius: '6px',
          color: '#f5f5f5',
          fontSize: '13px',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        style={{
          padding: '8px 16px',
          background: text.trim()
            ? 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)'
            : 'rgba(147, 51, 234, 0.2)',
          color: text.trim() ? 'white' : 'rgba(255, 255, 255, 0.4)',
          border: 'none',
          borderRadius: '6px',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (text.trim()) {
            e.currentTarget.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Send
      </button>
    </div>
  );
}
