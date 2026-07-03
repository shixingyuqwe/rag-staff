"""
文档解析模块 - 从不同格式的文件中提取纯文本

学习要点：
- 策略模式：不同文件类型用不同的解析函数，通过字典映射来选择
- pathlib.Path 是 Python 推荐的文件路径操作方式，类似于 Node.js 的 path 模块
- pypdf 读取 PDF，python-docx 读取 Word 文档
- 中文 TXT 文件可能是不同编码（utf-8, gbk, gb2312），需要逐个尝试
"""

from pathlib import Path
from pypdf import PdfReader
from docx import Document as DocxDocument


def parse_pdf(file_path: Path) -> str:
    """
    解析 PDF 文件，提取所有页面的文本。

    注意：
    - pypdf 只能提取"可复制"的文本
    - 扫描件 PDF（图片型）需要用 OCR，本阶段暂不支持
    """
    reader = PdfReader(str(file_path))
    text_parts = []

    for page in reader.pages:
        text = page.extract_text() or ""
        text_parts.append(text)

    full_text = "\n".join(text_parts)

    if not full_text.strip():
        raise ValueError(
            "PDF 文件未能提取到文本。可能是扫描件（图片型 PDF），"
            "请使用可复制文本的 PDF 或 TXT 文件。"
        )

    return full_text


def parse_docx(file_path: Path) -> str:
    """
    解析 DOCX 文件，提取所有段落的文本。
    跳过空段落。
    """
    doc = DocxDocument(str(file_path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs)

    if not full_text.strip():
        raise ValueError("DOCX 文件为空，未提取到任何文本。")

    return full_text


def parse_txt(file_path: Path) -> str:
    """
    解析 TXT 文件。
    中文 TXT 文件可能使用不同编码，按优先级逐个尝试：
    utf-8 → gbk → gb2312
    """
    for encoding in ["utf-8", "gbk", "gb2312"]:
        try:
            text = file_path.read_text(encoding=encoding)
            if not text.strip():
                raise ValueError("TXT 文件为空。")
            return text
        except UnicodeDecodeError:
            continue

    raise ValueError(
        f"无法解码文件 {file_path.name}，尝试了 utf-8/gbk/gb2312 编码均失败。"
    )


# 文件类型 → 解析函数 的映射表
PARSERS = {
    ".pdf": parse_pdf,
    ".docx": parse_docx,
    ".txt": parse_txt,
}


def load_document(file_path: Path) -> str:
    """
    根据文件后缀自动选择解析器，返回纯文本。

    参数：
        file_path: 文件路径

    返回：
        提取出的纯文本字符串

    异常：
        ValueError: 不支持的文件类型或解析失败
    """
    suffix = file_path.suffix.lower()

    if suffix not in PARSERS:
        raise ValueError(
            f"不支持的文件类型: {suffix}。支持: {list(PARSERS.keys())}"
        )

    parser = PARSERS[suffix]
    return parser(file_path)
