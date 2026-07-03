export const TOKEN_KEY = 'token';
export const TENANT_KEY = 'tenant';
export const API_PREFIX = import.meta.env.PUBLIC_API_PREFIX || '/api';

export const WECOM_AUTH_BASE =
  import.meta.env.PUBLIC_WECOM_AUTH_BASE ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');
export const WECOM_CORP_ID = import.meta.env.PUBLIC_WECOM_CORP_ID || '';

// MarketingForce AI Agent 配置
export const MF_API_BASE = import.meta.env.PUBLIC_MF_API_BASE || '/mf-api';
export const MF_API_TOKEN = import.meta.env.PUBLIC_MF_API_TOKEN || '';

// 升降级评分智能体
export const MF_SCORING_AGENT_SN = import.meta.env.PUBLIC_MF_SCORING_AGENT_SN || '';
export const MF_SCORING_VERSION_SN = import.meta.env.PUBLIC_MF_SCORING_VERSION_SN || '';

// 日志智能体
export const MF_LOG_AGENT_SN = import.meta.env.PUBLIC_MF_LOG_AGENT_SN || '';
export const MF_LOG_VERSION_SN = import.meta.env.PUBLIC_MF_LOG_VERSION_SN || '';

// RAG 服务 API 地址
export const RAG_API_BASE = import.meta.env.PUBLIC_RAG_API_BASE || 'http://127.0.0.1:8000';
