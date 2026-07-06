import {
  BarChartOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  FileTextOutlined,
  MessageOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Layout, Menu } from 'antd';
import styles from './index.module.css';

const { Header, Content, Sider } = Layout;

const SCORING_PAGES = ['/upload', '/scoring', '/assessment'];

const SIDE_STEPS = [
  { title: '文件上传', icon: <UploadOutlined />, path: '/upload' },
  { title: '升降级计算', icon: <BarChartOutlined />, path: '/scoring' },
  { title: '计算结果', icon: <CheckCircleOutlined />, path: '/assessment' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname.replace(/^\/staff/, '') || '/';

  const isScoringModule = SCORING_PAGES.includes(currentPath);

  const topMenuKey = isScoringModule ? '/scoring-group' : currentPath;

  const topMenuItems = [
    {
      key: '/scoring-group',
      icon: <TeamOutlined />,
      label: '升降级评分',
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: '制度问答',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '操作日志',
    },
  ];

  const handleTopMenuClick = (info: { key: string }) => {
    if (info.key === '/scoring-group') {
      navigate({ to: '/upload' });
      return;
    }
    navigate({ to: info.key });
  };

  const currentStep = SIDE_STEPS.findIndex((s) => s.path === currentPath);

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <button type="button" className={styles.logo} onClick={() => navigate({ to: '/' })}>
          <span className={styles.logoIcon}>◉</span>
          人事管理系统
        </button>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[topMenuKey]}
          items={topMenuItems}
          onClick={handleTopMenuClick}
          className={styles.topMenu}
        />
      </Header>
      <Layout>
        {isScoringModule && (
          <Sider width={240} className={styles.sider} theme="light">
            <div className={styles.sideTitle}>升降级评分</div>
            <nav className={styles.sideNav}>
              {SIDE_STEPS.map((step, index) => {
                const isActive = currentPath === step.path;
                const isCompleted = index < currentStep;
                return (
                  <button
                    key={step.path}
                    type="button"
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => navigate({ to: step.path })}
                  >
                    <span className={styles.navIcon}>
                      {isCompleted ? <CheckOutlined className={styles.completedIcon} /> : step.icon}
                    </span>
                    <span className={styles.navTitle}>{step.title}</span>
                  </button>
                );
              })}
            </nav>
          </Sider>
        )}
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
