"""
Embedding 模型封装 - 将文本转换为向量表示

学习要点：
- Embedding 是什么？把一段文字变成一个数字数组（向量），语义相似的文字向量也相近
- 为什么用本地模型？免费、无需 API Key、中文效果好
- 懒加载模式：第一次使用时才加载模型，避免启动时等待 10-30 秒
- normalize_embeddings=True：归一化向量，使余弦相似度计算更准确
- 类比：就像把每句话变成地图上的一个坐标点，语义相近的句子坐标也靠近
"""

from sentence_transformers import SentenceTransformer
from typing import List

from app.core.config import settings


class ChineseEmbedding:
    """
    中文 Embedding 模型封装

    使用 BAAI/bge-small-zh-v1.5 模型：
    - 专为中文优化
    - 模型大小约 100MB，CPU 上也能快速推理
    - 输出 512 维向量
    """

    def __init__(self):
        self._model = None  # 延迟加载

    def _load_model(self):
        """首次调用时加载模型（懒加载模式）"""
        if self._model is None:
            print(f"[Embedding] 正在加载模型: {settings.embedding_model}")
            print("[Embedding] 首次加载需要下载模型文件，请耐心等待...")
            self._model = SentenceTransformer(settings.embedding_model)
            print("[Embedding] 模型加载完成!")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        将多个文本转换为向量（用于存入向量库）

        参数：
            texts: 文本列表

        返回：
            向量列表，每个向量是一个 float 数组
        """
        self._load_model()
        # normalize_embeddings=True 使向量长度为 1，方便计算余弦相似度
        embeddings = self._model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[List[float]]:
        """
        将单个查询文本转换为向量（用于检索）

        参数：
            text: 查询文本

        返回：
            向量列表（Chroma 要求返回二维列表）
        """
        return self.embed_documents([text])

    def __call__(self, input: List[str]) -> List[List[float]]:
        """
        实现 Chroma 的 EmbeddingFunction 协议
        Chroma 内部会调用此方法来把文本转为向量

        参数：
            input: 文本列表

        返回：
            向量列表
        """
        return self.embed_documents(input)


# 全局单例 - 其他地方 import embedding_fn 即可使用
embedding_fn = ChineseEmbedding()
