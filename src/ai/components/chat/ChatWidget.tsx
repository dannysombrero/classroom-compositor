/**
 * ChatWidget - Reusable chat display component
 *
 * A simple, embeddable chat widget that displays bot messages.
 * Can be used in canvas layers, console panels, or viewer pages.
 * Currently display-only (no user input) for AI bot testing.
 */

import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';

interface ChatWidgetProps {
  sessionId: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  embedded?: boolean; // If true, no border/background (for canvas rendering)
}

export function ChatWidget({
  sessionId,
  width = 380,
  height = 500,
  style = {},
  embedded = false
}: ChatWidgetProps) {
  const messages = useChatStore((state) => state.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const containerStyle: React.CSSProperties = embedded
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }
    : {
        width,
        height,
        background: 'rgba(15, 15, 15, 0.95)',
        border: '1px solid rgba(147, 51, 234, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      {!embedded && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(147, 51, 234, 0.2)',
            background: 'rgba(147, 51, 234, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '20px' }}>💬</span>
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#c084fc',
                  letterSpacing: '0.02em',
                }}
              >
                AI Bot Chat
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.4)',
                }}
              >
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: embedded ? '8px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: embedded ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '14px',
              marginTop: 40,
            }}
          >
            No messages yet. AI bots will appear here.
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer (for future user input) */}
      {!embedded && (
        <div
          style={{
            borderTop: '1px solid rgba(147, 51, 234, 0.2)',
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            Display-only mode (testing AI bots)
          </div>
        </div>
      )}
    </div>
  );
}
