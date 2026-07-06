"""
聊天流式 API 路由 - POST /api/chat/stream

使用 Server-Sent Events (SSE) 实现流式输出。
前端通过 @microsoft/fetch-event-source 接收事件。
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatStreamRequest
from app.services.chat_stream_service import chat_stream

router = APIRouter()


# ========== POST /api/chat/stream ==========
@router.post("/stream")
async def stream_chat(request: ChatStreamRequest):
    """
    流式聊天接口

    SSE 事件格式：
    - event: marker  → 状态标记（retrieving / found / generating / done）
    - event: sources → 检索到的制度片段
    - event: delta   → LLM 生成的文本片段
    - event: done    → 生成完成
    - event: error   → 错误信息
    """
    return StreamingResponse(
        chat_stream(request.messages, request.top_k),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )
