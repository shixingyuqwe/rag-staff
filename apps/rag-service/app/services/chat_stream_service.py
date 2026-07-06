"""
聊天流式服务 - 实现 RAG 流程的流式输出

流程：
1. 取最后一条 user message 作为 question
2. yield marker: retrieving
3. vector_store.search(question, top_k)
4. yield sources
5. 构造 RAG prompt
6. 调用 llm_client.stream_chat(messages)
7. 每个 token yield delta
8. yield done
"""

import json
from typing import List, Dict, AsyncGenerator

from app.services.vector_store import vector_store
from app.core.llm import llm_client
from app.services.rag_service import SYSTEM_PROMPT, RAG_PROMPT_TEMPLATE, build_context
from app.models.schemas import ChatMessage


def _sse_event(event: str, data: dict) -> str:
    """构造 SSE 事件字符串（双换行结尾）"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def chat_stream(
    messages: List[ChatMessage],
    top_k: int = 5,
) -> AsyncGenerator[str, None]:
    """
    流式聊天生成器 - 输出 SSE 格式事件

    事件类型：
    - marker: 状态标记（检索中/命中/完成/错误）
    - sources: 检索到的制度片段
    - delta: LLM 生成的文本片段
    - done: 生成完成
    - error: 错误信息
    """
    try:
        # 取最后一条 user message 作为问题
        user_messages = [m for m in messages if m.role == "user"]
        if not user_messages:
            yield _sse_event("error", {"message": "没有找到用户消息"})
            return

        question = user_messages[-1].content

        # 1. 发送检索中标记
        yield _sse_event("marker", {"type": "retrieving", "label": "正在检索知识库"})

        # 2. 从向量库检索相关 chunk
        sources = vector_store.search(question, top_k)

        if not sources:
            yield _sse_event("marker", {
                "type": "no_results",
                "label": "未找到明确依据",
            })
            yield _sse_event("sources", {"sources": []})
            yield _sse_event("delta", {
                "text": "当前知识库中没有找到与您的问题相关的制度文档。请先上传相关制度文件，或者尝试换一种方式提问。",
            })
            yield _sse_event("done", {})
            return

        # 3. 发送检索到的来源
        yield _sse_event("marker", {
            "type": "found",
            "label": f"已命中 {len(sources)} 条制度片段",
        })

        sources_data = [
            {
                "chunk_id": src["chunk_id"],
                "filename": src["filename"],
                "text": src["text"][:300] + "..." if len(src["text"]) > 300 else src["text"],
                "score": src["score"],
                "chunk_index": src["chunk_index"],
            }
            for src in sources
        ]
        yield _sse_event("sources", {"sources": sources_data})

        # 4. 构造 RAG prompt
        context = build_context(sources)
        user_prompt = RAG_PROMPT_TEMPLATE.format(question=question, context=context)

        rag_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        # 5. 流式调用 LLM
        yield _sse_event("marker", {"type": "generating", "label": "正在生成回答"})

        async for token in llm_client.stream_chat(rag_messages):
            yield _sse_event("delta", {"text": token})

        # 6. 完成
        yield _sse_event("marker", {"type": "done", "label": "生成完成"})
        yield _sse_event("done", {})

    except Exception as e:
        print(f"[ChatStream] 错误: {e}")
        yield _sse_event("error", {"message": f"知识库查询失败: {str(e)}"})
