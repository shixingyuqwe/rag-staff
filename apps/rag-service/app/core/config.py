"""
配置管理模块
从 .env 文件加载环境变量，提供统一的配置访问接口。

学习要点：
- pydantic_settings.BaseSettings 会自动从环境变量和 .env 文件读取配置
- 每个字段都有类型注解和默认值，类似于 TypeScript 的 interface + default values
- settings = Settings() 创建一个全局单例，其他地方 import 即可使用
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """应用配置，从 .env 文件加载"""

    # DeepSeek LLM 配置
    deepseek_api_key: str = ""  # 留空时 LLM 调用会失败，但不影响启动
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_chat_model: str = "deepseek-chat"

    # Embedding 模型配置
    embedding_model: str = "BAAI/bge-small-zh-v1.5"

    # Chroma 向量库配置
    chroma_persist_dir: str = "app/data/chroma"
    chroma_collection: str = "hr_knowledge"

    # 文件上传目录
    upload_dir: str = "app/data/uploads"

    # 文本切分参数
    chunk_size: int = 1000      # 每个 chunk 的目标字符数
    chunk_overlap: int = 150    # 相邻 chunk 之间的重叠字符数

    # 告诉 Pydantic 从 .env 文件读取配置
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# 创建全局配置单例
settings = Settings()
