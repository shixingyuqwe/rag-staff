/**
 * ChatPanel - 聊天面板主组件
 *
 * 包含消息列表、输入框、推荐问题、状态标记
 * 业务项目只需传入 messages/status/onSend 等 props
 */
import { type ReactNode } from 'react';
import type {
  ChatMessage,
  ChatStatus,
  ChatSource,
  ChatEvent,
  ChatSuggestion,
} from '../types';
import { ChatMessageList } from './ChatMessageList';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatComposer } from './ChatComposer';
import { ChatMarker } from './ChatMarker';
import './ChatPanel.css';

export interface ChatPanelProps {
  title?: string;
  description?: string;
  messages: ChatMessage[];
  status: ChatStatus;
  suggestions?: ChatSuggestion[];
  placeholder?: string;
  onSend: (content: string) => void | Promise<void>;
  onStop?: () => void;
  onRetry?: (messageId: string) => void;
  onClear?: () => void;
  renderSource?: (source: ChatSource) => ReactNode;
  renderEvent?: (event: ChatEvent) => ReactNode;
}

export function ChatPanel({
  title,
  description,
  messages,
  status,
  suggestions,
  placeholder = '输入消息...',
  onSend,
  onStop,
  onRetry,
  onClear,
  renderSource,
  renderEvent,
}: ChatPanelProps) {
  const isEmpty = messages.length === 0;

  return (
    <div className="chat-panel">
      {(title || description) && (
        <div className="chat-panel-header">
          {title && <h2 className="chat-panel-title">{title}</h2>}
          {description && <p className="chat-panel-desc">{description}</p>}
        </div>
      )}

      <div className="chat-panel-body">
        {isEmpty && suggestions && suggestions.length > 0 ? (
          <div className="chat-suggestions">
            <p className="chat-suggestions-label">推荐问题</p>
            <div className="chat-suggestions-grid">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="chat-suggestion-btn"
                  onClick={() => onSend(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ChatMessageList messages={messages} status={status}>
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onRetry={onRetry}
              renderSource={renderSource}
              renderEvent={renderEvent}
            />
          ))}
        </ChatMessageList>

        {status === 'streaming' && messages.length > 0 && (
          <ChatMarker type="generating" label="正在生成..." />
        )}
      </div>

      <ChatComposer
        status={status}
        placeholder={placeholder}
        onSend={onSend}
        onStop={onStop}
        onClear={onClear}
      />
    </div>
  );
}
