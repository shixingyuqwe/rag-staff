# 第一阶段：制度 RAG 最小闭环

## 给执行智能体的总指令

你正在维护一个真实学习项目，不要把它当成空目录重新生成。你的任务是：在保留现有结构和前端功能的前提下，完成“制度文档上传 → 文档解析 → 文本切分 → Embedding → Chroma 持久化 → 相似度检索 → LLM 基于检索片段回答 → 返回引用来源”的最小可用闭环，并留下清晰的运行说明和测试证据。

执行原则：

1. 先读本文件和 `README.md`、`docs/api_contract.md`、`docs/test_cases.md`，再改代码。
2. 先运行现有项目，记录真实错误；不要凭猜测大规模重构。
3. 每次只完成一个小目标，修改后立即验证。
4. 不要删除已有前端页面、已有测试资料、已有 API，除非能证明它们与第一阶段冲突。
5. 不要把 API Key、`.env`、虚拟环境、Chroma 数据库和上传文件提交到 Git。
6. 不要引入数据库、LangGraph、多 Agent、登录系统、OCR 或复杂队列；这些属于后续阶段。
7. 遇到不确定的问题，先报告：文件、现象、复现命令、你的判断和建议，不要擅自改变产品范围。

---

## 一、当前项目真实构成

项目根目录：`D:\AI应用学习\RAG项目\hr-policy-rag`

```text
hr-policy-rag/
├─ apps/
│  ├─ web/                         React 前端
│  ├─ rag-service/                 Python FastAPI RAG 服务
│  └─ api-service/                 预留的后端目录，目前基本未实现
├─ docs/
│  ├─ api_contract.md              前后端 API 约定
│  ├─ learning_guide.md            RAG 学习说明
│  └─ test_cases.md                制度 RAG 测试用例
├─ package.json                    根目录启动脚本
├─ pnpm-workspace.yaml             PNPM workspace 配置
├─ pnpm-lock.yaml                  根依赖锁定文件
├─ README.md                       项目说明和启动方式
└─ .gitignore                      环境变量、依赖、运行数据排除规则
```

### 1. 根目录文件

#### `package.json`

根脚本主要作用：

- `pnpm install:web`：安装前端依赖。
- `pnpm install:rag`：使用 `apps/rag-service/.venv` 安装 Python 依赖。
- `pnpm dev:web`：启动前端。
- `pnpm dev:rag`：启动 FastAPI，默认 `127.0.0.1:8000`。
- `pnpm dev`：使用 `concurrently` 同时启动前后端。

不要误以为 PNPM 管理 Python 依赖。前端由 PNPM 管理，Python 服务由 `.venv + requirements.txt` 管理。

#### `pnpm-workspace.yaml`

当前声明了 `apps/web` 和 `packages/*`。`apps/rag-service` 是 Python 服务，不是 PNPM workspace 包。前端引用了 `@hr-rag/chat-ui`，如果该 workspace 包不存在或未安装，前端构建会失败；先检查实际安装结果，不要凭空创建包。

#### `.gitignore`

已经排除了：`.env`、Python 虚拟环境、Node 依赖、上传文件、Chroma 数据、缓存和日志。这个规则必须保留。尤其不能因为“本地可以运行”而强行提交 `apps/rag-service/.env`。

---

## 二、Python RAG 服务的调用链

### 1. `apps/rag-service/app/main.py`

FastAPI 入口。职责是：创建应用、配置 CORS、创建上传目录和 Chroma 目录、注册健康检查和两个路由模块。

当前路由：

```text
GET  /                       服务信息
GET  /health                 健康检查
POST /api/kb/upload         制度文档上传和建索引
POST /api/kb/query          非流式问答
GET  /api/kb/documents      文档列表
POST /api/chat/stream       SSE 流式问答
```

如果启动时报导入错误，先检查是否从 `apps/rag-service` 目录执行，以及命令是否为：

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. `app/core/config.py`

使用 Pydantic Settings 从 `.env` 读取配置：

- DeepSeek API Key、Base URL、聊天模型。
- Embedding 模型。
- Chroma 数据目录和 collection 名称。
- 上传目录。
- `chunk_size` 和 `chunk_overlap`。

不要把密钥写入代码。当前 `.env.example` 是配置模板，实际 `.env` 只存在本机。

### 3. `app/core/embeddings.py`

封装 `sentence-transformers` 的中文 Embedding 模型，供 Chroma 写入和查询时使用。必须保证“写入文档时的模型”和“查询时的模型”一致，否则向量空间不一致，检索结果会异常。

首次加载模型可能需要下载模型文件，网络慢时会耗时较长；这不是 API 逻辑错误。执行智能体不要随意换模型，除非记录模型名称、维度和验证结果。

### 4. `app/core/llm.py`

封装 DeepSeek 的聊天调用和流式调用。它负责模型通信，不负责检索。检查重点：

- API Key 缺失时返回清晰错误。
- 网络错误、超时和模型错误不会暴露一大串无上下文异常。
- 非流式和流式使用的模型配置一致。
- 不把完整密钥打印到日志。

### 5. `app/models/schemas.py`

定义 Pydantic 请求/响应模型，类似 TypeScript 的运行时校验类型：

- `QueryRequest`：问题和 `top_k`。
- `SourceChunk`：chunk_id、文件名、文本、分数和顺序。
- `QueryResponse`：回答和来源。
- `DocumentInfo`、`UploadResponse`：上传和文档列表。
- `ChatStreamRequest`：流式聊天消息。

任何新增字段都要同步更新 `docs/api_contract.md`、前端类型和测试用例。不要让响应模型与实际 JSON 长期不一致。

### 6. `app/api/kb.py`

知识库 HTTP 路由。

上传流程：

```text
校验扩展名
→ 保存到 app/data/uploads
→ document_loader 解析
→ chunk_service 切分
→ vector_store 写入 Chroma
→ document_registry 记录文档信息
```

当前 `document_registry` 是内存字典，服务重启后文档列表会丢失；这是第一阶段已知限制，不能伪装成生产能力。Chroma 向量数据会持久化，但文档元数据列表不会。

第一阶段至少要补的健壮性：

- 文件名为空时不能崩溃。
- 上传失败时清理已经保存的临时文件。
- 解析失败、切分为空、Embedding 失败时返回可理解错误。
- 对文件大小设置合理限制。
- 避免同一文档重复上传时产生不可解释的重复 chunk。
- 不要把异常堆栈直接作为用户错误返回；日志中保留详细异常即可。

### 7. `app/services/document_loader.py`

负责 PDF、DOCX、TXT 转纯文本：

- PDF 使用 `pypdf`，只能读取可复制文字，扫描件暂不支持 OCR。
- DOCX 使用 `python-docx`，当前读取段落。
- TXT 依次尝试 UTF-8、GBK、GB2312。

如果制度文档是表格，当前 DOCX 解析可能遗漏表格内容；第一阶段先明确限制，不要未经测试宣称支持所有 Word 内容。

### 8. `app/services/chunk_service.py`

按目标字符数和中文句子边界切分，并保留 overlap。重点检查：

- `chunk_overlap < chunk_size`。
- 空文本返回空列表。
- 不出现死循环。
- 每个 chunk 有稳定的 `chunk_id`、文档 ID、文件名、顺序和位置元数据。
- 同一文档重建索引时，旧 chunk 不应悄悄残留。

### 9. `app/services/vector_store.py`

封装 Chroma PersistentClient：

- `add_chunks`：把文本、Embedding、metadata 写入 collection。
- `search`：将问题向量化并检索 top_k。
- `get_document_chunk_count`：按文档统计 chunk 数。

注意 Chroma 返回的是 distance，不一定直接是“相似度”。当前代码用 `1 - distance` 转换，必须在测试中验证分数范围和排序，不要只相信注释。

当前 Chroma 数据目录已经存在本地运行产物，但 `.gitignore` 不允许提交这些运行数据。测试应该能在空 Chroma 目录中重新建立索引。

### 10. `app/services/rag_service.py`

实现非流式 RAG：

```text
question
→ vector_store.search
→ build_context
→ system prompt + 用户问题 + 检索片段
→ llm_client.chat
→ QueryResponse(answer, sources)
```

业务规则：只根据提供片段回答；没有依据时明确拒答；含糊时建议人工确认。不要为了让答案看起来更完整而加入知识库外的常识。

### 11. `app/services/chat_stream_service.py` 和 `app/api/chat.py`

负责 SSE：检索状态、来源、文本增量、完成和错误事件。必须验证：

- 每个事件是合法 SSE 格式并以空行分隔。
- 事件顺序稳定：开始 → 检索 → 来源 → 生成增量 → done，错误时不再发送正常 done。
- 前端断开连接时，不继续无限生成。
- `done` 代表生成结束，但客户端连接关闭和业务状态是两个概念。

---

## 三、前端构成和职责

### `apps/web`

React 19 + Rsbuild + Ant Design + TanStack Router + Zustand + Ky。它既包含制度 RAG 页面，也包含原有的人事评分流程页面。第一阶段只改制度 RAG 相关部分。

### `src/pages/PolicyChat/index.tsx`

制度问答页面。负责标题、推荐问题、ChatPanel 和来源卡片，不应在页面组件中直接实现检索逻辑。

### `src/features/policy-chat/usePolicySseChat.ts`

制度聊天状态和 SSE 消费核心：发送问题、接收 marker/sources/delta/done/error、停止、重试和清空。排查“回答一直生成”“停止按钮不消失”“来源不显示”时，优先看这里和后端 SSE 事件格式。

### `src/services/request.ts`、`src/constants/index.ts`

HTTP 请求和 API 基础地址。前端开发代理约定为 `/rag-api/* → http://127.0.0.1:8000/*`。不要在组件里到处硬编码 `localhost:8000`。

### `src/pages/Upload/index.tsx`

当前主要是 Excel 上传和评分工作流，不是制度 RAG 上传页面。不要把它误当成 `/api/kb/upload` 的前端入口。第一阶段若需要制度文档上传，应新建或明确一个制度上传页面，或者先用 Swagger/curl 验证后端，不要破坏现有 Excel 页面。

### 其他页面

`Welcome、Login、Assessment、Logs、Scoring` 属于现有产品壳和评分流程。第一阶段只要求制度问答能独立运行，不要求把所有页面都接入 RAG。

---

## 四、第一阶段明确目标

### 必须完成

1. Python 服务可启动，`GET /health` 返回 `{"status":"ok"}`。
2. 上传 `test_data/招聘专员晋升制度.txt` 成功并产生 chunk。
3. Chroma 在空目录下成功持久化向量。
4. `POST /api/kb/query` 返回回答和来源。
5. `POST /api/chat/stream` 能发送来源、增量文本和完成事件。
6. 前端制度问答页能发送推荐问题、显示回答、显示来源、停止和重试。
7. 知识库没有答案时，系统拒绝编造。
8. `docs/test_cases.md` 填入实际测试结果，而不是保留“待填写”。
9. 更新 README，使新环境可以按文档启动。

### 明确不做

- 不接 PostgreSQL。
- 不做登录、组织权限和多租户。
- 不做 OCR。
- 不做 Agent 多工具、多 Agent、LangGraph。
- 不做复杂重排、混合检索和生产部署。
- 不删除或重构与制度 RAG 无关的评分页面。

---

## 五、执行顺序

### 第 0 步：基线检查

运行：

```powershell
git status --short --branch
Get-Content -Encoding utf8 apps/rag-service/.env.example
Get-Content -Encoding utf8 apps/web/.env.example
```

确认 `.env` 未被 Git 跟踪，确认不要覆盖已有未提交修改。当前已知本地 `README.md` 有未提交修改，不能重置或覆盖。

### 第 1 步：后端健康检查

```powershell
cd apps/rag-service
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

另开终端：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/docs
```

如果启动就触发 Embedding 模型下载，先等待模型初始化完成，再判断服务是否正常。

### 第 2 步：上传测试文档

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/kb/upload `
  -F "file=@apps/rag-service/test_data/招聘专员晋升制度.txt"
```

记录 `document_id`、`chunk_count`，再执行：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/kb/documents
```

### 第 3 步：验证非流式查询

```powershell
$body = @{ question = 'P2-1 招聘专员升级标准是什么？'; top_k = 3 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/kb/query -Method Post -ContentType 'application/json' -Body $body
```

必须检查：答案是否来自制度，来源是否有文件名、chunk 序号和文本，是否出现制度外编造。

### 第 4 步：验证流式查询

用前端或 `docs/api_contract.md` 中约定的客户端方式连接 `/api/chat/stream`，记录完整事件序列。不能只看到页面出现文字就算通过，要确认 `sources` 和 `done` 事件存在。

### 第 5 步：前端验证

```powershell
pnpm install:web
pnpm dev:web
```

检查页面路由，推荐问题、发送、停止、重试、清空、来源卡片和错误提示。若前端构建失败，先判断是 workspace 包、TypeScript 类型、环境变量还是 RAG API 连接问题。

### 第 6 步：完善测试文档

至少执行 `docs/test_cases.md` 的 6 个问题：4 个有答案的问题、1 个模糊问题、1 个知识库不存在的问题。每条记录：实际来源、答案是否正确、是否引用、是否胡编、耗时和环境。

---

## 六、验收标准

### 功能验收

- 空知识库查询返回明确提示，不调用模型或不产生虚假答案。
- 上传 TXT/PDF/DOCX 的成功和失败路径均有清晰响应。
- 查询返回 `answer + sources`。
- 流式接口事件顺序正确，异常事件格式正确。
- 文件名包含中文时，保存、列表和来源显示不乱码。
- 重启服务后 Chroma 仍能检索已持久化向量；文档列表丢失要在 README 中注明。

### 代码验收

- `python -m compileall app` 通过。
- 前端 `pnpm type-check` 和 `pnpm build` 通过，或在文档中记录现有阻塞原因。
- 没有提交 `.env`、密钥、`.venv`、`node_modules`、上传资料和 Chroma 数据。
- 业务异常不会用裸 `except Exception` 吞掉上下文；日志和用户错误分层。
- 新增 API 字段同步更新 schema、API 契约、前端消费和测试。

### 学习验收

执行智能体完成后，必须向学习者解释一次真实请求：

```text
浏览器发什么请求
→ FastAPI 哪个路由接收
→ 哪个 loader 解析
→ 如何切 chunk
→ 哪个 embedding 模型生成向量
→ Chroma 如何检索
→ prompt 如何组装
→ LLM 如何生成
→ SSE 如何返回
→ 前端哪个 hook 更新状态
```

如果只能说“用了 RAG 框架”，不算完成。

---

## 七、常见问题排查表

| 现象 | 先查哪里 | 不要先做什么 |
|---|---|---|
| 服务启动失败 | `.venv`、requirements、工作目录、导入路径 | 不要重装全部 Python |
| 模型下载很慢 | `embeddings.py`、网络、模型缓存 | 不要误判为 API 代码错误 |
| 上传成功但查询为空 | Chroma 目录、collection、chunk 数量 | 不要先换 LLM |
| 查询来源正确但回答胡编 | `rag_service.py` prompt 和 sources | 不要盲目增加 top_k |
| 页面收不到来源 | 后端 SSE 事件格式、`usePolicySseChat.ts` | 不要在页面组件复制一套解析器 |
| 刷新后文档列表为空 | `document_registry` 内存字典 | 不要声称 Chroma 丢数据 |
| 中文文件名乱码 | PowerShell 编码、保存文件名、响应编码 | 不要随意改成 UUID 文件名而丢失展示名 |
| 前端构建失败 | `apps/web/package.json` workspace 依赖 | 不要删除无关页面 |

---

## 八、完成后必须汇报的格式

```text
## 已完成
- 文件/模块：做了什么
- 接口：如何验证
- 前端：如何验证

## 测试结果
- 命令：结果
- 测试用例 1-6：通过/失败及原因

## 已知限制
- 当前仍是内存文档注册表
- 当前不支持扫描件 OCR
- 当前无认证和权限

## 未完成和原因
- 文件：阻塞原因
- 需要用户决定的事项：...

## 建议下一步
- 只列真正必要的下一步，不要趁机引入数据库或多 Agent
```

最终目标不是代码越多越好，而是让学习者能运行、观察、解释并修改一个真实的制度 RAG 最小闭环。
