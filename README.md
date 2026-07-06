# HR Policy RAG Platform

人事制度知识库 RAG 系统 — Monorepo 版本

>

## 项目结构

```text
hr-policy-rag/
  apps/
    web/                  # 前端项目（React + Rsbuild）
    rag-service/          # Python FastAPI RAG 服务
    api-service/          # 预留，暂不实现
  docs/
    learning_guide.md     # RAG 学习指南
    test_cases.md         # RAG 测试用例
    api_contract.md       # 前后端 API 约定
  package.json            # PNPM 根配置（启动脚本）
  pnpm-workspace.yaml     # PNPM Workspace 配置
  .gitignore
  README.md
```

**注意**：

- PNPM 只管理 Node / 前端相关依赖
- Python 服务仍然使用自己的 `requirements.txt`、`.env`、虚拟环境
- 根目录负责统一组织项目和提供启动脚本

## 前置要求

- **Node.js** 18+ 和 **PNPM**
- **Python** 3.10+
- **DeepSeek API Key**（[申请地址](https://platform.deepseek.com/)）

## 快速开始

### 1. 安装前端依赖

```bash
pnpm install:web
# 或
cd apps/web && pnpm install
```

### 2. 配置前端环境变量

```bash
cd apps/web
cp .env.example .env.development
# 编辑 .env.development，按需修改
```

### 3. 安装 Python 依赖

```bash
cd apps/rag-service
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. 配置 RAG 服务环境变量

```bash
cd apps/rag-service
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

### 5. 启动服务

```bash
# 方式一：分别启动
pnpm dev:web     # 前端（默认 http://localhost:3000）
pnpm dev:rag     # RAG 服务（http://127.0.0.1:8000）

# 方式二：同时启动
pnpm dev
```

## API 接口

### RAG 服务


| 方法     | 路径                  | 说明                   |
| ------ | ------------------- | -------------------- |
| `GET`  | `/`                 | 服务信息                 |
| `GET`  | `/health`           | 健康检查                 |
| `POST` | `/api/kb/upload`    | 上传制度文档（PDF/DOCX/TXT） |
| `POST` | `/api/kb/query`     | 知识库问答                |
| `GET`  | `/api/kb/documents` | 已上传文档列表              |


> 启动 RAG 服务后访问 `http://127.0.0.1:8000/docs` 查看 Swagger 文档。

### 前端代理

前端开发服务器已配置 RAG API 代理：

- `/rag-api/*` → `http://127.0.0.1:8000/*`

前端代码中通过 `RAG_API_BASE` 常量访问 RAG 服务。

## 环境变量说明

### RAG 服务 (`apps/rag-service/.env`)


| 变量                    | 说明                  |
| --------------------- | ------------------- |
| `DEEPSEEK_API_KEY`    | DeepSeek API Key    |
| `DEEPSEEK_BASE_URL`   | DeepSeek API 基础 URL |
| `DEEPSEEK_CHAT_MODEL` | 聊天模型名称              |
| `EMBEDDING_MODEL`     | Embedding 模型        |
| `UPLOAD_DIR`          | 上传文件目录              |
| `CHROMA_PERSIST_DIR`  | Chroma 持久化目录        |
| `CHUNK_SIZE`          | 切分块大小               |
| `CHUNK_OVERLAP`       | 切分块重叠               |


### 前端 (`apps/web/.env.development`)


| 变量                    | 说明                       |
| --------------------- | ------------------------ |
| `PUBLIC_PATH`         | 公共路径                     |
| `PUBLIC_RAG_API_BASE` | RAG 服务地址                 |
| `PUBLIC_MF_API_BASE`  | MarketingForce API 基础路径  |
| `PUBLIC_MF_API_TOKEN` | MarketingForce API Token |


## 技术栈

### RAG 服务


| 组件        | 技术                    | 说明                           |
| --------- | --------------------- | ---------------------------- |
| Web 框架    | FastAPI + Uvicorn     | 高性能异步 API 框架                 |
| 文档解析      | pypdf + python-docx   | PDF 和 Word 文本提取              |
| 文本切分      | 自实现                   | 滑动窗口 + 句子边界检测                |
| Embedding | sentence-transformers | BAAI/bge-small-zh-v1.5（中文优化） |
| 向量库       | Chroma                | 轻量级本地向量数据库                   |
| 大模型       | DeepSeek API          | OpenAI 兼容格式                  |


### 前端


| 组件       | 技术              |
| -------- | --------------- |
| 框架       | React 19        |
| 构建工具     | Rsbuild         |
| UI 组件    | Ant Design 6    |
| 路由       | TanStack Router |
| 状态管理     | Zustand         |
| HTTP 客户端 | Ky              |
| CSS      | Tailwind CSS 4  |


## 当前限制

1. PDF 仅支持可复制文本，扫描件需要 OCR（暂不支持）
2. 使用内存存储文档注册表，重启后文档列表会丢失（但 Chroma 数据持久化）
3. 没有用户认证和权限控制
4. 分块策略较简单，不支持按标题/段落切分
5. 不支持多轮对话
6. 前端尚未完全接入 RAG 功能

## 下一阶段计划

- 前端页面接入 RAG 上传和问答
- Excel 上传和规则评分
- RAG 检索制度依据
- 用户登录
- Docker Compose 部署
- 生产环境网关配置

## 学习资源

- RAG 学习指南：[docs/learning_guide.md](docs/learning_guide.md)
- RAG 测试用例：[docs/test_cases.md](docs/test_cases.md)
- API 约定：[docs/api_contract.md](docs/api_contract.md)

