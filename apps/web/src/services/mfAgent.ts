import { fetchEventSource } from '@microsoft/fetch-event-source';
import ky from 'ky';
import { MF_API_BASE, MF_API_TOKEN, MF_SCORING_AGENT_SN, MF_SCORING_VERSION_SN } from '@/constants';
import type {
  ScoringResult,
  StreamCallbacks,
  WorkflowParams,
  WorkflowStreamEvent,
  WorkflowVariable,
} from '@/types/mfAgent';
import { VariableType, isScoringResult } from '@/types/mfAgent';
import { findDeep } from '@/utils/deepSearch';

/**
 * 上传文件到 MarketingForce 平台
 */
export async function uploadFileToMF(file: File): Promise<MFFileUploadResponse['data']> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await ky
    .post(`${MF_API_BASE}/open/v1/file/upload`, {
      body: formData,
      headers: {
        'X-API-TOKEN': MF_API_TOKEN,
      },
    })
    .json<MFFileUploadResponse>();

  if (response.code !== 0 || !response.success) {
    throw new Error(response.message || '文件上传失败');
  }

  return response.data;
}

interface MFFileUploadResponse {
  code: number;
  success: boolean;
  data: {
    fileSn: string;
    fileName: string;
    fileType: string;
    fileSize: string;
  };
  message: string;
}

/**
 * 执行工作流（流式响应）
 */
export async function runWorkflow(
  params: WorkflowParams,
  callbacks: StreamCallbacks,
): Promise<() => void> {
  const { fileSn, fileName, sessionSn, agentSn, versionSn, user } = params;
  const { onMessage, onProgress, onComplete, onError } = callbacks;

  const resolvedAgentSn = agentSn ?? MF_SCORING_AGENT_SN;
  const resolvedVersionSn = versionSn ?? MF_SCORING_VERSION_SN;
  const resolvedUser = {
    ...(fileName && fileSn ? {
      输入文档: {
        fileName,
        fileSn,
      },
    } : {}),
    ...(user ?? {}),
  };

  const controller = new AbortController();
  const variablesMap = new Map<string, WorkflowVariable>();
  let completed = false;
  let capturedScoring: ScoringResult | null = null;

  fetchEventSource(`${MF_API_BASE}/open/v1/workflow/run/${resolvedAgentSn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-TOKEN': MF_API_TOKEN,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      versionSn: resolvedVersionSn,
      stream: true,
      sessionSn,
      user: resolvedUser,
    }),
    signal: controller.signal,
    openWhenHidden: true,

    async onopen(response) {
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        throw new Error('响应不是流式格式');
      }
    },

    onmessage(event) {
      try {
        const data = event.data;

        if (data === '[DONE]') {
          if (!completed) {
            const output: Record<string, any> = {};
            variablesMap.forEach((variable) => {
              output[variable.id] = variable.currentValue;
              if (variable.name) {
                output[variable.name] = variable.currentValue;
              }
            });
            if (capturedScoring) {
              output.scoring_api_result = capturedScoring;
            }
            onComplete?.({ output });
          }
          return;
        }

        const sseEvent = JSON.parse(data) as WorkflowStreamEvent;

        if (!capturedScoring) {
          capturedScoring = findDeep(sseEvent.data, isScoringResult);
        }

        if (sseEvent.event === 'workflow.message') {
          const variable = sseEvent.data as WorkflowVariable;
          const key = `${variable.id}_${sseEvent.messageId}`;

          const existing = variablesMap.get(key);
          if (existing) {
            if (variable.isArray) {
              existing.currentValue = [
                ...(existing.currentValue || []),
                ...(variable.currentValue || []),
              ];
            } else if (variable.type === 'TEXT' || variable.type === VariableType.TEXT) {
              existing.currentValue = (existing.currentValue || '') + (variable.currentValue || '');
            } else {
              existing.currentValue = variable.currentValue;
            }
          } else {
            variablesMap.set(key, { ...variable });
          }

          onProgress?.(sseEvent);

          if (variable.name && variable.currentValue) {
            const displayValue =
              typeof variable.currentValue === 'string'
                ? variable.currentValue
                : Array.isArray(variable.currentValue)
                  ? `[${variable.currentValue.length} 项]`
                  : JSON.stringify(variable.currentValue);

            if (displayValue.length < 100) {
              onMessage?.(`📊 ${variable.name}: ${displayValue}`);
            }
          }
        } else if (sseEvent.event === 'agent.execution.started') {
          onProgress?.(sseEvent);
          onMessage?.('🚀 AI Agent 开始执行');
        } else if (sseEvent.event === 'node.execution.started') {
          onProgress?.(sseEvent);
          const nodeName = sseEvent.data?.title || sseEvent.nodeId || '未知节点';
          onMessage?.(`⚙️ ${nodeName}`);
        } else if (sseEvent.event === 'agent.execution.completed') {
          if (!completed) {
            completed = true;
            onProgress?.(sseEvent);
            onMessage?.('✅ 执行完成');
            const result = (sseEvent.data || {}) as Record<string, any>;

            if (result.output && typeof result.output === 'object') {
              variablesMap.forEach((variable) => {
                if (variable.name && !(variable.name in result.output)) {
                  result.output[variable.name] = variable.currentValue;
                }
              });
            }

            if (capturedScoring) {
              result.output = {
                ...(result.output || {}),
                scoring_api_result: capturedScoring,
              };
            }
            onComplete?.(result);
          }
        } else if (sseEvent.event === 'agent.execution.failed' || sseEvent.event === 'error') {
          const errorMsg = sseEvent.data?.errorMsg || sseEvent.data?.message || '工作流执行失败';
          onError?.(new Error(errorMsg));
        } else {
          onProgress?.(sseEvent);
        }
      } catch (err) {
        console.warn('解析 SSE 事件失败:', event.data, err);
      }
    },

    onerror(err) {
      console.error('SSE 连接错误:', err);
      onError?.(err instanceof Error ? err : new Error('SSE 连接失败'));
      throw err;
    },
  }).catch((error) => {
    if (error.name !== 'AbortError') {
      onError?.(error instanceof Error ? error : new Error('未知错误'));
    }
  });

  return () => {
    controller.abort();
  };
}
