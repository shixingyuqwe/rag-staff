import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const publicPath = process.env.PUBLIC_PATH || '/';

export default defineConfig({
  plugins: [pluginReact(), pluginSvgr()],
  html: {
    title: '人事管理系统',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  source: {
    define: {
      APP_ID: 501,
    },
  },
  output: {
    assetPrefix: publicPath,
    filename: {
      js: '[name].[contenthash:8].js',
      css: '[name].[contenthash:8].css',
    },
    sourceMap: {
      js: process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map',
      css: false,
    },
    polyfill: 'usage',
  },
  performance: {
    buildCache: true,
    chunkSplit: {
      strategy: 'split-by-experience',
    },
  },
  server: {
    base: publicPath,
    proxy: {
      // 后端 API 代理（学习用途，替换为你的实际后端地址）
      '/api': {
        target: process.env.PROXY_API_TARGET || 'http://localhost:3001/api',
        changeOrigin: true,
        secure: false,
      },
      // MarketingForce AI 平台代理
      '/mf-api': {
        target: process.env.PROXY_MF_API_TARGET || 'http://localhost:3001/mf-api',
        changeOrigin: true,
        secure: false,
      },
      // RAG 服务代理
      '/rag-api': {
        target: process.env.PUBLIC_RAG_API_BASE || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        pathRewrite: { '^/rag-api': '' },
      },
    },
  },
});
