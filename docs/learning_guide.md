# RAG 项目学习指南 - 从零开始理解 AI 应用

> 本文档是 hr-policy-rag 项目的配套学习材料。
> 面向有前端经验但 Python 基础薄弱的开发者。
> 每个概念都会用前端工程师熟悉的类比来解释。

---

## 目录

- [第一部分：RAG 核心概念](#第一部分rag-核心概念)
- [第二部分：Python 基础（面向前端工程师）](#第二部分python-基础面向前端工程师)
- [第三部分：项目代码走读](#第三部分项目代码走读)
- [第四部分：进阶方向](#第四部分进阶方向)

---

## 第一部分：RAG 核心概念

### 1. 什么是 RAG？

**一句话解释：** RAG = 让 AI 先"查资料"再回答问题。

**类比：** 闭卷考试 vs 开卷考试

```
闭卷考试（纯 LLM）：
  老师提问 → 学生凭记忆回答 → 可能记错、编造

开卷考试（RAG）：
  老师提问 → 学生先翻书找相关内容 → 基于原文回答 → 更准确、可追溯
```

**为什么需要 RAG？**

LLM（大语言模型）有三个致命问题：

| 问题 | 说明 | RAG 如何解决 |
|------|------|-------------|
| 知识截止 | GPT 只知道训练数据截止前的信息 | 可以检索最新的制度文档 |
| 不知道你的数据 | LLM 没读过你公司的制度 | 上传制度后就能检索 |
| 幻觉 | LLM 会编造看似合理但错误的内容 | 限定只基于检索到的内容回答 |

**RAG 完整流程：**

```
用户上传制度文档
  → 文档解析（提取文本）
  → 文档切分（切成小段）
  → 向量化（每段变成数字数组）
  → 存入向量库

用户提问
  → 问题向量化
  → 从向量库检索最相关的片段
  → 把片段 + 问题一起交给 LLM
  → LLM 基于片段生成回答
  → 返回回答 + 引用来源
```

---

### 2. 什么是 Embedding（向量嵌入）？

**一句话解释：** 把文字变成一组数字（向量），语义相近的文字，数字也相近。

**类比：** 把每句话变成地图上的一个坐标点

```
想象一个二维地图：
  - "员工晋升条件" → 坐标 (0.8, 0.3)
  - "升职要求是什么" → 坐标 (0.75, 0.35)  ← 语义相近，坐标也靠近
  - "今天天气怎么样" → 坐标 (0.1, 0.9)    ← 语义不同，坐标远离
```

实际上向量是高维的（512 维或更多），但原理一样。

**Embedding 在 RAG 中的作用：**

```
制度片段 "P2-1升级需要年度考核B级以上"
  → embedding → [0.12, 0.85, 0.33, ...] (512个数字)

用户问题 "P2-1怎么升级"
  → embedding → [0.11, 0.82, 0.35, ...] (512个数字)

两个向量很接近 → 说明语义相关 → 检索命中！
```

**本项目使用的 Embedding 模型：**

```python
# app/core/embeddings.py
model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
# 这个模型专为中文优化，输出 512 维向量
```

---

### 3. 向量数据库解决什么问题？

**问题：** 传统数据库只能做精确匹配或模糊匹配，无法理解语义。

```
传统搜索（关键词匹配）：
  搜索 "怎么升职"
  → 只能找到包含 "怎么" 或 "升职" 这两个词的文档
  → 找不到写着 "晋升条件" 的文档（字面不同但语义相同）

向量搜索（语义匹配）：
  搜索 "怎么升职"
  → 把问题变成向量
  → 在向量库中找距离最近的向量
  → 找到 "晋升条件" 相关片段（因为向量距离近）
```

**本项目使用的向量库：Chroma**

```python
# app/services/vector_store.py
client = chromadb.PersistentClient(path="app/data/chroma")
# PersistentClient = 数据保存到磁盘，重启不丢失

collection = client.get_or_create_collection(name="hr_knowledge")
# collection = 类似数据库中的表

collection.add(ids=ids, documents=texts, embeddings=vectors, metadatas=metas)
# 存入向量

results = collection.query(query_embeddings=query_vector, n_results=3)
# 检索最相似的 3 个结果
```

---

### 4. 为什么要分块（Chunking）？

**为什么不能把整篇文档直接给 LLM？**

1. LLM 有上下文长度限制（比如 4K、8K tokens）
2. 整篇文档太长，重要信息被淹没
3. 检索精度下降（一篇长文档的 embedding 无法聚焦到具体条款）

**chunk 太大 vs 太小的问题：**

| chunk 太大 | chunk 太小 |
|-----------|-----------|
| 包含太多不相关信息 | 丢失上下文 |
| embedding 语义模糊 | 检索到的片段不完整 |
| 浪费 LLM 的上下文窗口 | LLM 无法理解片段含义 |

**本项目的切分策略：**

```python
# app/services/chunk_service.py
chunk_size = 1000    # 每个 chunk 约 1000 个中文字符
chunk_overlap = 150  # 相邻 chunk 重叠 150 个字符

# 还会尝试在句子边界（句号、问号等）处断开
# 避免在句子中间切断
```

**为什么需要 overlap（重叠）？**

```
假设一段文本：AAAAABBBBBCCCCC

不带 overlap：
  chunk1: AAAAA
  chunk2: BBBBB  ← B开头的内容与A结尾的内容关系断裂
  chunk3: CCCCC

带 overlap（重叠2个字符）：
  chunk1: AAAAA
  chunk2: AABB BBB
  chunk3: BBCCC CCC
  ← 边界处的内容在两个 chunk 中都出现，保持连贯性
```

---

### 5. 什么是 top_k？

**一句话解释：** 检索时返回最相关的 k 个结果。

```
用户提问："P2-1 升级标准是什么？"

向量库中有 100 个 chunk：
  top_k=3 → 返回最相关的 3 个
  top_k=5 → 返回最相关的 5 个
```

**k 怎么选？**

| top_k 太大 | top_k 太小 |
|-----------|-----------|
| 引入不相关的噪音 | 可能遗漏关键信息 |
| 浪费 LLM 的上下文 | 回答不够全面 |
| 增加 API 调用成本 | 回答可能不准确 |

**经验法则：** 一般从 3-5 开始，根据实际效果调整。

---

### 6. 为什么答案必须返回 sources？

**三个核心理由：**

1. **可追溯性**：用户需要验证答案是否正确
   ```
   ❌ "P2-1 升级需要年度考核 B 级以上"（不知道出自哪里）
   ✅ "根据《招聘专员晋升制度》第五条第一款，P2-1 升级需要..."
   ```

2. **防止幻觉**：LLM 可能编造答案，sources 可以帮助识别
   ```
   如果 sources 为空或内容与答案无关 → 说明 LLM 在编造
   ```

3. **建立信任**：HR 制度涉及员工切身利益，必须有据可查

**本项目的 sources 结构：**

```json
{
  "chunk_id": "cda34092_chunk_0001",
  "filename": "招聘专员晋升制度.txt",
  "text": "第五条 P1-3 升级至 P2-1 标准：...",
  "score": 0.82,
  "chunk_index": 1
}
```

---

### 7. RAG vs 关键词搜索

| 对比维度 | 关键词搜索 | RAG 语义搜索 |
|---------|-----------|-------------|
| 匹配方式 | 字面匹配 | 语义匹配 |
| "怎么升职"能匹配"晋升条件" | ❌ 不能 | ✅ 能 |
| 理解同义词 | ❌ 不能 | ✅ 能 |
| 理解上下文 | ❌ 不能 | ✅ 能 |
| 精确查找特定编号 | ✅ 擅长 | ⚠️ 可能不如关键词 |
| 需要向量库 | ❌ 不需要 | ✅ 需要 |

**最佳实践：** 生产环境通常两者结合（混合搜索），取长补短。

---

### 8. 为什么不能让 LLM 直接记住制度？

1. **LLM 没有持久记忆**：每次对话都是独立的，不会"记住"之前上传的内容
2. **上下文窗口有限**：即使把制度塞进去，也会因为太长而被截断
3. **幻觉风险**：LLM 可能把不同制度的内容混淆，编造出错误的答案
4. **无法追溯**：即使答案碰巧正确，用户也无法验证来源

```
❌ 错误做法：把整本制度手册塞进 system prompt
✅ 正确做法：每次只检索最相关的 3-5 个片段，作为上下文交给 LLM
```

---

## 第二部分：Python 基础（面向前端工程师）

### 9. 虚拟环境（venv）

**为什么需要？** 每个项目的依赖可能冲突。虚拟环境让每个项目有自己独立的依赖。

**类比：** 就像每个前端项目有自己的 `node_modules`，但 Python 的虚拟环境是全局级别的隔离。

```bash
# 创建虚拟环境（类似 npm init）
python -m venv venv

# 激活（Windows）
venv\Scripts\activate

# 激活后，pip install 只影响这个虚拟环境
pip install fastapi

# 退出虚拟环境
deactivate
```

**常见坑：**
- 忘记激活就 pip install → 包被安装到全局
- 切换项目前忘记切换虚拟环境 → 版本冲突

---

### 10. pip 与 requirements.txt

**类比：**

| Node.js | Python |
|---------|--------|
| npm | pip |
| package.json | requirements.txt |
| node_modules | site-packages |
| npm install | pip install |
| npm install express | pip install fastapi |

```bash
# 安装所有依赖（类似 npm install）
pip install -r requirements.txt

# 导出当前环境的所有依赖（类似生成 package-lock.json）
pip freeze > requirements.txt
```

**requirements.txt 示例：**

```txt
fastapi==0.115.0        # == 表示精确版本
uvicorn>=0.32.0         # >= 表示最低版本
sentence-transformers   # 不指定版本，安装最新
```

---

### 11. 类型提示（Type Hints）

**类比：** Python 是动态类型（像 JavaScript），但可以加类型注解（像 TypeScript）。

```python
# 没有类型提示（像 JavaScript）
def add(a, b):
    return a + b

# 有类型提示（像 TypeScript）
def add(a: int, b: int) -> int:
    return a + b

# 复杂类型
from typing import List, Dict, Optional

def process(items: List[str], config: Dict[str, int]) -> Optional[str]:
    # List[str] = string[]
    # Dict[str, int] = Record<string, number>
    # Optional[str] = string | undefined
    pass
```

**注意：** Python 的类型提示只是注解，运行时不会强制检查（除非用 Pydantic 等库）。

---

### 12. Pydantic

**类比：** Pydantic = Python 的 Zod。它用类型提示来做数据验证。

```python
# 类似 Zod 的 schema
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=3, ge=1, le=10)

# 类似 Zod 的 parse
request = QueryRequest(question="员工晋升条件", top_k=5)
# 如果 question 为空或 top_k=0，会抛出 ValidationError
```

**在 FastAPI 中的作用：**
- 自动验证请求数据
- 自动生成 Swagger 文档
- 自动转换数据类型

---

### 13. 装饰器（Decorators）

**类比：** Express 中的 `app.get("/path", handler)` 但用 `@` 语法。

```python
# Express 风格
app.get("/health", health_handler)

# FastAPI 装饰器风格（完全等价）
@app.get("/health")
def health():
    return {"status": "ok"}
```

**装饰器本质：** 就是一个函数包装另一个函数。

```python
# 这两种写法等价：

# 装饰器写法
@app.get("/health")
def health():
    return {"status": "ok"}

# 非装饰器写法（不常用，但能帮助理解）
def health():
    return {"status": "ok"}
app.get("/health")(health)
```

---

### 14. async/await

**好消息：** 如果你熟悉 JavaScript 的 async/await，Python 的几乎一样！

```python
# JavaScript
async function fetchData() {
    const response = await fetch('/api/data');
    return response.json();
}

# Python（几乎一样！）
async def fetch_data():
    response = await http_client.get('/api/data')
    return response.json()
```

**区别：**
- Python 用 `async def` 定义异步函数
- 调用异步函数必须用 `await`
- 如果函数内部不需要 `await`，可以用普通 `def`（FastAPI 会自动在线程池中运行）

**在本项目中的使用：**
```python
# LLM 调用是异步的（因为要等网络响应）
async def chat(self, messages):
    response = await self.client.chat.completions.create(...)
    return response.choices[0].message.content
```

---

### 15. 文件 I/O

**类比：** Node.js 的 `fs` 模块。

```python
from pathlib import Path

# 读取文本文件
text = Path("config.txt").read_text(encoding="utf-8")

# 写入文本文件
Path("output.txt").write_text("hello", encoding="utf-8")

# 读取二进制文件（如 PDF）
data = Path("document.pdf").read_bytes()

# 写入二进制文件
Path("output.pdf").write_bytes(data)

# 检查文件是否存在
if Path("file.txt").exists():
    print("文件存在")

# 创建目录（类似 mkdir -p）
Path("app/data/uploads").mkdir(parents=True, exist_ok=True)
```

---

## 第三部分：项目代码走读

### 16. 项目分层架构

```
app/
  main.py          → 入口层：创建应用、注册路由
  api/             → API 层：处理 HTTP 请求/响应
  core/            → 基础层：配置、LLM、Embedding
  services/        → 业务层：文档解析、切分、向量库、RAG
  models/          → 数据层：请求/响应的数据结构
```

**依赖方向（只能从上到下引用）：**

```
api → services → core
 ↓       ↓
models  models
```

**类比前端：**
```
api/        → 类似 routes/ 或 controllers/
services/   → 类似 services/ 或 usecases/
core/       → 类似 lib/ 或 utils/
models/     → 类似 types/ 或 schemas/
```

---

### 17. 关键代码解释

#### 17.1 配置加载（config.py）

```python
class Settings(BaseSettings):
    deepseek_api_key: str = ""
    chunk_size: int = 1000

    model_config = {"env_file": ".env"}

settings = Settings()
```

这段代码做了什么：
1. 定义所有配置项和默认值
2. 自动从 `.env` 文件读取对应的环境变量
3. 创建全局单例 `settings`，其他地方直接 `from app.core.config import settings`

#### 17.2 文件上传流程（kb.py）

```python
@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # 1. 保存文件到磁盘
    save_path.write_bytes(await file.read())

    # 2. 解析文件 → 提取纯文本
    text = load_document(save_path)

    # 3. 切分文本 → 多个 chunk
    chunks = chunk_text(text, document_id, filename)

    # 4. 生成 embedding + 存入向量库
    vector_store.add_chunks(chunks)

    # 5. 返回结果
    return UploadResponse(...)
```

#### 17.3 RAG 查询流程（rag_service.py）

```python
async def rag_query(question, top_k):
    # 1. 检索相关 chunk
    sources = vector_store.search(question, top_k)

    # 2. 拼接 context（把检索到的片段组合成文本）
    context = build_context(sources)

    # 3. 组装 prompt
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"问题：{question}\n\n制度片段：{context}"},
    ]

    # 4. 调用 LLM
    answer = await llm_client.chat(messages)

    # 5. 返回答案 + 来源
    return QueryResponse(answer=answer, sources=sources)
```

---

### 18. 调试技巧

#### 18.1 自动 API 文档

FastAPI 自动生成 Swagger UI：

```
http://localhost:8000/docs     → 交互式 API 文档
http://localhost:8000/redoc    → 另一种格式的文档
```

可以直接在浏览器中测试所有接口。

#### 18.2 常见错误排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `ModuleNotFoundError` | 包未安装或虚拟环境未激活 | `pip install xxx` |
| `422 Unprocessable Entity` | 请求数据不符合 Pydantic 模型 | 检查请求体的字段名和类型 |
| `500 Internal Server Error` | 服务端代码报错 | 查看终端的错误日志 |
| PDF 提取不出文字 | 扫描件 PDF | 使用可复制文本的 PDF 或 TXT |
| LLM 返回错误信息 | API Key 未配置或无效 | 检查 .env 中的 DEEPSEEK_API_KEY |

---

## 第四部分：进阶方向

### 19. 改进方向

当你完成了第一阶段，可以考虑以下优化：

| 方向 | 说明 | 难度 |
|------|------|------|
| 更好的分块 | 按标题/段落/条款切分，保留层级结构 | 中 |
| 混合搜索 | 向量搜索 + 关键词搜索结合 | 中 |
| Reranking | 检索后用更精确的模型重排序 | 高 |
| 多轮对话 | 记住上下文，支持追问 | 中 |
| 元数据过滤 | 按文件名、日期等过滤检索范围 | 低 |
| 评估体系 | 建立测试集，量化 RAG 效果 | 中 |

---

### 20. 推荐学习资源

**Python 基础：**
- [Python 官方教程](https://docs.python.org/zh-cn/3/tutorial/)
- [FastAPI 官方文档](https://fastapi.tiangolo.com/zh/)（写得非常好，适合新手）

**RAG 相关：**
- [LangChain 文档](https://python.langchain.com/docs/)（了解框架级 RAG 实现）
- [LlamaIndex 文档](https://docs.llamaindex.ai/)（另一个 RAG 框架）
- [Chroma 文档](https://docs.trychroma.com/)（向量数据库）

**Embedding 模型：**
- [Hugging Face 模型库](https://huggingface.co/models)
- [MTEB 排行榜](https://huggingface.co/spaces/mteb/leaderboard)（Embedding 模型效果排名）

**视频：**
- B 站搜索 "RAG 教程" 有很多中文教程
- 吴恩达的 [LangChain 课程](https://www.deeplearning.ai/short-courses/)（免费短课）

---

## 附录：常见问题

### Q: 为什么选择 Chroma 而不是其他向量库？
A: Chroma 最轻量，适合学习。生产环境可以考虑 pgvector（基于 PostgreSQL）或 Milvus。

### Q: 为什么不用 LangChain？
A: 第一阶段目标是学习底层原理。手写一遍后，再用框架会理解得更深。

### Q: Embedding 模型怎么选？
A: 中文场景推荐 `BAAI/bge-small-zh`（小模型）或 `BAAI/bge-large-zh`（大模型更准）。

### Q: chunk_size 应该设多大？
A: 中文文档建议 500-1500 字符。太小丢上下文，太大语义模糊。需要根据实际效果调优。

### Q: 检索效果不好怎么办？
A: 检查以下几点：
1. chunk_size 是否合适
2. Embedding 模型是否适合中文
3. 问题表述和制度文本的差异是否太大
4. 考虑加入 metadata 过滤

---

> 学习建议：先通读一遍概念，然后对照代码理解，最后尝试自己修改参数（比如 chunk_size）看效果变化。
> 动手比看更重要！
