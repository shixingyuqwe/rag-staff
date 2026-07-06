"""
DeepSeek LLM 客户端 - 调用大模型生成回答

学习要点：
- DeepSeek API 兼容 OpenAI 格式，所以可以直接用 openai 这个 Python SDK
- 只需要修改 base_url 和 api_key 就能切换到 DeepSeek
- AsyncOpenAI：异步客户端，适合 FastAPI 的异步环境
- temperature：控制回答的随机性，0 = 确定性最高（RAG 场景用低温度）
- messages 格式：system（设定角色）+ user（用户问题）
"""

from openai import AsyncOpenAI
from typing import List, Dict

from app.core.config import settings


class LLMClient:
    """DeepSeek LLM 客户端"""

    def __init__(self):
        # 使用 OpenAI SDK 连接 DeepSeek（API 格式兼容）
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
    ) -> str:
        """
        发送对话请求到 DeepSeek

        参数：
            messages: 对话消息列表，格式如：
                [
                    {"role": "system", "content": "你是一个..."},
                    {"role": "user", "content": "问题内容"},
                ]
            temperature: 温度参数，0-2，越低越确定

        返回：
            模型生成的回答文本
        """
        if not settings.deepseek_api_key or settings.deepseek_api_key == "your_deepseek_api_key_here":
            return "[错误] 请先在 .env 文件中配置 DEEPSEEK_API_KEY"

        try:
            response = await self.client.chat.completions.create(
                model=settings.deepseek_chat_model,
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[错误] LLM 调用失败: {str(e)}"

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
    ):
        """
        流式对话请求 - 逐 token 返回生成内容

        参数：
            messages: 对话消息列表
            temperature: 温度参数

        返回：
            异步生成器，每次 yield 一个文本片段（token）
        """
        if not settings.deepseek_api_key or settings.deepseek_api_key == "your_deepseek_api_key_here":
            yield "[错误] 请先在 .env 文件中配置 DEEPSEEK_API_KEY"
            return

        try:
            response = await self.client.chat.completions.create(
                model=settings.deepseek_chat_model,
                messages=messages,
                temperature=temperature,
                stream=True,
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield f"[错误] LLM 流式调用失败: {str(e)}"


# 全局单例
llm_client = LLMClient()
