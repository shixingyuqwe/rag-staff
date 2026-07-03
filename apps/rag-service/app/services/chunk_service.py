"""
文本切分模块 - 将长文档切分为适合检索的小块（chunk）

学习要点：
- 为什么需要切分？
  1. LLM 上下文窗口有限，不能塞入整篇文档
  2. 小块文本检索更精准（整篇文档会引入太多噪音）
  3. 太小则丢失上下文，太大则语义不聚焦
- chunk_size: 每个 chunk 的目标字符数（中文按字符计算）
- chunk_overlap: 相邻 chunk 之间的重叠区域，防止在句子中间断开
- 句子边界检测：优先在句号、感叹号、问号等处断开
"""

from typing import List, Dict


def chunk_text(
    text: str,
    document_id: str,
    filename: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> List[Dict]:
    """
    将长文本切分为多个 chunk。

    切分策略：
    1. 按 chunk_size 大小滑动窗口
    2. 在每个窗口的末尾附近寻找句子边界（中文标点）
    3. 在句子边界处断开，保持语义完整性
    4. 相邻 chunk 保留 chunk_overlap 个字符的重叠

    参数：
        text: 待切分的全文文本
        document_id: 文档唯一标识
        filename: 文件名（用于来源追溯）
        chunk_size: 目标 chunk 大小（字符数）
        chunk_overlap: 相邻 chunk 的重叠字符数

    返回：
        chunk 列表，每个 chunk 是一个字典
    """
    chunks = []
    start = 0
    chunk_index = 0

    # 中文和英文的句子分隔符
    sentence_endings = ["。", "！", "？", "\n", ". ", "! ", "? "]

    while start < len(text):
        end = start + chunk_size

        # 尝试在句子边界处断开
        if end < len(text):
            # 在 [start*0.7, end] 范围内寻找最后一个句子结束符
            window = text[start:end]
            best_break = -1

            for sep in sentence_endings:
                pos = window.rfind(sep)
                if pos > int(chunk_size * 0.5) and pos > best_break:
                    best_break = pos + len(sep)

            if best_break > 0:
                end = start + best_break

        # 提取 chunk 文本
        chunk_text_slice = text[start:end].strip()

        if chunk_text_slice:
            chunk_index += 1
            chunks.append({
                "chunk_id": f"{document_id}_chunk_{chunk_index:04d}",
                "document_id": document_id,
                "filename": filename,
                "text": chunk_text_slice,
                "metadata": {
                    "chunk_index": chunk_index,
                    "start_char": start,
                    "end_char": end,
                },
            })

        # 滑动窗口：前进到 end 位置，但回退 overlap 以保持连续性
        start = end - chunk_overlap

        # 防止死循环（当 overlap >= chunk_size 时）
        if start <= (end - chunk_size) and end < len(text):
            start = end

    return chunks
