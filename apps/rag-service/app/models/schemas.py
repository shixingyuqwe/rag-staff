"""
Pydantic 数据模型 - 定义 API 请求和响应的数据结构

学习要点：
- Pydantic 类似于 TypeScript 的 interface/type，但它在运行时也会校验数据
- BaseModel 是 Pydantic 的基类，所有数据模型都继承它
- Field(...) 可以设置验证规则（最小值、最大值、描述等）
- 如果请求数据不符合这些模型，FastAPI 会自动返回 422 错误
- 类比：Pydantic 之于 Python，就像 Zod 之于 TypeScript
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ========== 请求模型 ==========

class QueryRequest(BaseModel):
    """知识库查询请求"""
    question: str = Field(
        ...,              # ... 表示必填字段
        min_length=1,     # 最少 1 个字符
        max_length=1000,  # 最多 1000 个字符
        description="用户的问题",
    )
    top_k: int = Field(
        default=3,        # 默认值
        ge=1,             # 最小值 1
        le=10,            # 最大值 10
        description="返回的最相关片段数量",
    )


# ========== 响应模型 ==========

class SourceChunk(BaseModel):
    """检索到的制度片段（引用来源）"""
    chunk_id: str           # chunk 唯一标识
    filename: str           # 来源文件名
    text: str               # 原文片段
    score: float            # 相似度分数（0-1，越高越相关）
    chunk_index: int        # chunk 在原文中的序号


class QueryResponse(BaseModel):
    """知识库查询响应"""
    answer: str                        # LLM 生成的回答
    sources: List[SourceChunk]         # 引用的制度片段列表


class DocumentInfo(BaseModel):
    """已上传文档信息"""
    document_id: str
    filename: str
    chunk_count: int
    file_size: int
    upload_time: str


class UploadResponse(BaseModel):
    """文件上传响应"""
    document_id: str
    filename: str
    chunk_count: int
    message: str
