"""
Chroma 向量库操作封装

学习要点：
- 向量数据库的作用：存储文本的向量表示，支持语义相似度检索
- Chroma 是一个轻量级向量数据库，适合学习和小规模项目
- PersistentClient：数据持久化到本地磁盘，重启后数据不会丢失
- Collection：类似数据库中的表，一个 collection 存储一组相关的向量
- 余弦相似度（cosine similarity）：衡量两个向量的语义接近程度，值域 [0, 1]
"""

import chromadb
from typing import List, Dict

from app.core.config import settings
from app.core.embeddings import embedding_fn


class VectorStore:
    """Chroma 向量库操作封装"""

    def __init__(self):
        """初始化 Chroma 持久化客户端和集合"""
        print("[VectorStore] 正在初始化 Chroma 向量库...")

        # PersistentClient 会将数据保存到磁盘
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
        )

        # 获取或创建集合
        # metadata 中的 hnsw:space 指定距离度量方式（cosine = 余弦相似度）
        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={"hnsw:space": "cosine"},
        )

        print(f"[VectorStore] 集合 '{settings.chroma_collection}' 已就绪，"
              f"当前包含 {self.collection.count()} 个文档")

    def add_chunks(self, chunks: List[Dict]):
        """
        将 chunk 列表写入向量库

        流程：
        1. 用我们自己的 embedding 模型把文本转为向量
        2. 把向量和文本一起存入 Chroma

        参数：
            chunks: chunk 列表，每个 chunk 包含 chunk_id, text, document_id, filename, metadata
        """
        if not chunks:
            return

        ids = [c["chunk_id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [
            {
                "document_id": c["document_id"],
                "filename": c["filename"],
                "chunk_index": c["metadata"]["chunk_index"],
            }
            for c in chunks
        ]

        # 用我们自己的 embedding 模型生成向量（而不是让 Chroma 自动处理）
        print(f"[VectorStore] 正在生成 {len(chunks)} 个 chunk 的 embedding...")
        embeddings = embedding_fn.embed_documents(documents)

        # 把 id、文本、向量、metadata 一起存入 Chroma
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        print(f"[VectorStore] 成功写入 {len(chunks)} 个 chunk")

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        语义检索：根据查询文本找到最相关的 chunk

        流程：
        1. 用 embedding 模型把查询转为向量
        2. 在 Chroma 中查找最相似的向量
        3. 返回对应的文本和 metadata

        参数：
            query: 用户的查询问题
            top_k: 返回最相关的几个结果

        返回：
            相关 chunk 列表，按相似度从高到低排序
        """
        if self.collection.count() == 0:
            return []

        # 用我们自己的模型生成查询向量
        query_embedding = embedding_fn.embed_query(query)

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=min(top_k, self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        # 整理返回格式
        sources = []
        for i in range(len(results["ids"][0])):
            # Chroma 返回的是 cosine distance，转换为 similarity
            # distance = 1 - similarity，所以 similarity = 1 - distance
            distance = results["distances"][0][i]
            similarity = 1 - distance

            sources.append({
                "chunk_id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "filename": results["metadatas"][0][i]["filename"],
                "chunk_index": results["metadatas"][0][i]["chunk_index"],
                "score": round(similarity, 4),
            })

        return sources

    def get_document_chunk_count(self, document_id: str) -> int:
        """获取指定文档的 chunk 数量"""
        results = self.collection.get(
            where={"document_id": document_id},
            include=[],
        )
        return len(results["ids"])


# 全局单例
vector_store = VectorStore()
