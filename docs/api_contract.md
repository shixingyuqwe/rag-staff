# 前后端 API 约定

## RAG 服务基础信息

- **基础 URL**：`http://127.0.0.1:8000`
- **前端代理**：`/rag-api` → `http://127.0.0.1:8000`

## 接口列表

### 1. 健康检查

```http
GET /health
```

**响应**：
```json
{ "status": "ok" }
```

### 2. 上传制度文档

```http
POST /api/kb/upload
Content-Type: multipart/form-data
```

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | File | PDF/DOCX/TXT 文件 |

**响应**：
```json
{
  "document_id": "cda34092",
  "filename": "招聘专员晋升制度.pdf",
  "chunk_count": 32,
  "message": "上传成功！文档已切分为 32 个片段并建立索引。"
}
```

### 3. 查询知识库

```http
POST /api/kb/query
Content-Type: application/json
```

**请求体**：
```json
{
  "question": "P2-1 招聘专员升级标准是什么？",
  "top_k": 3
}
```

**响应**：
```json
{
  "answer": "根据《招聘专员晋升制度》第五条...",
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

### 4. 查看已上传文档

```http
GET /api/kb/documents
```

**响应**：
```json
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

## 前端调用方式

```typescript
import { RAG_API_BASE } from '@/constants';

// 上传文件
const formData = new FormData();
formData.append('file', file);
const res = await fetch(`${RAG_API_BASE}/api/kb/upload`, {
  method: 'POST',
  body: formData,
});

// 查询
const res = await fetch(`${RAG_API_BASE}/api/kb/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: '问题内容', top_k: 3 }),
});
```
