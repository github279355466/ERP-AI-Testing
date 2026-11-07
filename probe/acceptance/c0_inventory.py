#!/usr/bin/env python3
# C 项取证 0：盘点 artifacts/knowledge 下实际文件、顶层类型、条目数、样例键
import os, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

KD = "artifacts/knowledge"
files = sorted(os.listdir(KD))
report = {}
for name in files:
    p = os.path.join(KD, name)
    if not os.path.isfile(p): continue
    size = os.path.getsize(p)
    with open(p, encoding="utf-8") as fh:
        head = fh.read(2).strip()
    entry = {"size_bytes": size, "top": None, "count": None, "keys": [], "sample": None}
    if head.startswith("["):
        entry["top"] = "array"
        n = 0; first = None
        for obj in stream_array(p):
            n += 1
            if first is None: first = obj
        entry["count"] = n
        if isinstance(first, dict):
            entry["keys"] = sorted(first.keys())
            entry["sample"] = {k: first[k] for k in list(first.keys())[:6]}
    elif head.startswith("{"):
        entry["top"] = "object"
        d = json.load(open(p, encoding="utf-8"))
        entry["keys"] = sorted(d.keys()) if isinstance(d, dict) else []
        entry["sample"] = d
    report[name] = entry
    print(name, entry["top"], entry["count"], "size=", size, "keys=", entry["keys"][:14])

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "c0_inventory.json")
json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", out)
print("JSON_COUNT", len([k for k in report if k.endswith(".json")]))
