/**
 * ChatMessageList - 消息列表组件
 *
 * 特性：
 * - 自动滚动到底部（新消息时）
 * - 用户主动上滑时不强制拉到底部
 * - 显示"回到底部"按钮
 */
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ArrowDown } from 'lucide-react';
import type { ChatMessage, ChatStatus } from '../types';
import './ChatMessageList.css';

interface ChatMessageListProps {
  messages: ChatMessage[];
  status: ChatStatus;
  children: ReactNode;
}

export function ChatMessageList({ messages, status, children }: ChatMessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const userScrolledUp = useRef(false);

  // 检测用户是否手动上滑
  const handleScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 80;
    userScrolledUp.current = !isNearBottom;
    setShowScrollBtn(!isNearBottom);
  };

  // 新消息时自动滚动（仅在用户没有主动上滑时）
  useEffect(() => {
    if (userScrolledUp.current) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const scrollToBottom = () => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    userScrolledUp.current = false;
    setShowScrollBtn(false);
  };

  return (
    <div className="chat-message-list">
      <div
        ref={viewportRef}
        className="chat-message-viewport"
        onScroll={handleScroll}
      >
        <div className="chat-message-content">
          {children}
        </div>
      </div>

      {showScrollBtn && (
        <button
          type="button"
          className="chat-scroll-btn"
          onClick={scrollToBottom}
          aria-label="回到底部"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
