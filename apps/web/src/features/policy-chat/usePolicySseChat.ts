/**
 * usePolicySseChat - 制度问答 SSE 流式 Hook
 *
 * 职责：
 * - 维护 messages 列表
 * - 维护 status（idle / submitted / streaming / error）
 * - 调用 /api/chat/stream 接口
 * - 解析 SSE 事件（marker / sources / delta / done / error）
 * - 支持 AbortController 停止生成
 */
import { useCallback, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { RAG_API_BASE } from '@/constants';
import type { PolicyChatMessage, PolicySource, PolicyEvent } from './types';

type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error';

let messageIdCounter = 0;
function genId() {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

export function usePolicySseChat() {
  const [messages, setMessages] = useState<PolicyChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (content: string) => {
    // 添加用户消息
    const userMsg: PolicyChatMessage = {
      id: genId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    // 创建助手消息占位
    const assistantMsg: PolicyChatMessage = {
      id: genId(),
      role: 'assistant',
      content: '',
      status: 'streaming',
      sources: [],
      events: [],
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStatus('submitted');

    // 创建 AbortController
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let accContent = '';
    let accSources: PolicySource[] = [];
    let accEvents: PolicyEvent[] = [];
    let eventIdCounter = 0;

    try {
      await fetchEventSource(`${RAG_API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          top_k: 5,
        }),
        signal: ctrl.signal,

        onopen: async (response) => {
          if (!response.ok || !response.body) {
            throw new Error(`HTTP ${response.status}`);
          }
          setStatus('streaming');
        },

        onmessage: (event) => {
          const { data } = event;
          if (!data) return;

          try {
            const parsed = JSON.parse(data);

            switch (event.event) {
              case 'marker': {
                const evt: PolicyEvent = {
                  id: `evt_${++eventIdCounter}`,
                  type: parsed.type,
                  label: parsed.label,
                  status: parsed.type === 'generating' || parsed.type === 'retrieving'
                    ? 'running'
                    : parsed.type === 'error' || parsed.type === 'no_results'
                      ? 'error'
                      : 'done',
                };
                accEvents = [...accEvents, evt];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, events: accEvents } : m,
                  ),
                );
                break;
              }

              case 'sources': {
                accSources = parsed.sources || [];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, sources: accSources } : m,
                  ),
                );
                break;
              }

              case 'delta': {
                accContent += parsed.text || '';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: accContent, status: 'streaming' as const }
                      : m,
                  ),
                );
                break;
              }

              case 'done': {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: accContent, status: 'done' as const, sources: accSources, events: accEvents }
                      : m,
                  ),
                );
                setStatus('idle');
                break;
              }

              case 'error': {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          content: accContent || parsed.message || '未知错误',
                          status: 'error' as const,
                          events: accEvents,
                        }
                      : m,
                  ),
                );
                setStatus('error');
                break;
              }
            }
          } catch {
            // JSON 解析失败，忽略
          }
        },

        onerror: (err) => {
          // 如果是用户主动中止，不报错
          if (ctrl.signal.aborted) {
            setStatus('idle');
            return;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: accContent || '连接中断，请重试',
                    status: 'error' as const,
                  }
                : m,
            ),
          );
          setStatus('error');
          // 停止重试
          throw err;
        },

        onclose: () => {
          // 如果还没收到 done 事件，标记为完成
          setStatus((prev) => (prev === 'streaming' || prev === 'submitted') ? 'idle' : prev);
        },
      });
    } catch (err: unknown) {
      if (ctrl.signal.aborted) {
        setStatus('idle');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : '请求失败';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accContent || errorMessage, status: 'error' as const }
            : m,
        ),
      );
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // 将正在流式输出的消息标记为完成
    setMessages((prev) =>
      prev.map((m) =>
        m.status === 'streaming' ? { ...m, status: 'done' as const } : m,
      ),
    );
    setStatus('idle');
  }, []);

  const retry = useCallback(
    (messageId: string) => {
      // 找到错误消息之前的用户消息
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx <= 0) return;
      const userMsg = messages[idx - 1];
      if (userMsg.role !== 'user') return;

      // 删除错误消息
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      // 重新发送
      send(userMsg.content);
    },
    [messages, send],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStatus('idle');
  }, []);

  return {
    messages,
    status,
    send,
    stop,
    retry,
    clear,
  };
}
