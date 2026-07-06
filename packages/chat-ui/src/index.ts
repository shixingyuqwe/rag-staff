/**
 * @hr-rag/chat-ui - 公共聊天组件包
 *
 * 导出所有聊天组件和类型
 * 业务项目只需 import { ChatPanel, ChatMessage, ... } from '@hr-rag/chat-ui'
 */

// 组件
export { ChatPanel } from './components/ChatPanel';
export type { ChatPanelProps } from './components/ChatPanel';

export { ChatMessageList } from './components/ChatMessageList';
export { ChatMessageItem } from './components/ChatMessageItem';
export { ChatComposer } from './components/ChatComposer';
export { ChatMarker } from './components/ChatMarker';
export { SourceCitations } from './components/SourceCitations';

// 类型
export type {
  ChatRole,
  ChatStatus,
  ChatSource,
  ChatEvent,
  ChatMessage,
  ChatSuggestion,
} from './types';
