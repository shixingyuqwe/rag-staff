/**
 * PolicyChat 页面 - 制度问答
 *
 * 职责：
 * - 调用 usePolicySseChat hook
 * - 组织页面标题和说明
 * - 渲染 ChatPanel
 * - 提供推荐问题和来源定制
 */
import { ChatPanel } from '@hr-rag/chat-ui';
import type { ChatSource } from '@hr-rag/chat-ui';
import { FileText } from 'lucide-react';
import { usePolicySseChat } from '@/features/policy-chat/usePolicySseChat';
import styles from './index.module.css';

const SUGGESTIONS = [
  { label: 'P2-1 招聘专员升级标准是什么？', value: 'P2-1 招聘专员升级标准是什么？' },
  { label: 'P1-3 招聘专员保级标准是什么？', value: 'P1-3 招聘专员保级标准是什么？' },
  { label: '哪些情况需要人工复核？', value: '哪些情况需要人工复核？' },
  { label: '招聘专员和猎头是否使用同一套标准？', value: '招聘专员和猎头是否使用同一套标准？' },
];

function DefaultSourceCard({ source }: { source: ChatSource }) {
  return (
    <div className={styles.sourceCard}>
      <div className={styles.sourceHeader}>
        <FileText size={13} className={styles.sourceIcon} />
        <span className={styles.sourceFilename}>{source.filename}</span>
        {source.chunk_index !== undefined && (
          <span className={styles.sourceChunk}>#{source.chunk_index + 1}</span>
        )}
        {source.score !== undefined && (
          <span className={styles.sourceScore}>{(source.score * 100).toFixed(0)}%</span>
        )}
      </div>
      <p className={styles.sourceText}>{source.text}</p>
    </div>
  );
}

export default function PolicyChatPage() {
  const { messages, status, send, stop, retry, clear } = usePolicySseChat();

  return (
    <div className={styles.page}>
      <ChatPanel
        title="制度问答"
        description="基于知识库中的人事制度文档，智能回答您的制度相关问题"
        messages={messages}
        status={status}
        suggestions={SUGGESTIONS}
        placeholder="输入制度相关问题..."
        onSend={send}
        onStop={stop}
        onRetry={retry}
        onClear={clear}
        renderSource={(source) => <DefaultSourceCard source={source} />}
      />
    </div>
  );
}
