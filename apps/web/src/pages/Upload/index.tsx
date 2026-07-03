import { DeleteOutlined, InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import {
  Alert,
  message as antdMessage,
  Button,
  Card,
  Divider,
  Select,
  Space,
  Tag,
  Upload,
  type UploadProps,
} from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import ProcessingPanel from '@/components/ProcessingPanel';
import { type MonthCard, useHrWorkflowStore } from '@/stores/hrWorkflowStore';
import styles from './index.module.css';

const { Dragger } = Upload;

function MonthTag({ card, onRemove }: { card: MonthCard; onRemove: () => void }) {
  const setActiveMonth = useHrWorkflowStore((s) => s.setActiveMonth);
  const activeMonthId = useHrWorkflowStore((s) => s.activeMonthId);
  const isActive = activeMonthId === card.id;

  return (
    <Tag
      className={`${styles.monthTag} ${isActive ? styles.monthTagActive : ''}`}
      closable
      onClose={(e) => {
        e.preventDefault();
        onRemove();
      }}
      onClick={() => {
        setActiveMonth(card.id);
        const el = document.getElementById(`month-card-${card.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    >
      {card.year}年{card.month}月
    </Tag>
  );
}

function MonthCardComponent({ card }: { card: MonthCard }) {
  const updateMonth = useHrWorkflowStore((s) => s.updateMonth);
  const setMonthFiles = useHrWorkflowStore((s) => s.setMonthFiles);
  const toggleMonthCollapse = useHrWorkflowStore((s) => s.toggleMonthCollapse);
  const removeMonth = useHrWorkflowStore((s) => s.removeMonth);
  const monthCards = useHrWorkflowStore((s) => s.monthCards);
  const scoringSession = useHrWorkflowStore((s) => s.scoringSession);
  const uploading = scoringSession.uploading;
  const processing = scoringSession.processing;

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    label: `${2024 + i}`,
    value: 2024 + i,
  }));
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}`,
    value: i + 1,
  }));

  const antdFileList = card.files.map((file) => ({
    uid: file.name,
    name: file.name,
    size: file.size,
    originFileObj: file as any,
    status: 'done' as const,
  }));

  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      const allFiles = Array.from(fileList);
      const validFiles = allFiles.filter((f) => {
        const name = f.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) return false;
        if (f.name.startsWith('~$')) return false;
        if (f.size / 1024 / 1024 > 50) {
          antdMessage.error(`${f.name} 超过 50MB 限制`);
          return false;
        }
        return true;
      });
      if (validFiles.length === 0) {
        antdMessage.warning('文件夹中未找到可上传的 Excel 文件');
      } else {
        setMonthFiles(card.id, [...card.files, ...validFiles]);
      }
      e.target.value = '';
    },
    [card.id, card.files, setMonthFiles],
  );

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList: antdFileList,
    accept: '.xlsx,.xls',
    beforeUpload: (_file, newFiles) => {
      const allNew = Array.isArray(newFiles) ? newFiles : [newFiles];
      const validFiles = allNew.filter((f) => {
        if (f.size / 1024 / 1024 > 50) {
          antdMessage.error(`${f.name} 超过 50MB 限制`);
          return false;
        }
        return true;
      });
      setMonthFiles(card.id, [...card.files, ...validFiles]);
      return false;
    },
    onRemove: (file) => {
      setMonthFiles(
        card.id,
        card.files.filter((f) => f.name !== file.name),
      );
    },
  };

  return (
    <div id={`month-card-${card.id}`} className={styles.monthCard}>
      <Card
        size="small"
        title={
          <Space>
            <Select
              value={card.year}
              options={yearOptions}
              onChange={(v) => v && updateMonth(card.id, v, card.month)}
              size="small"
              style={{ width: 80 }}
            />
            年
            <Select
              value={card.month}
              options={monthOptions}
              onChange={(v) => v && updateMonth(card.id, card.year, v)}
              size="small"
              style={{ width: 60 }}
            />
            月
          </Space>
        }
        extra={
          <Space>
            <Button type="text" size="small" onClick={() => toggleMonthCollapse(card.id)}>
              {card.collapsed ? '展开' : '收起'}
            </Button>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={monthCards.length <= 1}
              onClick={() => removeMonth(card.id)}
            />
          </Space>
        }
      >
        {!card.collapsed && (
          <>
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderChange}
              // @ts-expect-error webkitdirectory is not in React's type definitions but supported by all modern browsers
              webkitdirectory=""
              directory=""
              multiple
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
            />
            <Dragger
              {...uploadProps}
              disabled={uploading || processing.isProcessing}
              className={styles.dragger}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                拖拽文件或文件夹至此，或者 <span className={styles.dragLink}>选择文件</span> 或者{' '}
                <button
                  type="button"
                  className={styles.dragLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!uploading && !processing.isProcessing) {
                      folderInputRef.current?.click();
                    }
                  }}
                >
                  选择文件夹
                </button>
              </p>
              <p className="ant-upload-hint">
                支持 .xlsx / .xls 格式，可同时选择多个文件或一个文件夹
              </p>
            </Dragger>
            {card.files.length > 0 && (
              <div className={styles.fileCount}>已选择 {card.files.length} 个文件</div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const monthCards = useHrWorkflowStore((s) => s.monthCards);
  const addMonth = useHrWorkflowStore((s) => s.addMonth);
  const removeMonth = useHrWorkflowStore((s) => s.removeMonth);
  const startScoring = useHrWorkflowStore((s) => s.startScoring);
  const scoringSession = useHrWorkflowStore((s) => s.scoringSession);
  const scoringResult = useHrWorkflowStore((s) => s.scoringResult);

  const uploading = scoringSession.uploading;
  const processing = scoringSession.processing;

  const totalFiles = monthCards.reduce((sum, m) => sum + m.files.length, 0);

  const waitForScoringRef = useRef(false);

  useEffect(() => {
    if (waitForScoringRef.current && scoringResult && !processing.isProcessing) {
      waitForScoringRef.current = false;
      navigate({ to: '/scoring' });
    }
  }, [scoringResult, processing.isProcessing, navigate]);

  useEffect(() => {
    if (processing.isProcessing) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [processing.isProcessing]);

  const handleStartScoring = useCallback(async () => {
    if (totalFiles === 0) {
      antdMessage.warning('请先上传文件');
      return;
    }

    waitForScoringRef.current = true;

    const allFiles = monthCards
      .filter((m) => m.files.length > 0)
      .map((m) => ({ monthId: m.id, files: m.files }));

    await startScoring(allFiles);
  }, [totalFiles, monthCards, startScoring]);

  return (
    <div className={styles.container}>
      <Card title="文件上传" className={styles.card}>
        {/* 月份标签栏 */}
        <div className={styles.monthTagBar}>
          <div className={styles.monthTags}>
            {monthCards.map((card) => (
              <MonthTag key={card.id} card={card} onRemove={() => removeMonth(card.id)} />
            ))}
          </div>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addMonth}>
            添加月份
          </Button>
        </div>

        <Divider />

        {/* 月份卡片列表 */}
        <div className={styles.monthCardsList}>
          {monthCards.map((card) => (
            <MonthCardComponent key={card.id} card={card} />
          ))}
        </div>

        {/* 开始计算按钮 */}
        <div className={styles.uploadBtn}>
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={totalFiles === 0 || processing.isProcessing}
            onClick={handleStartScoring}
          >
            {uploading
              ? '上传中...'
              : processing.isProcessing
                ? '计算中...'
                : `开始计算 (${totalFiles} 个文件)`}
          </Button>
        </div>

        {/* 处理进度区域 */}
        {processing.isProcessing && (
          <>
            <Divider />
            <ProcessingPanel
              title="AI 正在计算中"
              description="正在并行计算入职评分与参培人数，请稍候"
              steps={['数据上传', '智能计算', '结果汇总']}
              messageCount={processing.messages.length}
            />
            <div className={styles.autoNavigate}>计算完成后将自动跳转到结果页面...</div>
          </>
        )}

        {/* 错误信息 */}
        {processing.error && (
          <>
            <Divider />
            <Alert message="计算失败" description={processing.error} type="error" showIcon />
          </>
        )}

        {/* 计算完成提示 */}
        {processing.result && !processing.isProcessing && (
          <>
            <Divider />
            <Alert
              message="计算完成"
              description="升降级评分计算已完成，点击下方按钮查看结果。"
              type="success"
              showIcon
              action={
                <Button size="small" type="primary" onClick={() => navigate({ to: '/scoring' })}>
                  查看结果
                </Button>
              }
            />
          </>
        )}
      </Card>
    </div>
  );
}
