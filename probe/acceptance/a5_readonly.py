#!/usr/bin/env python3
# A 项取证 5：原始 PRD 只读核验（文件系统属性 + 时间戳 + 抽样哈希复算）
import os, json, hashlib, stat, datetime, collections
BASE = os.path.dirname(os.path.abspath(__file__))
INV = json.load(open(os.path.join(BASE, "a1_fs_inventory.json"), encoding="utf-8"))
files = INV["files"]
PRD_ROOT = INV["prd_root"]; CASES_ROOT = INV["cases_root"]

print("=== 目录属性 ===")
for label, root in [("PRD", PRD_ROOT), ("CASES", CASES_ROOT)]:
    st = os.stat(root)
    mode = stat.filemode(st.st_mode)
    print(label, root, "mode=", mode, "writable_by_owner=", bool(st.st_mode & stat.S_IWUSR))

print("\n=== 文件属性抽样（含辅助目录 / 根目录散落 / 用例库） ===")
targets = []
for f in files:
    if f["root"] == "PRD" and "/" not in f["relative_path"]: targets.append(f)
for seg in ["_history", "_diff", "_upload", "_dup_20261106"]:
    cand = [f for f in files if seg in f["relative_path"].split("/")[:-1] and f["root"] == "PRD"]
    if cand: targets.append(cand[0])
for f in files:
    if f["root"] == "CASES" and f["file_name"] == "test-cases.json":
        targets.append(f); break
readonly_flags = collections.Counter()
for f in targets[:20]:
    st = os.stat(f["absolute_path"])
    readonly_flags["readonly" if not (st.st_mode & stat.S_IWUSR) else "writable"] += 1
    print(" ", f["root"], f["relative_path"][:70], "mode=", stat.filemode(st.st_mode),
          "mtime=", datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc).isoformat())
print("ATTR_SUMMARY", dict(readonly_flags))

print("\n=== 原始 PRD 内容未被改动（抽样哈希复算 vs 登记表） ===")
REG = json.load(open("artifacts/source-index/DOCUMENT_REGISTER.json", encoding="utf-8"))
reg_by_path = {d["relative_path"]: d for d in REG["documents"]}
import random
random.seed(777)
pool = [f for f in files if f["root"] == "PRD"]
random.shuffle(pool)
checked = 0; bad = []
for f in pool[:40]:
    with open(f["absolute_path"], "rb") as fh:
        h = hashlib.sha256(fh.read()).hexdigest()
    checked += 1
    d = reg_by_path.get(f["relative_path"])
    if h != f["sha256"]: bad.append(("inventory_changed", f["relative_path"]))
    if d and d["sha256"] != h: bad.append(("register_mismatch", f["relative_path"]))
print("RECHECKED", checked, "MISMATCH", len(bad), bad[:5])

# 全量 540 与登记表/state 的哈希一致性（复用 a2/a3 结论，这里再独立复算一遍）
mismatch_all = 0
for f in files:
    with open(f["absolute_path"], "rb") as fh:
        if hashlib.sha256(fh.read()).hexdigest() != f["sha256"]:
            mismatch_all += 1
print("ALL_540_HASH_STABLE", mismatch_all == 0, "mismatch=", mismatch_all)
