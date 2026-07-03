import { DownloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
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

// 字段适配器：把新工作流字段映射回旧 dataIndex
function normalizeAssessmentRow(row: Record<string, unknown>, index: number) {
  const recruiterKey = String(
    row.recruiter_employee_id ?? row.recruiter_id ?? row.recruiter_name ?? '',
  );
  const monthKey = String(row.latest_calc_month ?? row.calc_month ?? '');
  return {
    key: `${recruiterKey}-${monthKey}-${index}`,
    recruiter_id: (row.recruiter_employee_id ?? row.recruiter_id ?? '') as string,
    hire_date: ((row.recruiter_entry_date ?? row.hire_date) as string) ?? '-',
    recruiter_name: ((row.recruiter_name as string) ?? '') as string,
    position: ((row.recruiter_position ?? row.position) as string) ?? '-',
    latest_calc_month: String(row.latest_calc_month ?? row.calc_month ?? ''),
    latest_month_score: row.recent_valid_score ?? row.latest_month_score ?? 0,
    total_score: row.valid_entry_score_total ?? row.total_score ?? '-',
    avg_valid_score: row.valid_entry_score_avg ?? row.avg_valid_score ?? 0,
    maintain_score: row.keep_score_standard ?? row.maintain_threshold ?? row.maintain_score ?? 0,
    upgrade_score: row.upgrade_score_standard ?? row.upgrade_threshold ?? row.upgrade_score ?? 0,
    latest_month_training: row.recent_valid_training_count ?? row.latest_month_training ?? '-',
    total_training: row.valid_training_total ?? row.total_training ?? '-',
    avg_monthly_training: row.valid_training_avg ?? row.avg_monthly_training ?? '-',
    maintain_training: row.keep_training_standard ?? row.maintain_training ?? '-',
    upgrade_training: row.upgrade_training_standard ?? row.upgrade_training ?? '-',
    needs_review: row.need_review ?? row.needs_review ?? false,
    review_count: row.need_review_count ?? row.review_count ?? 0,
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

export default function AssessmentPage() {
  const scoringResult = useHrWorkflowStore((s) => s.scoringResult);
  const output = scoringResult?.output;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [positionFilter, setPositionFilter] = useState<string>('全部');
  const [reviewFilter, setReviewFilter] = useState<string>('全部');
  const [keyword, setKeyword] = useState('');

  const frontendPayload: FrontendPayload | null = useMemo(() => {
    if (!output) return null;
    const rawFp = output.frontend_payload;
    if (rawFp && typeof rawFp === 'object') {
      return parseMaybeJson(rawFp) as FrontendPayload;
    }
    return findDeep(output, isFrontendPayload, { parseStrings: true });
  }, [output]);

  const dashboard = frontendPayload?.dashboard;
  const assessmentRows = frontendPayload?.tables?.assessment_rows ?? [];

  const oldSummary = output?.summary ?? output?.scoring_api_result?.summary ?? {};
  const summary = {
    total_assessed:
      dashboard?.recruiter_count ?? dashboard?.participant_count ?? oldSummary.total_assessed ?? 0,
    needs_review_count: dashboard?.need_review_count ?? oldSummary.needs_review_count ?? 0,
    score_compliance_rate: dashboard?.score_pass_rate ?? oldSummary.score_compliance_rate ?? 0,
    training_compliance_rate:
      dashboard?.training_pass_rate ?? oldSummary.training_compliance_rate ?? 0,
  };

  const oldEntryScores = output?.entry_scores ?? output?.scoring_api_result?.entry_scores ?? [];
  const oldTrainingCounts: Record<string, unknown> =
    output?.training_counts ?? output?.scoring_api_result?.training_counts ?? {};
  const oldTrainingConfirmed =
    (oldTrainingCounts.confirmed as Array<Record<string, unknown>>) ?? [];

  const mergedData = useMemo(() => {
    if (assessmentRows.length > 0) {
      return sortByRecruiterMonth(assessmentRows.map(normalizeAssessmentRow));
    }

    const trainingMap = new Map(oldTrainingConfirmed.map((t) => [t.recruiter_id, t]));

    return sortByRecruiterMonth(
      oldEntryScores.map((entry: Record<string, unknown>, index: number) => {
        const training: Record<string, unknown> = trainingMap.get(entry.recruiter_id) ?? {};
        const needsReview =
          ((training.disputed_candidates as number) ?? 0) > 0 ||
          ((training.pending_candidates as number) ?? 0) > 0;
        const recruiterKey = String(entry.recruiter_id ?? entry.recruiter_name ?? '');
        const monthKey = String(entry.latest_calc_month ?? entry.calc_month ?? '');
        return {
          key: `${recruiterKey}-${monthKey}-${index}`,
          recruiter_id: entry.recruiter_id,
          hire_date: (entry.hire_date as string) ?? '-',
          recruiter_name: entry.recruiter_name,
          position: (entry.position as string) ?? '-',
          latest_calc_month: String(entry.latest_calc_month ?? entry.calc_month ?? ''),
          latest_month_score: entry.latest_month_score,
          total_score: entry.total_score ?? '-',
          avg_valid_score: entry.avg_valid_score,
          maintain_score: entry.maintain_threshold,
          upgrade_score: entry.upgrade_threshold,
          latest_month_training: training.latest_month_training ?? '-',
          avg_monthly_training: training.avg_monthly_training ?? '-',
          maintain_training: training.maintain_threshold ?? '-',
          upgrade_training: training.upgrade_threshold ?? '-',
          needs_review: needsReview,
          review_count:
            ((training.disputed_candidates as number) ?? 0) +
            ((training.pending_candidates as number) ?? 0),
        };
      }),
    );
  }, [assessmentRows, oldEntryScores, oldTrainingConfirmed]);

  const filteredData = useMemo(() => {
    return mergedData.filter((row: Record<string, unknown>) => {
      if (positionFilter !== '全部' && row.position !== positionFilter) return false;
      if (reviewFilter === '是' && !row.needs_review) return false;
      if (reviewFilter === '否' && row.needs_review) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        return (
          (row.recruiter_name as string)?.toLowerCase().includes(kw) ||
          (row.recruiter_id as string)?.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [mergedData, positionFilter, reviewFilter, keyword]);

  const reportFile = getWorkflowFileByName(output, '人事评分文档');

  const resultColumns: TableColumnsType = [
    {
      title: '招聘人职工编号',
      dataIndex: 'recruiter_id',
      key: 'recruiter_id',
      width: 140,
      fixed: 'left',
    },
    { title: '招聘人入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 130 },
    { title: '招聘人', dataIndex: 'recruiter_name', key: 'recruiter_name', width: 100 },
    { title: '最近核算月份', dataIndex: 'latest_calc_month', key: 'latest_calc_month', width: 120 },
    { title: '招聘人职位', dataIndex: 'position', key: 'position', width: 130 },
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
      title: '保级评分标准',
      dataIndex: 'maintain_score',
      key: 'maintain_score',
      width: 110,
      align: 'right',
    },
    {
      title: '升级评分标准',
      dataIndex: 'upgrade_score',
      key: 'upgrade_score',
      width: 110,
      align: 'right',
    },
    {
      title: '当月有效参培人数',
      dataIndex: 'latest_month_training',
      key: 'latest_month_training',
      width: 140,
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
      title: '月均有效参培人数',
      dataIndex: 'avg_monthly_training',
      key: 'avg_monthly_training',
      width: 140,
      align: 'right',
    },
    {
      title: '保级参培标准',
      dataIndex: 'maintain_training',
      key: 'maintain_training',
      width: 110,
      align: 'right',
    },
    {
      title: '升级参培标准',
      dataIndex: 'upgrade_training',
      key: 'upgrade_training',
      width: 110,
      align: 'right',
    },
    {
      title: '是否需核查',
      dataIndex: 'needs_review',
      key: 'needs_review',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag color="warning" icon={<WarningOutlined />}>
            需核查
          </Tag>
        ) : (
          <Tag color="success">否</Tag>
        ),
    },
    {
      title: '需核查数',
      dataIndex: 'review_count',
      key: 'review_count',
      width: 90,
      align: 'right',
      render: (v: number) => (v > 0 ? <Tag color="warning">{v}</Tag> : 0),
    },
  ];

  if (!output) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <Empty description="暂无计算结果，请先完成升降级评分计算" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageHeaderTitle}>员工考核数据参考</h2>
          <p className={styles.pageHeaderSubtitle}>合并入职评分和参培人数的关键数据</p>
        </div>
        {reportFile && (
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => downloadFileFromMF(reportFile.fileSn, reportFile.fileName)}
          >
            下载考核明细表
          </Button>
        )}
      </div>
      <Card className={styles.card}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'dashboard',
              label: '数据看板',
              children: (
                <div className={styles.dashboard}>
                  <Row gutter={16} className={styles.kpiRow}>
                    <Col xs={12} sm={6}>
                      <Card className={styles.kpiCard}>
                        <Statistic
                          title="参与考核人数"
                          value={summary.total_assessed}
                          suffix="人"
                          valueStyle={{ color: '#1677ff' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card className={styles.kpiCard}>
                        <Statistic
                          title="需核查人数"
                          value={summary.needs_review_count}
                          suffix="人"
                          valueStyle={{ color: '#fa8c16' }}
                          prefix={<WarningOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card className={styles.kpiCard}>
                        <Statistic
                          title="评分达标率"
                          value={summary.score_compliance_rate}
                          suffix="%"
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card className={styles.kpiCard}>
                        <Statistic
                          title="参培达标率"
                          value={summary.training_compliance_rate}
                          suffix="%"
                          valueStyle={{ color: '#1677ff' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={16} className={styles.chartRow}>
                    <Col xs={24} lg={12}>
                      <Card title="升降级分布" size="small" className={styles.chartCard}>
                        <Empty description="分布图表暂无数据" />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="各级别评分分布" size="small" className={styles.chartCard}>
                        <Empty description="分布图表暂无数据" />
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'preview',
              label: '结果预览',
              children: (
                <div className={styles.preview}>
                  <div className={styles.filterBar}>
                    <Space size="middle" wrap>
                      <span className={styles.filterLabel}>招聘人职位</span>
                      <Select
                        value={positionFilter}
                        onChange={setPositionFilter}
                        options={[
                          { label: '全部', value: '全部' },
                          { label: '一级招聘专员', value: '一级招聘专员' },
                          { label: '二级招聘专员', value: '二级招聘专员' },
                          { label: '观察期招聘', value: '观察期招聘' },
                        ]}
                        style={{ minWidth: 140 }}
                      />
                      <span className={styles.filterLabel}>是否需核查</span>
                      <Select
                        value={reviewFilter}
                        onChange={setReviewFilter}
                        options={[
                          { label: '全部', value: '全部' },
                          { label: '是', value: '是' },
                          { label: '否', value: '否' },
                        ]}
                        style={{ minWidth: 100 }}
                      />
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索招聘人"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        style={{ width: 200 }}
                      />
                    </Space>
                  </div>

                  <Table
                    size="small"
                    rowKey="key"
                    columns={resultColumns}
                    dataSource={filteredData}
                    rowClassName={(record) => (record.needs_review ? styles.warningRow : '')}
                    pagination={{
                      defaultPageSize: 10,
                      showTotal: (total) => `共 ${total} 条`,
                      showSizeChanger: true,
                    }}
                    scroll={{ x: 1920 }}
                    footer={() => <span>共 {filteredData.length} 条记录</span>}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
