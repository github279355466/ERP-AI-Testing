#!/usr/bin/env python3
# A 项取证 2：真实文件系统 vs DOCUMENT_REGISTER.json vs scan-report.md 逐项核对
import os, json, re, hashlib, collections

BASE = os.path.dirname(os.path.abspath(__file__))
INV = json.load(open(os.path.join(BASE, "a1_fs_inventory.json"), encoding="utf-8"))
files = INV["files"]
REG = json.load(open("artifacts/source-index/DOCUMENT_REGISTER.json", encoding="utf-8"))
STATE = json.load(open("artifacts/source-index/.scan-state.json", encoding="utf-8"))

PRD_ORIGINAL = re.compile(r"/DOC\d+_[^/]+_V\d+(?:\.\d+)*\.md$", re.I)
def role_of(root, rel):
    if root == "PRD": return "PRD"
    return "PRD" if PRD_ORIGINAL.search("/" + rel) else "TEST_CASE_LIBRARY"

# 登记表用 relative_path 标识，注意 PRD / CASES 可能有同名相对路径
reg_by_path = collections.defaultdict(list)
for d in REG["documents"]:
    reg_by_path[d["relative_path"]].append(d)

inv_by_path = collections.defaultdict(list)
for f in files:
    inv_by_path[f["relative_path"]].append(f)

print("=== 计数 ===")
print("FS_TOTAL", len(files), "FS_PRD", sum(1 for f in files if f["root"]=="PRD"),
      "FS_CASES", sum(1 for f in files if f["root"]=="CASES"))
print("REG_DOCS", len(REG["documents"]), "REG_UNIQUE_PATHS", len(reg_by_path))
print("FS_UNIQUE_PATHS", len(inv_by_path))
print("REGISTER_SUMMARY", json.dumps(REG["summary"], ensure_ascii=False))
print("SCAN_STATE_VERSION", STATE.get("version"), "STATE_FILES", len(STATE.get("files", {})),
      "UPDATED_AT", STATE.get("updated_at"))

# 分类统计 FS 中被跳过的文件
print("\n=== FS 分类（按 pipeline 规则推导）===")
cls = collections.Counter()
for f in files:
    r = role_of(f["root"], f["relative_path"])
    if r == "TEST_CASE_LIBRARY" and not re.search(r"test-cases\.json$", f["file_name"], re.I):
        cls["TEST_CASE_LIBRARY_NON_TESTCASES(skipped)"] += 1
    elif r == "TEST_CASE_LIBRARY":
        cls["TEST_CASE_LIBRARY_TESTCASES(registered)"] += 1
    else:
        cls["PRD(registered)"] += 1
for k,v in cls.items(): print(" ", k, v)
print("  EXPECTED_REGISTER", cls["TEST_CASE_LIBRARY_TESTCASES(registered)"] + cls["PRD(registered)"])

# 漏扫 / 多报
print("\n=== 漏扫（磁盘存在但登记表无）与多报（登记表有但磁盘不存在）===")
reg_paths = set(reg_by_path)
fs_paths = set(inv_by_path)
missing_in_reg = sorted(fs_paths - reg_paths)
extra_in_reg = sorted(reg_paths - fs_paths)
print("MISSING_IN_REG_COUNT", len(missing_in_reg))
print("EXTRA_IN_REG_COUNT", len(extra_in_reg))
print("MISSING_IN_REG_SAMPLE", json.dumps(missing_in_reg[:25], ensure_ascii=False))
print("EXTRA_IN_REG_SAMPLE", json.dumps(extra_in_reg[:25], ensure_ascii=False))
# 漏扫里有多少是 pipeline 有意跳过的
msk = collections.Counter()
for p in missing_in_reg:
    for f in inv_by_path[p]:
        r = role_of(f["root"], f["relative_path"])
        msk["skip_aux_case" if (r=="TEST_CASE_LIBRARY" and not re.search(r"test-cases\.json$", f["file_name"], re.I)) else "UNEXPECTED"] += 1
print("MISSING_IN_REG_BREAKDOWN", json.dumps(dict(msk), ensure_ascii=False))
unexpected = [p for p in missing_in_reg if any(
    (role_of(f["root"], f["relative_path"])=="PRD" or re.search(r"test-cases\.json$", f["file_name"], re.I))
    for f in inv_by_path[p])]
print("UNEXPECTED_MISSING_COUNT", len(unexpected))
print("UNEXPECTED_MISSING_SAMPLE", json.dumps(unexpected[:30], ensure_ascii=False))

# 同名相对路径跨 root 冲突
dup_paths = {p: [f["root"] for f in fs_paths_items] for p, fs_paths_items in inv_by_path.items()
             if len({f["root"] for f in fs_paths_items}) > 1}
print("CROSS_ROOT_SAME_REL_PATH", len(dup_paths), json.dumps(list(dup_paths.items())[:10], ensure_ascii=False))

# ID 唯一 / 格式 / 与路径&哈希解耦
print("\n=== ID / 版本 / 哈希 ===")
ids = [d["document_id"] for d in REG["documents"]]
print("ID_DUP_COUNT", len(ids)-len(set(ids)))
print("ID_FORMAT_BAD", json.dumps([i for i in ids if not re.fullmatch(r"DOC-[0-9A-F]{12}", i)][:10], ensure_ascii=False))
print("DOC_VERSION_NULL", sum(1 for d in REG["documents"] if d.get("doc_version") is None))
print("DOC_VERSION_SET", sum(1 for d in REG["documents"] if d.get("doc_version")))
print("STATUS_DIST", json.dumps(dict(collections.Counter(d.get("status") for d in REG["documents"])), ensure_ascii=False))
print("SOURCE_ROLE_DIST", json.dumps(dict(collections.Counter(d.get("source_role") for d in REG["documents"])), ensure_ascii=False))
print("PARSER_DIST", json.dumps(dict(collections.Counter(d.get("parser") for d in REG["documents"])), ensure_ascii=False))
print("MODULE_DIST", json.dumps(dict(collections.Counter(d.get("module") for d in REG["documents"])), ensure_ascii=False))

# 抽验 >=30 条：分层抽样（不同 root / 扩展名 / top_dir / 含根目录散落）
import random
random.seed(20261107)
candidates = []
for d in REG["documents"]:
    fs_candidates = inv_by_path.get(d["relative_path"], [])
    candidates.append((d, fs_candidates))
# 分层：按 (root, ext, top_dir) 分组各取 1-2，再补足到至少 40
groups = collections.defaultdict(list)
for d, fsc in candidates:
    for f in fsc:
        groups[(f["root"], f["extension"], f["top_dir"])].append((d,f))
picked = []
seen = set()
for k in sorted(groups, key=lambda x: str(x)):
    for item in groups[k][:2]:
        if item[0]["document_id"] not in seen:
            seen.add(item[0]["document_id"]); picked.append(item)
# 根目录散落文件强制纳入
for d, fsc in candidates:
    if d["relative_path"].startswith("四单PRD-") and d["document_id"] not in seen:
        for f in fsc:
            seen.add(d["document_id"]); picked.append((d,f)); break
for d, fsc in candidates:
    if len(picked) >= 45: break
    if d["document_id"] not in seen and fsc:
        seen.add(d["document_id"]); picked.append((d, fsc[0]))
print("SAMPLE_SIZE", len(picked))
mismatch_hash=[]; mismatch_size=[]; mismatch_mtime=[]; mismatch_id=[]; sample_rows=[]
for d, f in picked:
    real = f["sha256"]
    key = f"{role_of(f['root'], f['relative_path'])}:{f['relative_path']}"
    expect_id = "DOC-" + hashlib.sha256(key.lower().encode("utf-8")).hexdigest()[:12].upper()
    if d["sha256"] != real: mismatch_hash.append((d["relative_path"], d["sha256"][:16], real[:16]))
    if d["size_bytes"] != f["size_bytes"]: mismatch_size.append((d["relative_path"], d["size_bytes"], f["size_bytes"]))
    if d["modified_at"] != f["modified_at"]: mismatch_mtime.append((d["relative_path"], d["modified_at"], f["modified_at"]))
    if d["document_id"] != expect_id: mismatch_id.append((d["relative_path"], d["document_id"], expect_id))
    sample_rows.append({"path": d["relative_path"], "root": f["root"], "ext": f["extension"],
                        "top": f["top_dir"], "id": d["document_id"], "hash_ok": d["sha256"]==real,
                        "size_ok": d["size_bytes"]==f["size_bytes"], "mtime_ok": d["modified_at"]==f["modified_at"],
                        "id_ok": d["document_id"]==expect_id, "version": d["doc_version"], "module": d["module"]})
print("HASH_MISMATCH", len(mismatch_hash), json.dumps(mismatch_hash[:10], ensure_ascii=False))
print("SIZE_MISMATCH", len(mismatch_size), json.dumps(mismatch_size[:10], ensure_ascii=False))
print("MTIME_MISMATCH", len(mismatch_mtime), json.dumps(mismatch_mtime[:10], ensure_ascii=False))
print("ID_RECOMPUTE_MISMATCH", len(mismatch_id), json.dumps(mismatch_id[:10], ensure_ascii=False))
print("SAMPLE_ROOT_DIST", json.dumps(dict(collections.Counter(r["root"] for r in sample_rows)), ensure_ascii=False))
print("SAMPLE_EXT_DIST", json.dumps(dict(collections.Counter(r["ext"] for r in sample_rows)), ensure_ascii=False))
print("SAMPLE_TOP_DIST_N", len(set(r["top"] for r in sample_rows)))
print("SAMPLE_ROOTFILES", json.dumps([r["path"] for r in sample_rows if r["path"].startswith("四单PRD-")], ensure_ascii=False))
json.dump({"sample": sample_rows, "missing_in_reg": missing_in_reg, "extra_in_reg": extra_in_reg,
           "unexpected_missing": unexpected},
          open(os.path.join(BASE,"a2_register_diff.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", os.path.join(BASE,"a2_register_diff.json"))
