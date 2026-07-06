/**
 * ChatMarker - 状态标记组件
 *
 * 用于展示：正在检索/命中N条/生成中/完成/错误 等状态
 */
import {
  Search,
  CheckCircle,
  Loader2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import './ChatMarker.css';

interface ChatMarkerProps {
  type: string;
  label: string;
  status?: 'running' | 'done' | 'error';
}

const TYPE_ICON: Record<string, typeof Search> = {
  retrieving: Search,
  found: CheckCircle,
  generating: Loader2,
  done: CheckCircle,
  no_results: XCircle,
  error: AlertCircle,
};

const TYPE_STATUS: Record<string, 'running' | 'done' | 'error'> = {
  retrieving: 'running',
  found: 'done',
  generating: 'running',
  done: 'done',
  no_results: 'error',
  error: 'error',
};

export function ChatMarker({ type, label, status }: ChatMarkerProps) {
  const Icon = TYPE_ICON[type] || Loader2;
  const markerStatus = status || TYPE_STATUS[type] || 'running';

  return (
    <div className={`chat-marker chat-marker-${markerStatus}`}>
      <Icon
        size={14}
        className={markerStatus === 'running' ? 'chat-marker-spin' : ''}
      />
      <span className="chat-marker-label">{label}</span>
    </div>
  );
}
