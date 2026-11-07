#!/usr/bin/env python3
# 轻量流式读取「顶层为数组」的大 JSON 文件（rules.json 37MB / fields.json 14MB），
# 一次只在内存里保留一个对象，避免整文件载入。
import json
from typing import Iterator, Any

CHUNK = 1 << 20  # 1 MiB

def stream_array(file_path: str, encoding: str = "utf-8") -> Iterator[Any]:
    decoder = json.JSONDecoder()
    with open(file_path, "r", encoding=encoding) as fh:
        buf = ""
        eof = False
        pos = 0

        def fill() -> bool:
            nonlocal buf, pos, eof
            if eof:
                return False
            piece = fh.read(CHUNK)
            if not piece:
                eof = True
                return False
            # 丢弃已消费部分，控制内存
            if pos > 0:
                buf = buf[pos:]
                pos = 0
            buf += piece
            return True

        def skip_ws() -> bool:
            nonlocal pos
            while True:
                while pos < len(buf) and buf[pos] in " \t\r\n":
                    pos += 1
                if pos < len(buf):
                    return True
                if not fill():
                    return False

        # 定位数组起始
        if not skip_ws():
            raise ValueError(f"{file_path}: 空文件")
        if buf[pos] != "[":
            raise ValueError(f"{file_path}: 顶层不是数组，实际 {buf[pos]!r}")
        pos += 1
        while True:
            if not skip_ws():
                raise ValueError(f"{file_path}: 数组未闭合")
            if buf[pos] == "]":
                return
            if buf[pos] == ",":
                pos += 1
                continue
            # 尝试从当前位置解码一个对象；数据不足则继续读
            while True:
                try:
                    obj, end = decoder.raw_decode(buf, pos)
                    pos = end
                    break
                except json.JSONDecodeError:
                    if not fill():
                        raise
            yield obj
