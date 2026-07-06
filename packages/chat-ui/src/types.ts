/**
 * 聊天组件公共类型定义
 * 这些类型不包含任何业务逻辑，可跨项目复用
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error';

export interface ChatSource {
  id?: string;
  chunk_id?: string;
  filename: string;
  text: string;
  score?: number;
  chunk_index?: number;
}

export interface ChatEvent {
  id: string;
  type: string;
  label: string;
  status?: 'running' | 'done' | 'error';
  payload?: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status?: 'streaming' | 'done' | 'error';
  sources?: ChatSource[];
  events?: ChatEvent[];
  createdAt: number;
}

export interface ChatSuggestion {
  label: string;
  value: string;
}
