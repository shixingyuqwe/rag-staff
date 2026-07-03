import { message as antdMessage } from 'antd';
import { create } from 'zustand';
import {
  MF_LOG_AGENT_SN,
  MF_LOG_VERSION_SN,
  MF_SCORING_AGENT_SN,
  MF_SCORING_VERSION_SN,
} from '@/constants';
import { runWorkflow, uploadFileToMF } from '@/services/mfAgent';
import { getCurrentWecomOperator } from '@/services/wecomIdentity';
import type { ProcessingState, WorkflowResult, WorkflowStreamEvent } from '@/types/mfAgent';
import { showPersistentNotification } from '@/utils/longNotification';
import { generateSessionSn } from '@/utils/sessionUtils';

const THROTTLE_MS = 300;

const initialProcessing: ProcessingState = {
  isProcessing: false,
  sessionSn: null,
  messages: [],
  result: null,
  error: null,
};

interface WorkflowSession {
  uploading: boolean;
  processing: ProcessingState;
  messagesRef: { current: string[] };
  abortControllerRef: { current: (() => void) | null };
  lastUpdateTimeRef: { current: number };
}

const createInitialSession = (): WorkflowSession => ({
  uploading: false,
  processing: { ...initialProcessing },
  messagesRef: { current: [] },
  abortControllerRef: { current: null },
  lastUpdateTimeRef: { current: 0 },
});

// ───────── 月份数据 ─────────

export interface MonthCard {
  id: string;
  year: number;
  month: number;
  files: File[];
  collapsed: boolean;
}

// ───────── 升降级评分 ─────────

interface ScoringSlice {
  monthCards: MonthCard[];
  activeMonthId: string | null;
  scoringSession: WorkflowSession;
  scoringResult: WorkflowResult | null;

  addMonth: () => void;
  removeMonth: (id: string) => void;
  updateMonth: (id: string, year: number, month: number) => void;
  setMonthFiles: (id: string, files: File[]) => void;
  toggleMonthCollapse: (id: string) => void;
  setActiveMonth: (id: string | null) => void;
  startScoring: (allFiles: { monthId: string; files: File[] }[]) => Promise<void>;
  resetScoring: () => void;
}

// ───────── 操作日志 ─────────

interface LogsSlice {
  logsSession: WorkflowSession;
  logsResult: WorkflowResult | null;

  startLogsQuery: (filters?: Record<string, unknown>) => Promise<void>;
  resetLogs: () => void;
}

type HrWorkflowStore = ScoringSlice & LogsSlice;

// ───────── 文件按类型分组 ─────────

type WorkflowDoc = { fileName: string; fileSn: string };

type WorkflowDocGroupKey =
  | 'employee_roster_docs'
  | 'score_detail_docs'
  | 'recruiting_full_docs'
  | 'leave_docs'
  | 'assistant_audit_docs'
  | 'recruiter_master_docs'
  | 'unknown_docs';

function classifyWorkflowDoc(fileName: string): WorkflowDocGroupKey {
  const name = fileName.replace(/\s+/g, '');

  if (name.includes('入职稽查') || name.includes('招聘助理提供')) {
    return 'assistant_audit_docs';
  }
  if (
    name.includes('核算结果') ||
    name.includes('奖金绩效核算') ||
    name.includes('中小社招招聘奖金绩效核算')
  ) {
    return 'recruiter_master_docs';
  }
  if (name.includes('员工花名册')) {
    return 'employee_roster_docs';
  }
  if (name.includes('入职明细') || name.includes('打分制')) {
    return 'score_detail_docs';
  }
  if (name.includes('两个工作日') || name.includes('请假情况') || name.includes('请假人员名单')) {
    return 'leave_docs';
  }
  if (name.includes('招聘_全数据') || name.includes('招聘全数据') || name.includes('全数据')) {
    return 'recruiting_full_docs';
  }
  return 'unknown_docs';
}

function groupWorkflowDocs(files: WorkflowDoc[]): Record<WorkflowDocGroupKey, WorkflowDoc[]> {
  const groups: Record<WorkflowDocGroupKey, WorkflowDoc[]> = {
    employee_roster_docs: [],
    score_detail_docs: [],
    recruiting_full_docs: [],
    leave_docs: [],
    assistant_audit_docs: [],
    recruiter_master_docs: [],
    unknown_docs: [],
  };
  for (const file of files) {
    groups[classifyWorkflowDoc(file.fileName)].push(file);
  }
  return groups;
}

// ───────── 通用的消息节流更新 ─────────

const throttledPushMessage = (
  session: WorkflowSession,
  content: string,
  set: (partial: Partial<HrWorkflowStore>) => void,
  sessionKey: 'scoringSession' | 'logsSession',
) => {
  if (session.messagesRef.current.length >= 50) return;
  session.messagesRef.current.push(content);
  const now = Date.now();
  if (now - session.lastUpdateTimeRef.current >= THROTTLE_MS) {
    session.lastUpdateTimeRef.current = now;
    set({
      [sessionKey]: {
        ...session,
        processing: {
          ...session.processing,
          messages: [...session.messagesRef.current],
        },
      },
    } as unknown as Partial<HrWorkflowStore>);
  }
};

// ───────── 月份工具函数 ─────────

function generateMonthId(): string {
  return `month-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultMonth(): MonthCard {
  const now = new Date();
  return {
    id: generateMonthId(),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    files: [],
    collapsed: false,
  };
}

export const useHrWorkflowStore = create<HrWorkflowStore>((set, get) => ({
  // ────────────────── 升降级评分 ──────────────────
  monthCards: [getDefaultMonth()],
  activeMonthId: null,
  scoringSession: createInitialSession(),
  scoringResult: null,

  addMonth: () => {
    const { monthCards } = get();
    const last = monthCards[monthCards.length - 1];
    let nextYear = last?.year ?? new Date().getFullYear();
    let nextMonth = (last?.month ?? 0) + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    set({
      monthCards: [
        ...monthCards,
        {
          id: generateMonthId(),
          year: nextYear,
          month: nextMonth,
          files: [],
          collapsed: false,
        },
      ],
    });
  },

  removeMonth: (id) => {
    const { monthCards } = get();
    set({ monthCards: monthCards.filter((m) => m.id !== id) });
  },

  updateMonth: (id, year, month) => {
    const { monthCards } = get();
    set({
      monthCards: monthCards.map((m) => (m.id === id ? { ...m, year, month } : m)),
    });
  },

  setMonthFiles: (id, files) => {
    const { monthCards } = get();
    set({
      monthCards: monthCards.map((m) => (m.id === id ? { ...m, files } : m)),
    });
  },

  toggleMonthCollapse: (id) => {
    const { monthCards } = get();
    set({
      monthCards: monthCards.map((m) => (m.id === id ? { ...m, collapsed: !m.collapsed } : m)),
    });
  },

  setActiveMonth: (id) => set({ activeMonthId: id }),

  startScoring: async (allFiles) => {
    const state = get();
    const session = state.scoringSession;
    if (session.uploading || session.processing.isProcessing) return;

    session.messagesRef.current = [];
    session.abortControllerRef.current = null;
    session.lastUpdateTimeRef.current = 0;

    set({
      scoringSession: {
        ...session,
        uploading: true,
        processing: { ...initialProcessing },
      },
      scoringResult: null,
    });

    try {
      antdMessage.loading({ content: '正在上传文件到 AI 平台...', key: 'upload' });
      const operator = await getCurrentWecomOperator();

      // 上传所有月份的文件
      const uploadResults = await Promise.all(
        allFiles.flatMap(({ monthId, files }) =>
          files.map((file) => uploadFileToMF(file).then((r) => ({ monthId, ...r }))),
        ),
      );

      antdMessage.success({
        content: `已上传 ${uploadResults.length} 个文件！`,
        key: 'upload',
        duration: 2,
      });

      const sessionSn = generateSessionSn();
      const currentSession = get().scoringSession;
      currentSession.messagesRef.current = ['🚀 开始升降级评分计算...'];
      set({
        scoringSession: {
          ...currentSession,
          processing: {
            isProcessing: true,
            sessionSn,
            messages: ['🚀 开始升降级评分计算...'],
            result: null,
            error: null,
          },
        },
      });

      const workflowDocs = uploadResults.map((r) => ({
        fileName: r.fileName,
        fileSn: r.fileSn,
      }));
      const docGroups = groupWorkflowDocs(workflowDocs);
      const selectedMonths = get()
        .monthCards.filter((m: MonthCard) => m.files.length > 0)
        .map((m: MonthCard) => `${m.year}${String(m.month).padStart(2, '0')}`)
        .join(',');

      const abort = await runWorkflow(
        {
          agentSn: MF_SCORING_AGENT_SN,
          versionSn: MF_SCORING_VERSION_SN,
          sessionSn,
          user: {
            operator_name: operator.name,
            selected_months: selectedMonths,
            employee_roster_docs: docGroups.employee_roster_docs,
            score_detail_docs: docGroups.score_detail_docs,
            recruiting_full_docs: docGroups.recruiting_full_docs,
            leave_docs: docGroups.leave_docs,
            assistant_audit_docs: docGroups.assistant_audit_docs,
            recruiter_master_docs: docGroups.recruiter_master_docs,
          },
        },
        {
          onMessage: (content) => {
            const st = get();
            throttledPushMessage(st.scoringSession, content, set, 'scoringSession');
          },
          onProgress: (_event: WorkflowStreamEvent) => {
            // no-op
          },
          onComplete: (result: WorkflowResult) => {
            const st = get();
            const s = st.scoringSession;
            s.messagesRef.current = [];
            s.abortControllerRef.current = null;
            set({
              scoringResult: result,
              scoringSession: {
                ...s,
                processing: {
                  ...s.processing,
                  isProcessing: false,
                  result,
                  messages: [],
                },
              },
            });
            showPersistentNotification(
              'success',
              '升降级评分计算完成',
              'AI 已完成升降级评分计算，请查看结果。',
              'scoring-success',
            );
          },
          onError: (error) => {
            const st = get();
            const s = st.scoringSession;
            s.abortControllerRef.current = null;
            set({
              scoringSession: {
                ...s,
                processing: {
                  ...s.processing,
                  isProcessing: false,
                  error: error.message,
                  messages: [...s.messagesRef.current],
                },
              },
            });
            showPersistentNotification(
              'error',
              '升降级评分计算失败',
              `处理失败: ${error.message}`,
              'scoring-error',
            );
          },
        },
      );

      const st = get();
      st.scoringSession.abortControllerRef.current = abort;
      set({ scoringSession: { ...st.scoringSession } });
    } catch (error) {
      console.error('上传失败:', error);
      const st = get();
      set({
        scoringSession: {
          ...st.scoringSession,
          processing: {
            ...st.scoringSession.processing,
            isProcessing: false,
            error: error instanceof Error ? error.message : '上传失败',
          },
        },
      });
      antdMessage.error({
        content: error instanceof Error ? error.message : '上传失败',
        key: 'upload',
      });
    } finally {
      const st = get();
      set({
        scoringSession: { ...st.scoringSession, uploading: false },
      });
    }
  },

  resetScoring: () => {
    const st = get();
    if (st.scoringSession.abortControllerRef.current) {
      st.scoringSession.abortControllerRef.current();
    }
    set({
      scoringSession: createInitialSession(),
      scoringResult: null,
    });
  },

  // ────────────────── 操作日志 ──────────────────
  logsSession: createInitialSession(),
  logsResult: null,

  startLogsQuery: async (filters) => {
    const state = get();
    const session = state.logsSession;
    if (session.processing.isProcessing) return;

    session.messagesRef.current = [];
    session.abortControllerRef.current = null;
    session.lastUpdateTimeRef.current = 0;

    set({
      logsSession: {
        ...session,
        processing: { ...initialProcessing, isProcessing: true },
      },
      logsResult: null,
    });

    const sessionSn = generateSessionSn();
    const currentSession = get().logsSession;

    const abort = await runWorkflow(
      {
        agentSn: MF_LOG_AGENT_SN,
        versionSn: MF_LOG_VERSION_SN,
        sessionSn,
        user: filters ?? {},
      },
      {
        onComplete: (result: WorkflowResult) => {
          const st = get();
          const s = st.logsSession;
          s.messagesRef.current = [];
          s.abortControllerRef.current = null;
          set({
            logsResult: result,
            logsSession: {
              ...s,
              processing: {
                ...s.processing,
                isProcessing: false,
                result,
                messages: [],
              },
            },
          });
        },
        onError: (error) => {
          const st = get();
          const s = st.logsSession;
          s.abortControllerRef.current = null;
          set({
            logsSession: {
              ...s,
              processing: {
                ...s.processing,
                isProcessing: false,
                error: error.message,
                messages: [],
              },
            },
          });
        },
      },
    );

    currentSession.abortControllerRef.current = abort;
    set({ logsSession: { ...currentSession } });
  },

  resetLogs: () => {
    const st = get();
    if (st.logsSession.abortControllerRef.current) {
      st.logsSession.abortControllerRef.current();
    }
    set({
      logsSession: createInitialSession(),
      logsResult: null,
    });
  },
}));
