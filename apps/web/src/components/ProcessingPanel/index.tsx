import { ThunderboltOutlined } from '@ant-design/icons';
import { Card, Progress, Tag } from 'antd';
import styles from './ProcessingPanel.module.css';

interface ProcessingPanelProps {
  title: string;
  description?: string;
  steps?: string[];
  messageCount: number;
  tagLabel?: string;
}

export default function ProcessingPanel({
  title,
  description,
  steps,
  messageCount,
  tagLabel = '处理中',
}: ProcessingPanelProps) {
  const percent = Math.min(92, 12 + messageCount * 10);

  return (
    <Card size="small" className={styles.progressCard}>
      <div className={styles.processingPanel}>
        <div className={styles.processingHeader}>
          <div className={styles.titleBlock}>
            <div className={styles.processingTitle}>
              <span className={styles.aiIconWrap}>
                <span className={styles.aiIconPulse} />
                <ThunderboltOutlined className={styles.aiIcon} />
              </span>
              <span>{title}</span>
            </div>
            {description && (
              <div className={styles.processingDesc}>
                {description}
                <span className={styles.loadingDots} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>
          <Tag color="processing">{tagLabel}</Tag>
        </div>
        <Progress
          percent={percent}
          status="active"
          strokeColor={{ from: '#1677ff', to: '#36cfc9' }}
        />
        {steps && steps.length > 0 && (
          <div
            className={styles.progressSteps}
            style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
          >
            {steps.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
