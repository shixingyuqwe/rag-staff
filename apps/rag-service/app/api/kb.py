"""
知识库 API 路由 - 处理文件上传、知识查询、文档列表

学习要点：
- APIRouter() 类似于 Express 的 express.Router()
- @router.post("/upload") 注册 POST /upload 路由
- UploadFile 是 FastAPI 提供的文件上传类型，支持异步读取
- File(...) 表示这是一个文件类型的表单字段（multipart/form-data）
- HTTPException 用于返回 HTTP 错误响应
- 完整流程：上传 → 解析 → 切分 → 向量化 → 存储
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import uuid
from datetime import datetime

from app.core.config import settings
from app.services.document_loader import load_document
from app.services.chunk_service import chunk_text
from app.services.vector_store import vector_store
from app.services.rag_service import rag_query
from app.models.schemas import (
    QueryRequest,
    QueryResponse,
    UploadResponse,
    DocumentInfo,
)

router = APIRouter()

# 内存中的文档注册表（简化实现，生产环境应使用数据库）
# 键：document_id，值：文档信息字典
document_registry: dict = {}


# ========== POST /api/kb/upload ==========
@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    上传制度文档并建立索引

    完整流程：
    1. 校验文件类型
    2. 保存文件到 uploads 目录
    3. 解析文档提取文本
    4. 切分为 chunk
    5. 生成 embedding 并存入向量库
    """
    # 1. 校验文件类型
    allowed_types = {".pdf", ".docx", ".txt"}
    suffix = Path(file.filename).suffix.lower()

    if suffix not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {suffix}。支持: {', '.join(allowed_types)}",
        )

    # 2. 保存文件
    document_id = str(uuid.uuid4())[:8]
    safe_filename = f"{document_id}_{file.filename}"
    save_path = Path(settings.upload_dir) / safe_filename

    content = await file.read()
    save_path.write_bytes(content)
    print(f"[Upload] 文件已保存: {save_path} ({len(content)} bytes)")

    # 3. 解析文档
    try:
        text = load_document(save_path)
        print(f"[Parse] 解析完成，文本长度: {len(text)} 字符")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 4. 切分 chunk
    chunks = chunk_text(
        text=text,
        document_id=document_id,
        filename=file.filename,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    print(f"[Chunk] 切分为 {len(chunks)} 个 chunk")

    # 5. 存入向量库（embedding 由 Chroma 自动调用）
    vector_store.add_chunks(chunks)

    # 6. 记录文档信息
    document_registry[document_id] = {
        "document_id": document_id,
        "filename": file.filename,
        "chunk_count": len(chunks),
        "file_size": len(content),
        "upload_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    return UploadResponse(
        document_id=document_id,
        filename=file.filename,
        chunk_count=len(chunks),
        message=f"上传成功！文档已切分为 {len(chunks)} 个片段并建立索引。",
    )


# ========== POST /api/kb/query ==========
@router.post("/query", response_model=QueryResponse)
async def query_knowledge_base(request: QueryRequest):
    """
    查询知识库 - 输入问题，返回 LLM 回答和引用来源

    流程：
    1. 对问题生成 embedding
    2. 从向量库检索最相关的 top_k 个 chunk
    3. 将 chunk 拼接为 context
    4. 调用 DeepSeek LLM 生成回答
    5. 返回回答 + 引用来源
    """
    try:
        response = await rag_query(request.question, request.top_k)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"查询失败: {str(e)}",
        )


# ========== GET /api/kb/documents ==========
@router.get("/documents", response_model=list[DocumentInfo])
async def list_documents():
    """
    列出所有已上传的文档
    """
    return list(document_registry.values())
