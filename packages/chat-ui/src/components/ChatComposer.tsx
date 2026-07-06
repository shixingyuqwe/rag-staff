/**
 * ChatComposer - 聊天输入框组件
 *
 * 特性：
 * - Enter 发送
 * - Shift+Enter 换行
 * - 生成中显示停止按钮
 * - 生成中禁用重复提交
 * - 可选清除按钮
 */
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Square, Trash2 } from 'lucide-react';
import type { ChatStatus } from '../types';
import './ChatComposer.css';

interface ChatComposerProps {
  status: ChatStatus;
  placeholder?: string;
  onSend: (content: string) => void | Promise<void>;
  onStop?: () => void;
  onClear?: () => void;
}

export function ChatComposer({
  status,
  placeholder = '输入消息...',
  onSend,
  onStop,
  onClear,
}: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === 'streaming' || status === 'submitted';

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="chat-composer">
      <div className="chat-composer-inner">
        <textarea
          ref={textareaRef}
          className="chat-composer-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isStreaming}
        />
        <div className="chat-composer-actions">
          {onClear && (
            <button
              type="button"
              className="chat-composer-btn chat-composer-clear"
              onClick={onClear}
              aria-label="清除对话"
            >
              <Trash2 size={16} />
            </button>
          )}
          {isStreaming && onStop ? (
            <button
              type="button"
              className="chat-composer-btn chat-composer-stop"
              onClick={onStop}
              aria-label="停止生成"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="chat-composer-btn chat-composer-send"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="发送"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
