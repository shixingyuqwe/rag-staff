/**
 * Policy Chat 业务类型
 * 与 RAG 后端 SSE 事件格式对应
 */

export interface PolicyChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
  sources?: PolicySource[];
  events?: PolicyEvent[];
  createdAt: number;
}

export interface PolicySource {
  chunk_id: string;
  filename: string;
  text: string;
  score: number;
  chunk_index: number;
}

export interface PolicyEvent {
  id: string;
  type: string;
  label: string;
  status?: 'running' | 'done' | 'error';
}
