import {
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  message as antdMessage,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  type TableColumnsType,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MF_LOG_AGENT_SN, MF_LOG_VERSION_SN } from '@/constants';
import { runWorkflow } from '@/services/mfAgent';
import { isLogRow, type LogRow, type WorkflowResult } from '@/types/mfAgent';
import { downloadFileFromMF } from '@/utils/fileDownload';
import { generateSessionSn } from '@/utils/sessionUtils';
import {
  extractFileInfo,
  parseMaybeJson,
  textValue,
  unwrapWorkflowValue,
} from '@/utils/workflowFileParser';
import styles from './index.module.css';

const { RangePicker } = DatePicker;

type TaskTypeFilter = '全部' | '升降级评分';
type RunStatusFilter = '全部' | 'success' | 'partial_success' | 'failed';

interface DetailFile {
  fileSn: string;
  fileName: string;
  fileType: 'excel' | 'pdf' | 'other';
  label: string;
}

interface NormalizedLogRow {
  key: string;
  batchId: string;
  taskType: string;
  runStatus: string;
  resultStatus: string;
  startedAt: string;
  endedAt: string;
  operator: string;
  assessedCount: string;
  reviewCount: string;
  scoreRate: string;
  trainingRate: string;
  searchText: string;
  sourceFileName: string;
  summaryJson: Record<string, unknown> | null;
  errorMessage: string;
  files: DetailFile[];
}

function findLogRowsDeep(value: unknown, depth = 0): LogRow[] {
  if (value == null || depth > 8) return [];

  const unwrapped = unwrapWorkflowValue(value);

  if (Array.isArray(unwrapped)) {
    const rows = unwrapped.filter(isLogRow);
    if (rows.length > 0) return rows;

    for (const item of unwrapped) {
      const found = findLogRowsDeep(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  if (unwrapped && typeof unwrapped === 'object') {
    const record = unwrapped as Record<string, unknown>;

    for (const key of ['hr_task_log_rows', 'rows', 'data', 'list']) {
      const found = findLogRowsDeep(record[key], depth + 1);
      if (found.length > 0) return found;
    }

    for (const child of Object.values(record)) {
      const found = findLogRowsDeep(child, depth + 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}

function parseSummaryJson(raw: unknown): Record<string, unknown> | null {
  const parsed = parseMaybeJson(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

function mapOperationType(raw: string): string {
  if (raw === 'score_calc') return '升降级评分';
  return raw;
}

function buildDetailFiles(row: LogRow): DetailFile[] {
  const files: DetailFile[] = [];
  const excelInfo = extractFileInfo(
    row.excel_file_url || row.pdf_file_url || row.result_file_ref || row.log_result_file_ref,
    'excel',
    '核算结果 Excel',
  );
  if (excelInfo) files.push(excelInfo);
  if (!files.length) {
    const pdfInfo = extractFileInfo(row.pdf_file_url, 'pdf', '核算结果 PDF');
    if (pdfInfo) files.push(pdfInfo);
  }
  return files;
}

function normalizeLogRows(rows: LogRow[]): NormalizedLogRow[] {
  return rows.map((row, index) => {
    const batchId = textValue(row.batch_id) || textValue(row.log_batch_id);
    const rawTaskType =
      textValue(row.operation_type) ||
      textValue(row.log_operation_type) ||
      textValue(row.task_type) ||
      'score_calc';
    const taskType = mapOperationType(rawTaskType);
    const runStatus =
      textValue(row.status) || textValue(row.log_status) || textValue(row.run_status);
    const startedAt =
      textValue(row.created_at) || textValue(row.log_created_at) || textValue(row.started_at);
    const endedAt = textValue(row.ended_at);
    const operator =
      textValue(row.operator_name) ||
      textValue(row.log_operator_name) ||
      textValue(row.operator) ||
      '系统';
    const resultStatus = textValue(row.result_status);

    const summary = parseSummaryJson(row.summary_json);
    const scoreRate =
      textValue(row.score_rate) ||
      textValue(row.log_score_rate) ||
      textValue(summary?.score_rate) ||
      '0%';
    const trainingRate =
      textValue(row.training_rate) ||
      textValue(row.log_training_rate) ||
      textValue(summary?.training_rate) ||
      '0%';

    const sourceFileName = textValue(row.source_file_name);
    const errorMessage = textValue(row.error_message);
    const files = buildDetailFiles(row);

    const searchText = [batchId, taskType, runStatus, startedAt, operator, sourceFileName]
      .join(' ')
      .toLowerCase();

    return {
      key: batchId || `${index}`,
      batchId,
      taskType,
      runStatus,
      resultStatus,
      startedAt,
      endedAt,
      operator,
      assessedCount:
        textValue(row.recruiter_count) ||
        textValue(row.log_recruiter_count) ||
        textValue(row.assessed_count) ||
        '0',
      reviewCount:
        textValue(row.need_review_count) ||
        textValue(row.log_need_review_count) ||
        textValue(row.review_count) ||
        '0',
      scoreRate,
      trainingRate,
      searchText,
      sourceFileName,
      summaryJson: summary,
      errorMessage,
      files,
    };
  });
}

function getRunStatusTag(status: string) {
  if (status === 'success') return <Tag color="success">已完成</Tag>;
  if (status === 'partial_success') return <Tag color="warning">部分成功</Tag>;
  if (status === 'failed') return <Tag color="error">失败</Tag>;
  return <Tag>{status || '-'}</Tag>;
}

function getWarningItems(
  row: NormalizedLogRow,
): { type: 'warning' | 'info'; title: string; message: string }[] {
  const items: { type: 'warning' | 'info'; title: string; message: string }[] = [];
  if (row.errorMessage) {
    items.push({ type: 'warning', title: '执行异常', message: row.errorMessage });
  }
  if (row.summaryJson) {
    const warnings = row.summaryJson.warnings;
    if (Array.isArray(warnings) && warnings.length > 0) {
      for (const w of warnings) {
        items.push({ type: 'warning', title: '警告', message: String(w) });
      }
    }
    const reviewCount = Number(row.reviewCount);
    if (reviewCount > 0) {
      items.push({
        type: 'info',
        title: '数据质量提示',
        message: `本批次存在 ${reviewCount} 条需核查数据，建议下载结果文件进一步确认。`,
      });
    }
  }
  if (items.length === 0 && row.runStatus === 'partial_success') {
    items.push({
      type: 'warning',
      title: '部分成功',
      message: '本次任务部分计算成功，请检查详情。',
    });
  }
  return items;
}

export default function LogsPage() {
  const [rows, setRows] = useState<NormalizedLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [taskType, setTaskType] = useState<TaskTypeFilter>('全部');
  const [runStatus, setRunStatus] = useState<RunStatusFilter>('全部');
  const [keyword, setKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const abortRef = useRef<(() => void) | null>(null);
  const lastLoadStatusRef = useRef<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<NormalizedLogRow | null>(null);

  const loadLogs = useCallback(async () => {
    abortRef.current?.();
    setLoading(true);
    setErrorMessage('');

    const sessionSn = generateSessionSn();

    const abort = await runWorkflow(
      {
        agentSn: MF_LOG_AGENT_SN,
        versionSn: MF_LOG_VERSION_SN,
        sessionSn,
        user: { status: runStatus === '全部' ? 'all' : runStatus },
      },
      {
        onComplete: (result: WorkflowResult) => {
          const rawRows = findLogRowsDeep(result.output || result);
          setRows(normalizeLogRows(rawRows));
          setLoading(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setErrorMessage(error.message);
          setLoading(false);
          abortRef.current = null;
        },
      },
    );

    abortRef.current = abort;
  }, [runStatus]);

  useEffect(() => {
    if (lastLoadStatusRef.current === runStatus) return;
    lastLoadStatusRef.current = runStatus;
    loadLogs();
    return () => {
      abortRef.current?.();
    };
  }, [loadLogs, runStatus]);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (taskType !== '全部' && row.taskType !== taskType) return false;
      if (runStatus !== '全部' && row.runStatus !== runStatus) return false;
      if (dateRange?.[0] && dateRange[1]) {
        const rowDate = dayjs(row.startedAt);
        if (rowDate.isBefore(dateRange[0], 'day') || rowDate.isAfter(dateRange[1], 'day')) {
          return false;
        }
      }
      if (kw && !row.searchText.includes(kw)) return false;
      return true;
    });
  }, [rows, taskType, runStatus, keyword, dateRange]);

  const pagedRows = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    return filteredRows.slice(start, start + pagination.pageSize);
  }, [filteredRows, pagination.current, pagination.pageSize]);

  const columns: TableColumnsType<NormalizedLogRow> = [
    {
      title: '执行时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
    },
    {
      title: '任务批次号',
      dataIndex: 'batchId',
      key: 'batchId',
      width: 180,
      ellipsis: true,
      render: (value: string, record: NormalizedLogRow) => (
        <button type="button" className={styles.batchId} onClick={() => setSelectedRow(record)}>
          {value || '-'}
        </button>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 120,
    },
    {
      title: '参与考核人数',
      dataIndex: 'assessedCount',
      key: 'assessedCount',
      width: 120,
      align: 'right',
    },
    {
      title: '需核查人数',
      dataIndex: 'reviewCount',
      key: 'reviewCount',
      width: 110,
      align: 'right',
    },
    {
      title: '评分达标率',
      dataIndex: 'scoreRate',
      key: 'scoreRate',
      width: 110,
      align: 'right',
    },
    {
      title: '参培人数达标率',
      dataIndex: 'trainingRate',
      key: 'trainingRate',
      width: 130,
      align: 'right',
    },
    {
      title: '计算状态',
      dataIndex: 'runStatus',
      key: 'runStatus',
      width: 110,
      render: getRunStatusTag,
    },
    {
      title: '执行人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: NormalizedLogRow) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => setSelectedRow(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const warningItems = useMemo(
    () => (selectedRow ? getWarningItems(selectedRow) : []),
    [selectedRow],
  );

  return (
    <div className={styles.container}>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Space size="middle" wrap>
            <span className={styles.filterLabel}>时间范围</span>
            <RangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value as [any, any] | null)}
              allowClear
            />
            <span className={styles.filterLabel}>操作类型</span>
            <Select<TaskTypeFilter>
              value={taskType}
              onChange={setTaskType}
              options={[
                { label: '全部', value: '全部' },
                { label: '升降级评分', value: '升降级评分' },
              ]}
              className={styles.select}
            />
            <span className={styles.filterLabel}>计算状态</span>
            <Select<RunStatusFilter>
              value={runStatus}
              onChange={setRunStatus}
              options={[
                { label: '全部', value: '全部' },
                { label: '已完成', value: 'success' },
                { label: '部分成功', value: 'partial_success' },
                { label: '失败', value: 'failed' },
              ]}
              className={styles.select}
            />
            <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
              刷新
            </Button>
          </Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按批次号、文件名或执行人搜索..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </Card>

      <Card
        title="操作日志"
        extra={<span className={styles.totalText}>共 {filteredRows.length} 条</span>}
      >
        {errorMessage ? <div className={styles.errorText}>{errorMessage}</div> : null}
        <Table
          columns={columns}
          dataSource={pagedRows}
          rowKey="key"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredRows.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
            },
          }}
          locale={{ emptyText: <Empty description="暂无日志数据" /> }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title="核对任务详情"
        open={!!selectedRow}
        onCancel={() => setSelectedRow(null)}
        footer={null}
        destroyOnHidden
        width={1200}
        className={styles.detailModal}
      >
        {selectedRow ? (
          <Space direction="vertical" size="large" className={styles.detailContent}>
            <div className={styles.detailSummary}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="任务批次号">
                  <span className={styles.strongText}>{selectedRow.batchId || '-'}</span>
                </Descriptions.Item>
                <Descriptions.Item label="核对类型">
                  {selectedRow.taskType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="执行状态">
                  {getRunStatusTag(selectedRow.runStatus)}
                </Descriptions.Item>
                <Descriptions.Item label="执行时间">
                  {selectedRow.startedAt || selectedRow.endedAt || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="执行人">{selectedRow.operator || '-'}</Descriptions.Item>
                <Descriptions.Item label="结果状态">
                  {selectedRow.resultStatus || '-'}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <section>
              <div className={styles.detailSectionTitle}>
                {selectedRow.taskType === '凭证分类' ? '凭证分类结果' : '升降级评分核算结果'}
              </div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={6}>
                  <Card className={styles.metricCard}>
                    <Statistic title="参与考核人数" value={selectedRow.assessedCount} suffix="人" />
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className={styles.metricCard}>
                    <Statistic title="需核查人数" value={selectedRow.reviewCount} suffix="人" />
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className={styles.metricCard}>
                    <Statistic title="评分达标率" value={selectedRow.scoreRate} />
                  </Card>
                </Col>
                <Col xs={24} sm={6}>
                  <Card className={styles.metricCard}>
                    <Statistic title="参培达标率" value={selectedRow.trainingRate} />
                  </Card>
                </Col>
              </Row>
            </section>

            <section>
              <div className={styles.detailSectionTitle}>异常与警告信息</div>
              {warningItems.length > 0 ? (
                <Space direction="vertical" className={styles.detailContent}>
                  {warningItems.map((item) => (
                    <Alert
                      key={`${item.title}-${item.message}`}
                      type={item.type}
                      showIcon
                      icon={item.type === 'warning' ? <WarningOutlined /> : <InfoCircleOutlined />}
                      message={item.title}
                      description={item.message}
                    />
                  ))}
                </Space>
              ) : (
                <Empty description="无异常信息" />
              )}
            </section>

            <section>
              <div className={styles.detailSectionTitle}>输出文件下载</div>
              {selectedRow.files.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {selectedRow.files.map((file) => (
                    <Col xs={24} sm={8} key={`${file.fileSn}-${file.fileName}`}>
                      <Card className={styles.fileCard}>
                        <div className={styles.fileCardContent}>
                          {file.fileType === 'pdf' ? (
                            <FilePdfOutlined className={styles.fileIcon} />
                          ) : (
                            <FileExcelOutlined className={styles.fileIcon} />
                          )}
                          <div className={styles.fileInfo}>
                            <div className={styles.fileName}>{file.fileName}</div>
                            <div className={styles.fileMeta}>{file.label}</div>
                          </div>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => {
                              if (!file.fileSn) {
                                antdMessage.warning('该文件缺少文件编号，暂无法下载');
                                return;
                              }
                              downloadFileFromMF(file.fileSn, file.fileName);
                            }}
                          >
                            下载
                          </Button>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="当前日志未记录可下载文件" />
              )}
            </section>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
