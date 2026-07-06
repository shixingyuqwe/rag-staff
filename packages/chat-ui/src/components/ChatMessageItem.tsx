/**
 * ChatMessageItem - 单条消息组件
 *
 * 包含：
 * - 消息气泡（用户右侧 / 助手左侧）
 * - 事件标记（检索中/命中/完成等）
 * - 引用来源
 * - 重试按钮（错误时）
 */
import { type ReactNode } from 'react';
import { AlertCircle, RotateCcw, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage, ChatSource, ChatEvent } from '../types';
import { SourceCitations } from './SourceCitations';
import { ChatMarker } from './ChatMarker';
import './ChatMessageItem.css';

interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry?: (messageId: string) => void;
  renderSource?: (source: ChatSource) => ReactNode;
  renderEvent?: (event: ChatEvent) => ReactNode;
}

export function ChatMessageItem({
  message,
  onRetry,
  renderSource,
  renderEvent,
}: ChatMessageItemProps) {
  const { role, content, status, sources, events } = message;
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-assistant'}`}>
      {!isUser && events && events.length > 0 && (
        <div className="chat-msg-events">
          {events.map((evt) =>
            renderEvent ? renderEvent(evt) : <ChatMarker key={evt.id} type={evt.type} label={evt.label} status={evt.status} />,
          )}
        </div>
      )}

      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
        <div className="chat-bubble-content">
          {content ? (
            <div className="chat-bubble-text">{content}</div>
          ) : status === 'streaming' ? (
            <div className="chat-bubble-typing">
              <span /><span /><span />
            </div>
          ) : null}
        </div>

        {!isUser && content && (
          <div className="chat-bubble-actions">
            <button
              type="button"
              className="chat-action-btn"
              onClick={handleCopy}
              aria-label="复制"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div className="chat-msg-error">
          <AlertCircle size={14} />
          <span>生成失败</span>
          {onRetry && (
            <button
              type="button"
              className="chat-retry-btn"
              onClick={() => onRetry(message.id)}
            >
              <RotateCcw size={13} />
              重试
            </button>
          )}
        </div>
      )}

      {!isUser && sources && sources.length > 0 && (
        <SourceCitations sources={sources} renderSource={renderSource} />
      )}
    </div>
  );
}
