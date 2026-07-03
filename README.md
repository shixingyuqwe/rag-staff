# HR Policy RAG - 人事制度知识库问答系统

一个基于 RAG（检索增强生成）的人事制度知识库问答系统。
上传制度文档后，可以通过自然语言提问，系统会基于制度内容生成回答并返回引用来源。

## 项目目标

这是个人学习项目，用于掌握 RAG 底层链路：

```
上传制度文档 → 解析文本 → 文档切分 → 向量化 → 存入向量库
→ 用户提问 → 检索相关片段 → 调用大模型 → 返回答案和引用来源
```

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| Web 框架 | FastAPI + Uvicorn | 高性能异步 API 框架 |
| 文档解析 | pypdf + python-docx | PDF 和 Word 文本提取 |
| 文本切分 | 自实现 | 滑动窗口 + 句子边界检测 |
| Embedding | sentence-transformers | BAAI/bge-small-zh-v1.5（中文优化） |
| 向量库 | Chroma | 轻量级本地向量数据库 |
| 大模型 | DeepSeek API | OpenAI 兼容格式 |

## 安装方式

### 前置要求

- Python 3.10+
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 安装步骤

```bash
# 1. 进入项目目录
cd hr-policy-rag

# 2. 创建虚拟环境
python -m venv venv

# 3. 激活虚拟环境
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

## 启动方式

```bash
# 启动服务
uvicorn app.main:app --reload --port 8000

# 访问 API 文档
open http://localhost:8000/docs
```

> 首次启动时，Embedding 模型会自动下载（约 100MB），请耐心等待。

## API 接口

### 健康检查

```bash
GET /health

# 响应
{"status": "ok"}
```

### 上传制度文档

```bash
POST /api/kb/upload
Content-Type: multipart/form-data

# 参数：file (PDF/DOCX/TXT)
# 响应：
{
  "document_id": "cda34092",
  "filename": "招聘专员晋升制度.pdf",
  "chunk_count": 32,
  "message": "上传成功！文档已切分为 32 个片段并建立索引。"
}
```

### 查询知识库

```bash
POST /api/kb/query
Content-Type: application/json

{
  "question": "P2-1 招聘专员升级标准是什么？",
  "top_k": 3
}

# 响应：
{
  "answer": "根据《招聘专员晋升制度》第五条，P2-1 升级标准为...",
  "sources": [
    {
      "chunk_id": "cda34092_chunk_0001",
      "filename": "招聘专员晋升制度.pdf",
      "text": "第五条 P1-3 升级至 P2-1 标准：...",
      "score": 0.82,
      "chunk_index": 1
    }
  ]
}
```

### 查看已上传文档

```bash
GET /api/kb/documents

# 响应：
[
  {
    "document_id": "cda34092",
    "filename": "招聘专员晋升制度.pdf",
    "chunk_count": 32,
    "file_size": 15420,
    "upload_time": "2026-07-03 11:28:04"
  }
]
```

## RAG 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        文档上传流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户上传文件 → 保存到本地 → 解析文本 → 切分 chunk              │
│                                          ↓                      │
│                          生成 embedding → 存入 Chroma           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        RAG 查询流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户提问 → 问题 embedding → Chroma 检索 top_k 个 chunk         │
│                                          ↓                      │
│              拼接 context + prompt → 调用 DeepSeek LLM          │
│                                          ↓                      │
│                     返回 answer + sources                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
hr-policy-rag/
  app/
    main.py              # FastAPI 入口
    api/
      kb.py              # 知识库 API（上传/查询/文档列表）
    core/
      config.py          # 配置管理
      llm.py             # DeepSeek LLM 客户端
      embeddings.py      # Embedding 模型封装
    services/
      document_loader.py # 文档解析（PDF/DOCX/TXT）
      chunk_service.py   # 文本切分
      vector_store.py    # Chroma 向量库操作
      rag_service.py     # RAG 流程编排
    models/
      schemas.py         # Pydantic 数据模型
    data/
      uploads/           # 上传文件存储
      chroma/            # Chroma 持久化数据
  docs/
    learning_guide.md    # 学习指南
    test_cases.md        # 测试用例
  requirements.txt
  .env.example
  README.md
```

## 当前限制

1. PDF 仅支持可复制文本，扫描件需要 OCR（暂不支持）
2. 使用内存存储文档注册表，重启后文档列表会丢失（但 Chroma 数据持久化）
3. 没有用户认证和权限控制
4. 分块策略较简单，不支持按标题/段落切分
5. 不支持多轮对话

## 下一步计划（第二阶段）

- 加入 Excel 上传和规则评分
- RAG 检索制度依据
- 生成评分解释
- 前端对接

## 学习资源

详细的学习指南请查看 [docs/learning_guide.md](docs/learning_guide.md)
