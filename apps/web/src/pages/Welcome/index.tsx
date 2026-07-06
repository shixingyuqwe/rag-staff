import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import { Button, Tag } from 'antd';
import GridScan from '@/components/GridScan';
import RotatingText from '@/components/RotatingText';
import TargetCursor from '@/components/TargetCursor';
import { useHrWorkflowStore } from '@/stores/hrWorkflowStore';
import styles from './index.module.css';

const FLOW_STEPS = [
  {
    title: '文件上传',
    description: '按月份上传 Excel 文件，支持多文件与文件夹选择。',
    icon: <UploadOutlined />,
  },
  {
    title: '智能计算',
    description: '并行计算入职评分与参培人数，自动汇总关键指标。',
    icon: <BarChartOutlined />,
  },
  {
    title: '结果核对',
    description: '查看评分、参培与待确认数据，下载核算明细。',
    icon: <CheckCircleOutlined />,
  },
  {
    title: '待确认跟进',
    description: '识别参培天数、入职状态等需要人工复核的数据。',
    icon: <FileSearchOutlined />,
  },
  {
    title: '明细下载',
    description: '输出评分明细、参培明细与核算结果，便于归档。',
    icon: <FileTextOutlined />,
  },
  {
    title: '过程追溯',
    description: '通过操作日志回看批次、执行人、状态和下载文件。',
    icon: <SafetyCertificateOutlined />,
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const monthCards = useHrWorkflowStore((s) => s.monthCards);
  const scoringSession = useHrWorkflowStore((s) => s.scoringSession);
  const scoringResult = useHrWorkflowStore((s) => s.scoringResult);

  const totalFiles = monthCards.reduce((sum, month) => sum + month.files.length, 0);
  const isProcessing = scoringSession.uploading || scoringSession.processing.isProcessing;
  const hasResult = Boolean(scoringResult);

  const status = (() => {
    if (isProcessing) {
      return {
        tone: 'processing',
        icon: <ClockCircleOutlined />,
        label: '计算进行中',
        title: 'AI 正在计算入职评分与参培人数',
        description: '可以进入上传页查看实时进度，计算完成后系统会引导查看结果。',
      };
    }
    if (hasResult) {
      return {
        tone: 'success',
        icon: <CheckCircleOutlined />,
        label: '最近一次已完成',
        title: '最近一次升降级评分已完成',
        description: '可以继续核对评分与参培明细，也可以重新上传文件开始新一轮核算。',
      };
    }
    if (totalFiles > 0) {
      return {
        tone: 'ready',
        icon: <FileTextOutlined />,
        label: '文件已选择',
        title: `已选择 ${totalFiles} 个文件`,
        description: '进入上传页确认月份与文件列表后，即可开始升降级评分计算。',
      };
    }
    return {
      tone: 'idle',
      icon: <PlayCircleOutlined />,
      label: '尚未开始',
      title: '尚未开始本次核算',
      description: '从上传月度 Excel 开始，系统会完成评分计算、参培筛选和结果汇总。',
    };
  })();

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <button type="button" className={styles.logo} onClick={() => navigate({ to: '/' })}>
          <span className={styles.logoIcon}>◉</span>
          人事管理系统
        </button>
        <nav className={styles.headerNav}>
          <button
            type="button"
            className={`${styles.navItem} cursor-target`}
            onClick={() => navigate({ to: '/upload' })}
          >
            <TeamOutlined />
            <span>升降级评分</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} cursor-target`}
            onClick={() => navigate({ to: '/chat' })}
          >
            <MessageOutlined />
            <span>制度问答</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} cursor-target`}
            onClick={() => navigate({ to: '/logs' })}
          >
            <FileTextOutlined />
            <span>操作日志</span>
          </button>
        </nav>
      </header>
      <TargetCursor
        spinDuration={2}
        hideDefaultCursor
        parallaxOn
        hoverDuration={0.18}
        cursorColor="#ffffff"
        cursorColorOnTarget="#8fb8ff"
      />
      <GridScan
        className={styles.pageScan}
        sensitivity={0.58}
        lineThickness={1.25}
        linesColor="#2563ff"
        gridScale={0.085}
        scanColor="#3b82f6"
        scanOpacity={0.78}
        bloomIntensity={0.86}
        noiseIntensity={0.012}
        lineJitter={0.14}
        scanGlow={0.76}
        scanSoftness={1.7}
        scanDuration={2}
        scanDelay={0.9}
      />
      <div className={styles.pageShade} />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <Tag color="blue" className={styles.eyebrow}>
              <ThunderboltOutlined /> 升降级评分工作台
            </Tag>
            <h1 className={styles.heroTitle}>
              让升降级核算更
              <RotatingText
                texts={['清晰', '快速', '可追溯']}
                mainClassName={styles.rotatingText}
                splitLevelClassName={styles.rotatingTextWord}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-120%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                rotationInterval={2400}
                staggerDuration={0.02}
                staggerFrom="last"
                splitBy="characters"
                auto
                loop
              />
            </h1>
            <p className={styles.heroSubtitle}>
              上传月度 Excel
              文件后，系统将并行计算入职评分与参培人数，并生成可核对、可下载、可追溯的结果。
            </p>
            <div className={styles.heroActions}>
              <Button
                type="primary"
                size="large"
                icon={<UploadOutlined />}
                className="cursor-target"
                onClick={() => navigate({ to: '/upload' })}
              >
                开始上传
              </Button>
              <Button
                size="large"
                icon={<FileSearchOutlined />}
                className="cursor-target"
                onClick={() => navigate({ to: '/logs' })}
              >
                查看操作日志
              </Button>
            </div>
          </div>

          <aside className={`${styles.statusPanel} ${styles[status.tone]} cursor-target`}>
            <div className={styles.statusTopline}>
              <span className={styles.statusIcon}>{status.icon}</span>
              <span>{status.label}</span>
            </div>
            <h2 className={styles.statusTitle}>{status.title}</h2>
            <p className={styles.statusDescription}>{status.description}</p>
          </aside>
        </section>

        <section className={styles.flowSection} aria-label="核算能力">
          <div className={styles.flowTrack}>
            {[...FLOW_STEPS, ...FLOW_STEPS].map((step, index) => (
              <div className={`${styles.flowStep} cursor-target`} key={`${step.title}-${index}`}>
                <span className={styles.stepIndex}>0{(index % FLOW_STEPS.length) + 1}</span>
                <span className={styles.stepIcon}>{step.icon}</span>
                <div className={styles.stepText}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
