/**
 * SourceCitations - 引用来源展示组件
 *
 * 默认折叠，展开后显示文件名、chunk 序号、相似度、文本摘要
 */
import { type ReactNode, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { ChatSource } from '../types';
import './SourceCitations.css';

interface SourceCitationsProps {
  sources: ChatSource[];
  renderSource?: (source: ChatSource) => ReactNode;
}

export function SourceCitations({ sources, renderSource }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="chat-sources">
      <button
        type="button"
        className="chat-sources-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <FileText size={14} />
        <span>引用来源 ({sources.length})</span>
        <ChevronDown
          size={14}
          className={`chat-sources-chevron ${expanded ? 'chat-sources-chevron-open' : ''}`}
        />
      </button>

      {expanded && (
        <div className="chat-sources-list">
          {sources.map((source, i) =>
            renderSource ? (
              renderSource(source)
            ) : (
              <div key={source.chunk_id || i} className="chat-source-card">
                <div className="chat-source-header">
                  <span className="chat-source-filename">{source.filename}</span>
                  {source.chunk_index !== undefined && (
                    <span className="chat-source-chunk">#{source.chunk_index + 1}</span>
                  )}
                  {source.score !== undefined && (
                    <span className="chat-source-score">
                      {(source.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="chat-source-text">{source.text}</p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
