import {
  ArrowLeftOutlined,
  DownloadOutlined,
  ExpandOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Table,
  type TableColumnsType,
  Tabs,
  Tag,
} from 'antd';
import { useMemo, useState } from 'react';
import { useHrWorkflowStore } from '@/stores/hrWorkflowStore';
import { type FrontendPayload, isFrontendPayload } from '@/types/mfAgent';
import { findDeep } from '@/utils/deepSearch';
import { downloadFileFromMF } from '@/utils/fileDownload';
import { getWorkflowFileByName, parseMaybeJson } from '@/utils/workflowFileParser';
import styles from './index.module.css';

type ExpandedView = 'none' | 'entry' | 'training';

// ── 字段适配器：把新工作流字段映射回旧 dataIndex ──

function normalizeEntryRow(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const recruiterKey = String(
    row.recruiter_employee_id ?? row.recruiter_id ?? row.recruiter_name ?? '',
  );
  const monthKey = String(row.latest_calc_month ?? row.calc_month ?? '');
  return {
    key: `${recruiterKey}-${monthKey}-${index}`,
    recruiter_id: (row.recruiter_employee_id ?? row.recruiter_id ?? '') as string,
    hire_date: ((row.recruiter_entry_date ?? row.hire_date) as string) ?? '',
    recruiter_name: ((row.recruiter_name as string) ?? '') as string,
    latest_calc_month: String(row.latest_calc_month ?? row.calc_month ?? ''),
    latest_month_score: row.recent_valid_score ?? row.latest_month_score ?? 0,
    total_score: row.valid_entry_score_total ?? row.total_score ?? 0,
    avg_valid_score: row.valid_entry_score_avg ?? row.avg_valid_score ?? 0,
    maintain_threshold: row.keep_score_standard ?? row.maintain_threshold ?? '',
    upgrade_threshold: row.upgrade_score_standard ?? row.upgrade_threshold ?? '',
    position: ((row.recruiter_position ?? row.position) as string) ?? '',
    excluded_candidates: row.unaccounted_candidate_count ?? row.excluded_candidates ?? 0,
  };
}

function normalizeTrainingRow(
  row: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const recruiterKey = String(
    row.recruiter_employee_id ?? row.recruiter_id ?? row.recruiter_name ?? '',
  );
  const monthKey = String(row.latest_calc_month ?? row.calc_month ?? '');
  return {
    key: `${recruiterKey}-${monthKey}-${index}`,
    recruiter_id: (row.recruiter_employee_id ?? row.recruiter_id ?? '') as string,
    hire_date: ((row.recruiter_entry_date ?? row.hire_date) as string) ?? '',
    recruiter_name: ((row.recruiter_name as string) ?? '') as string,
    latest_calc_month: String(row.latest_calc_month ?? row.calc_month ?? ''),
    latest_month_training: row.recent_valid_training_count ?? row.latest_month_training ?? 0,
    total_training: row.valid_training_total ?? row.total_training ?? 0,
    avg_monthly_training: row.valid_training_avg ?? row.avg_monthly_training ?? 0,
    maintain_threshold: row.keep_training_standard ?? row.maintain_threshold ?? '',
    upgrade_threshold: row.upgrade_training_standard ?? row.upgrade_threshold ?? '',
    position: ((row.recruiter_position ?? row.position) as string) ?? '',
    disputed_candidates: row.dispute_candidate_count ?? row.disputed_candidates ?? 0,
    pending_candidates: row.pending_confirm_candidate_count ?? row.pending_candidates ?? 0,
  };
}

function normalizeExcludedRow(
  row: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const monthKey = String(row.calc_month ?? '');
  const candidateKey = String(
    row.candidate_employee_id ?? row.candidate_id ?? row.candidate_name ?? '',
  );
  return {
    key: `${monthKey}-${candidateKey}-${index}`,
    candidate_id: (row.candidate_employee_id ?? row.candidate_id ?? '') as string,
    candidate_name: ((row.candidate_name as string) ?? '') as string,
    calc_month: String(row.calc_month ?? ''),
    department:
      ((row.candidate_dept ?? row.candidate_department ?? row.department) as string) ?? '',
    start_date: ((row.start_time ?? row.candidate_start_date ?? row.start_date) as string) ?? '',
    leave_reason: ((row.leave_reason ?? row.exclude_reason ?? row.review_reason) as string) ?? '',
  };
}

// ── 稳定排序：按招聘人 → 月份 → 编号 ──

function textOf(value: unknown): string {
  return String(value ?? '').trim();
}

function sortByRecruiterMonth<T extends Record<string, unknown>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aRecruiter = textOf(a.recruiter_name);
    const bRecruiter = textOf(b.recruiter_name);
    if (aRecruiter !== bRecruiter) return aRecruiter.localeCompare(bRecruiter, 'zh-CN');

    const aMonth = textOf(a.latest_calc_month ?? a.calc_month);
    const bMonth = textOf(b.latest_calc_month ?? b.calc_month);
    if (aMonth !== bMonth) return aMonth.localeCompare(bMonth);

    const aId = textOf(a.recruiter_id ?? a.recruiter_employee_id);
    const bId = textOf(b.recruiter_id ?? b.recruiter_employee_id);
    return aId.localeCompare(bId);
  });
}

function sortByCandidateMonth<T extends Record<string, unknown>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aMonth = textOf(a.calc_month ?? a.latest_calc_month);
    const bMonth = textOf(b.calc_month ?? b.latest_calc_month);
    if (aMonth !== bMonth) return aMonth.localeCompare(bMonth);

    const aCandidate = textOf(a.candidate_name);
    const bCandidate = textOf(b.candidate_name);
    if (aCandidate !== bCandidate) return aCandidate.localeCompare(bCandidate, 'zh-CN');

    const aId = textOf(a.candidate_id ?? a.candidate_employee_id);
    const bId = textOf(b.candidate_id ?? b.candidate_employee_id);
    return aId.localeCompare(bId);
  });
}

export default function ScoringPage() {
  const scoringResult = useHrWorkflowStore((s) => s.scoringResult);
  const scoringSession = useHrWorkflowStore((s) => s.scoringSession);
  const [expandedView, setExpandedView] = useState<ExpandedView>('none');

  const output = scoringResult?.output;

  const frontendPayload: FrontendPayload | null = useMemo(() => {
    if (!output) return null;
    const rawFp = output.frontend_payload;
    if (rawFp && typeof rawFp === 'object') {
      return parseMaybeJson(rawFp) as FrontendPayload;
    }
    return findDeep(output, isFrontendPayload, { parseStrings: true });
  }, [output]);

  const tables = frontendPayload?.tables;
  const rawEntryScores: Record<string, unknown>[] =
    tables?.entry_score_rows ??
    (output?.entry_scores as Record<string, unknown>[]) ??
    (output?.scoring_api_result?.entry_scores as Record<string, unknown>[]) ??
    [];
  const entryScores = useMemo(
    () => sortByRecruiterMonth(rawEntryScores.map(normalizeEntryRow)),
    [rawEntryScores],
  );

  const rawTrainingPending: Record<string, unknown>[] =
    tables?.training_check_rows ??
    (output?.training_counts?.pending_review as Record<string, unknown>[]) ??
    (output?.scoring_api_result?.training_counts?.pending_review as Record<string, unknown>[]) ??
    [];
  const trainingPending = useMemo(
    () => sortByRecruiterMonth(rawTrainingPending.map(normalizeTrainingRow)),
    [rawTrainingPending],
  );

  const rawTrainingConfirmed: Record<string, unknown>[] =
    tables?.training_confirm_rows ??
    (output?.training_counts?.confirmed as Record<string, unknown>[]) ??
    (output?.scoring_api_result?.training_counts?.confirmed as Record<string, unknown>[]) ??
    [];
  const trainingConfirmed = useMemo(
    () => sortByRecruiterMonth(rawTrainingConfirmed.map(normalizeTrainingRow)),
    [rawTrainingConfirmed],
  );

  const rawExcludedCandidates: Record<string, unknown>[] =
    tables?.entry_excluded_rows ??
    (output?.excluded_candidates as Record<string, unknown>[]) ??
    (output?.scoring_api_result?.excluded_candidates as Record<string, unknown>[]) ??
    [];
  const excludedCandidates = useMemo(
    () => sortByCandidateMonth(rawExcludedCandidates.map(normalizeExcludedRow)),
    [rawExcludedCandidates],
  );

  const entryScoreFile = getWorkflowFileByName(output, '入职评分文档');
  const trainingFile = getWorkflowFileByName(output, '参培人数文档');

  const tablePagination = {
    defaultPageSize: 10,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
  };

  // 入职评分表格列
  const entryColumns: TableColumnsType = [
    { title: '招聘人职工编号', dataIndex: 'recruiter_id', key: 'recruiter_id', width: 140 },
    { title: '招聘人', dataIndex: 'recruiter_name', key: 'recruiter_name', width: 100 },
    { title: '最近核算月份', dataIndex: 'latest_calc_month', key: 'latest_calc_month', width: 120 },
    {
      title: '最近月有效分',
      dataIndex: 'latest_month_score',
      key: 'latest_month_score',
      width: 120,
      align: 'right',
    },
    {
      title: '有效入职均分',
      dataIndex: 'avg_valid_score',
      key: 'avg_valid_score',
      width: 120,
      align: 'right',
    },
    {
      title: '保级评分',
      dataIndex: 'maintain_threshold',
      key: 'maintain_threshold',
      width: 100,
      align: 'right',
    },
    {
      title: '升级评分',
      dataIndex: 'upgrade_threshold',
      key: 'upgrade_threshold',
      width: 100,
      align: 'right',
    },
  ];

  // 入职评分展开视图列（含更多字段）
  const entryExpandedColumns: TableColumnsType = [
    { title: '招聘人职工编号', dataIndex: 'recruiter_id', key: 'recruiter_id', width: 140 },
    { title: '招聘人入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 130 },
    { title: '招聘人', dataIndex: 'recruiter_name', key: 'recruiter_name', width: 100 },
    { title: '最近核算月份', dataIndex: 'latest_calc_month', key: 'latest_calc_month', width: 120 },
    {
      title: '最近月有效分',
      dataIndex: 'latest_month_score',
      key: 'latest_month_score',
      width: 120,
      align: 'right',
    },
    {
      title: '有效入职总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 120,
      align: 'right',
    },
    {
      title: '有效入职均分',
      dataIndex: 'avg_valid_score',
      key: 'avg_valid_score',
      width: 120,
      align: 'right',
    },
    {
      title: '保级评分',
      dataIndex: 'maintain_threshold',
      key: 'maintain_threshold',
      width: 100,
      align: 'right',
    },
    {
      title: '升级评分',
      dataIndex: 'upgrade_threshold',
      key: 'upgrade_threshold',
      width: 100,
      align: 'right',
    },
    { title: '招聘人职位', dataIndex: 'position', key: 'position', width: 130 },
    {
      title: '未计入候选人',
      dataIndex: 'excluded_candidates',
      key: 'excluded_candidates',
      width: 110,
      align: 'right',
    },
  ];

  // 参培人数表格列
  const trainingColumns: TableColumnsType = [
    { title: '招聘人职工编号', dataIndex: 'recruiter_id', key: 'recruiter_id', width: 140 },
    { title: '招聘人入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 130 },
    { title: '招聘人', dataIndex: 'recruiter_name', key: 'recruiter_name', width: 100 },
    { title: '最近核算月份', dataIndex: 'latest_calc_month', key: 'latest_calc_month', width: 120 },
    {
      title: '最近月有效参培人数',
      dataIndex: 'latest_month_training',
      key: 'latest_month_training',
      width: 150,
      align: 'right',
    },
    {
      title: '总有效参培人数',
      dataIndex: 'total_training',
      key: 'total_training',
      width: 130,
      align: 'right',
    },
    {
      title: '月均有效参培',
      dataIndex: 'avg_monthly_training',
      key: 'avg_monthly_training',
      width: 120,
      align: 'right',
    },
    {
      title: '保级参培',
      dataIndex: 'maintain_threshold',
      key: 'maintain_threshold',
      width: 100,
      align: 'right',
    },
    {
      title: '升级参培',
      dataIndex: 'upgrade_threshold',
      key: 'upgrade_threshold',
      width: 100,
      align: 'right',
    },
    { title: '招聘人职位', dataIndex: 'position', key: 'position', width: 130 },
  ];

  // 待核查数据额外列
  const trainingPendingColumns: TableColumnsType = [
    ...trainingColumns,
    {
      title: '异议候选人',
      dataIndex: 'disputed_candidates',
      key: 'disputed_candidates',
      width: 100,
      align: 'right',
      render: (v: number) => (v > 0 ? <Tag color="warning">{v}</Tag> : v || 0),
    },
    {
      title: '待确认候选人',
      dataIndex: 'pending_candidates',
      key: 'pending_candidates',
      width: 110,
      align: 'right',
      render: (v: number) => (v > 0 ? <Tag color="warning">{v}</Tag> : v || 0),
    },
  ];

  // 未计入候选人表格列
  const excludedColumns: TableColumnsType = [
    { title: '候选人职工编号', dataIndex: 'candidate_id', key: 'candidate_id', width: 140 },
    { title: '候选人姓名', dataIndex: 'candidate_name', key: 'candidate_name', width: 100 },
    { title: '核算月份', dataIndex: 'calc_month', key: 'calc_month', width: 100 },
    { title: '候选人部门', dataIndex: 'department', key: 'department', width: 160 },
    { title: '请假理由', dataIndex: 'leave_reason', key: 'leave_reason', width: 200 },
  ];

  if (!output && !scoringSession.processing.isProcessing) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <Empty description={'暂无计算结果，请先在「文件上传」页面上传文件并开始计算'} />
        </Card>
      </div>
    );
  }

  // 展开视图
  if (expandedView === 'entry') {
    return (
      <div className={styles.container}>
        <Card
          className={styles.card}
          title="入职评分计算"
          extra={
            <Space>
              {entryScoreFile && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFileFromMF(entryScoreFile.fileSn, entryScoreFile.fileName)}
                >
                  下载评分明细表
                </Button>
              )}
              <Button icon={<ArrowLeftOutlined />} onClick={() => setExpandedView('none')}>
                返回双栏视图
              </Button>
            </Space>
          }
        >
          <Tabs
            items={[
              {
                key: 'preview',
                label: '招聘人评分预览',
                children: (
                  <Table
                    size="small"
                    rowKey="key"
                    columns={entryExpandedColumns}
                    dataSource={entryScores}
                    pagination={tablePagination}
                    scroll={{ x: 1200 }}
                  />
                ),
              },
              {
                key: 'excluded',
                label: '未计入候选人',
                children: (
                  <Table
                    size="small"
                    rowKey="key"
                    columns={excludedColumns}
                    dataSource={excludedCandidates}
                    pagination={tablePagination}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    );
  }

  if (expandedView === 'training') {
    return (
      <div className={styles.container}>
        <Card
          className={styles.card}
          title="参培人数筛选"
          extra={
            <Space>
              {trainingFile && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFileFromMF(trainingFile.fileSn, trainingFile.fileName)}
                >
                  下载参培明细表
                </Button>
              )}
              <Button icon={<ArrowLeftOutlined />} onClick={() => setExpandedView('none')}>
                返回双栏视图
              </Button>
            </Space>
          }
        >
          <Tabs
            items={[
              {
                key: 'pending',
                label: '待核查数据',
                children: (
                  <>
                    <Table
                      size="small"
                      rowKey="key"
                      columns={trainingPendingColumns}
                      dataSource={trainingPending}
                      pagination={tablePagination}
                      scroll={{ x: 1200 }}
                    />
                    <div className={styles.legend}>
                      <Space>
                        <WarningOutlined className={styles.warningIcon} />
                        <span>= 需人工跟进</span>
                        <span className={styles.legendNote}>
                          异议说明：同名+同手机号，需人工跟进招聘人关系
                        </span>
                        <span className={styles.legendNote}>
                          待确认说明：参培天数 = 1，需人工跟进是否入职
                        </span>
                      </Space>
                    </div>
                  </>
                ),
              },
              {
                key: 'confirmed',
                label: '确认数据',
                children: (
                  <Table
                    size="small"
                    rowKey="key"
                    columns={trainingColumns}
                    dataSource={trainingConfirmed}
                    pagination={tablePagination}
                    scroll={{ x: 900 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    );
  }

  // 默认双栏视图
  return (
    <div className={styles.container}>
      <Row gutter={16} className={styles.dualColumns}>
        <Col xs={24} lg={12}>
          <Card
            className={styles.dualCard}
            title="入职评分计算"
            extra={
              <Button
                type="text"
                icon={<ExpandOutlined />}
                onClick={() => setExpandedView('entry')}
              >
                展开
              </Button>
            }
          >
            <div className={styles.subtitleRow}>
              <span className={styles.cardSubtitle}>筛选出招聘人有效的入职评分</span>
              {entryScoreFile && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFileFromMF(entryScoreFile.fileSn, entryScoreFile.fileName)}
                >
                  下载评分明细表
                </Button>
              )}
            </div>
            <Tabs
              size="small"
              items={[
                {
                  key: 'preview',
                  label: '招聘人评分预览',
                  children: (
                    <Table
                      size="small"
                      rowKey="key"
                      columns={entryColumns}
                      dataSource={entryScores}
                      pagination={tablePagination}
                      scroll={{ x: 850 }}
                    />
                  ),
                },
                {
                  key: 'excluded',
                  label: '未计入候选人',
                  children: (
                    <Table
                      size="small"
                      rowKey="key"
                      columns={excludedColumns}
                      dataSource={excludedCandidates}
                      pagination={tablePagination}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className={styles.dualCard}
            title="参培人数筛选"
            extra={
              <Button
                type="text"
                icon={<ExpandOutlined />}
                onClick={() => setExpandedView('training')}
              >
                展开
              </Button>
            }
          >
            <div className={styles.subtitleRow}>
              <span className={styles.cardSubtitle}>计算招聘人有效候选人的有效参培人数</span>
              {trainingFile && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFileFromMF(trainingFile.fileSn, trainingFile.fileName)}
                >
                  下载参培明细表
                </Button>
              )}
            </div>
            <Tabs
              size="small"
              items={[
                {
                  key: 'pending',
                  label: '待核查数据',
                  children: (
                    <Table
                      size="small"
                      rowKey="key"
                      columns={trainingColumns}
                      dataSource={trainingPending}
                      pagination={tablePagination}
                      scroll={{ x: 1200 }}
                    />
                  ),
                },
                {
                  key: 'confirmed',
                  label: '确认数据',
                  children: (
                    <Table
                      size="small"
                      rowKey="key"
                      columns={trainingColumns}
                      dataSource={trainingConfirmed}
                      pagination={tablePagination}
                      scroll={{ x: 1200 }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
