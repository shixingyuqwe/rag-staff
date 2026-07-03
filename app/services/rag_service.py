"""
RAG 流程编排 - 把检索和生成串联起来

学习要点：
- RAG = Retrieval（检索） + Augmented（增强） + Generation（生成）
- 完整流程：问题 → 检索相关 chunk → 拼接 context → 调用 LLM → 返回答案 + 来源
- Prompt 设计原则：
  1. 明确角色（人事制度问答助手）
  2. 明确约束（只基于给定片段回答，不要编造）
  3. 明确输出格式（回答 + 依据 + 风险提示）
"""

from typing import List

from app.services.vector_store import vector_store
from app.core.llm import llm_client
from app.models.schemas import QueryResponse, SourceChunk


# 系统提示词 - 设定 LLM 的角色和行为约束
SYSTEM_PROMPT = """你是一个严谨的人事制度问答助手。

请遵守以下规则：
1. 只基于给定的制度片段回答问题
2. 如果制度片段中没有答案，请明确回答"当前知识库中没有找到明确依据"
3. 不要编造、推测或补充制度中没有的内容
4. 回答要简洁、准确、有据可查
5. 如果制度内容含糊不清，建议用户进行人工确认"""

# RAG 查询模板 - 将问题和检索到的制度片段组合成 prompt
RAG_PROMPT_TEMPLATE = """请基于以下制度片段回答用户的问题。

问题：
{question}

制度片段：
{context}

请输出：
1. 简洁回答
2. 依据说明（引用具体片段来源）
3. 如依据不足，请说明需要人工确认"""


def build_context(sources: List[dict]) -> str:
    """
    将检索到的多个 chunk 拼接成 context 文本

    每个 chunk 标注来源文件名，方便 LLM 引用
    """
    parts = []
    for i, src in enumerate(sources, 1):
        parts.append(
            f"【片段{i}】（来源：{src['filename']}，"
            f"相似度：{src['score']:.2f}）\n{src['text']}"
        )
    return "\n\n---\n\n".join(parts)


async def rag_query(question: str, top_k: int = 3) -> QueryResponse:
    """
    执行完整的 RAG 查询流程

    参数：
        question: 用户的问题
        top_k: 检索最相关的几个片段

    返回：
        QueryResponse，包含 answer（LLM 回答）和 sources（引用来源）
    """
    # Step 1: 从向量库检索相关 chunk
    sources = vector_store.search(question, top_k)

    if not sources:
        return QueryResponse(
            answer="当前知识库中没有任何制度文档，请先上传相关文件。",
            sources=[],
        )

    # Step 2: 构建 context（把检索到的片段拼成文本）
    context = build_context(sources)

    # Step 3: 组装对话消息
    user_prompt = RAG_PROMPT_TEMPLATE.format(
        question=question,
        context=context,
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # Step 4: 调用 LLM 生成回答
    answer = await llm_client.chat(messages)

    # Step 5: 构建来源列表
    source_chunks = [
        SourceChunk(
            chunk_id=src["chunk_id"],
            filename=src["filename"],
            text=(
                src["text"][:200] + "..."
                if len(src["text"]) > 200
                else src["text"]
            ),
            score=src["score"],
            chunk_index=src["chunk_index"],
        )
        for src in sources
    ]

    return QueryResponse(answer=answer, sources=source_chunks)
