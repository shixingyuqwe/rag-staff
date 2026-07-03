"""
FastAPI 应用入口

学习要点：
- FastAPI() 创建应用实例，类似于 Express 的 const app = express()
- app.add_middleware() 添加中间件，类似于 Express 的 app.use(cors())
- app.include_router() 注册路由模块，类似于 Express 的 app.use('/api', router)
- @app.get("/") 是装饰器语法，把函数注册为 GET / 的处理函数
- async def 表示异步函数，FastAPI 支持异步处理以提高并发性能
"""

import sys
# Windows 控制台默认使用 GBK 编码，无法正确输出中文
# 强制设置为 UTF-8，避免 print 中文时报错
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.core.config import settings


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用"""

    app = FastAPI(
        title="HR Policy RAG",
        description="人事制度知识库 RAG 系统 - 上传制度文档，智能问答",
        version="0.1.0",
    )

    # 添加 CORS 中间件，允许前端跨域访问
    # 开发阶段允许所有来源，生产环境应限制为具体域名
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 确保数据目录存在
    @app.on_event("startup")
    async def startup():
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
        Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)

    # 根路由 - 基本信息服务
    @app.get("/")
    async def root():
        return {
            "service": "HR Policy RAG",
            "version": "0.1.0",
            "description": "人事制度知识库 RAG 系统",
        }

    # 健康检查接口
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # 注册 API 路由
    from app.api.kb import router as kb_router
    app.include_router(kb_router, prefix="/api/kb", tags=["knowledge-base"])

    return app


# 创建应用实例，uvicorn 会引用这个变量
app = create_app()
