import { RouterProvider } from '@tanstack/react-router';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router';
import { AntdStaticHolder } from './utils/antd-static';
import './index.css';

const rootElement = document.getElementById('root')!;

createRoot(rootElement).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <App>
        <AntdStaticHolder />
        <RouterProvider router={router} />
      </App>
    </ConfigProvider>
  </StrictMode>,
);
