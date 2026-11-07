#!/usr/bin/env python3
# A 项取证 3：重复文件 / 多版本 / .scan-state.json / scan-report.md 一致性 / 版本取最新规则
import os, json, re, collections, hashlib

BASE = os.path.dirname(os.path.abspath(__file__))
INV = json.load(open(os.path.join(BASE, "a1_fs_inventory.json"), encoding="utf-8"))
files = INV["files"]
REG = json.load(open("artifacts/source-index/DOCUMENT_REGISTER.json", encoding="utf-8"))
STATE = json.load(open("artifacts/source-index/.scan-state.json", encoding="utf-8"))
SCANMD = open("artifacts/source-index/scan-report.md", encoding="utf-8").read()
VCMD = open("reports/VERSION_CONFLICTS.md", encoding="utf-8").read()
MAPMD = open("docs/PRD-MAPPING.md", encoding="utf-8").read()
PRD_ORIGINAL = re.compile(r"/DOC\d+_[^/]+_V\d+(?:\.\d+)*\.md$", re.I)
def role_of(f):
    return "PRD" if f["root"]=="PRD" else ("PRD" if PRD_ORIGINAL.search("/"+f["relative_path"]) else "TEST_CASE_LIBRARY")

print("=== 辅助目录分布（PRD root）===")
aux = collections.Counter()
for f in files:
    for p in f["relative_path"].split("/")[:-1]:
        if p.startswith("_"): aux[p] += 1
print(json.dumps(dict(aux.most_common()), ensure_ascii=False))
print("AUX_FILES_TOTAL", sum(1 for f in files if any(p.startswith("_") for p in f["relative_path"].split("/")[:-1])))
print("ROOT_SCATTER_PRD", json.dumps([f["relative_path"] for f in files if f["root"]=="PRD" and "/" not in f["relative_path"]], ensure_ascii=False))
print("ROOT_SCATTER_CASES", json.dumps([f["relative_path"] for f in files if f["root"]=="CASES" and "/" not in f["relative_path"]], ensure_ascii=False))

print("\n=== 重复文件（同 SHA-256 不同路径）===")
by_hash = collections.defaultdict(list)
for f in files: by_hash[f["sha256"]].append(f)
dup_groups = {h:v for h,v in by_hash.items() if len(v)>1}
print("DUP_HASH_GROUPS", len(dup_groups), "DUP_FILES", sum(len(v) for v in dup_groups.values()))
for h,v in list(dup_groups.items())[:12]:
    print("  ", h[:12], [x["root"]+":"+x["relative_path"] for x in v])
# 登记表中这些重复文件是否都登记
reg_paths = {d["relative_path"] for d in REG["documents"]}
dup_in_reg = sum(1 for v in dup_groups.values() for x in v if x["relative_path"] in reg_paths)
dup_not_in_reg = sum(1 for v in dup_groups.values() for x in v if x["relative_path"] not in reg_paths)
print("DUP_IN_REGISTER", dup_in_reg, "DUP_NOT_IN_REGISTER", dup_not_in_reg)

print("\n=== 多版本（按 job_directory 分组，PRD）===")
def job_dir_of(rel):
    parts = rel.split("/")[:-1]
    meaningful = [p for p in parts if not p.startswith("_") and not p.endswith("域")]
    return meaningful[-1] if meaningful else (parts[0] if parts else "(ROOT)")
ver_groups = collections.defaultdict(list)
for d in REG["documents"]:
    if d["source_role"]!="PRD": continue
    ver_groups[job_dir_of(d["relative_path"])].append(d)
multi = {k:v for k,v in ver_groups.items() if len(v)>1}
print("PRD_JOB_GROUPS", len(ver_groups), "MULTI_DOC_GROUPS", len(multi))
# 版本号解析规则：从文件名 vN.M
def ver_from_name(name):
    m = re.search(r"[vV](\d+(?:\.\d+)*)", name)
    return m.group(1) if m else None
multi_ver = 0
for k,v in multi.items():
    vs = {ver_from_name(x["file_name"]) for x in v} - {None}
    if len(vs)>1: multi_ver += 1
print("GROUPS_WITH_MULTIPLE_VERSION_TOKENS", multi_ver)
print("DOC_VERSION_NULL_IN_PRD", sum(1 for d in REG["documents"] if d["source_role"]=="PRD" and d["doc_version"] is None))
print("VERSION_CONFLICTS_TABLE_ROWS", len([l for l in VCMD.splitlines() if l.startswith("| ") and "存在多个文档版本" in l]))
print("VERSION_CONFLICTS_DETAIL_SECTIONS", len([l for l in VCMD.splitlines() if l.startswith("### ")]))
print("PRD_MAPPING_LATEST_ROWS", len([l for l in MAPMD.splitlines() if re.match(r"^\| [\u4e00-\u9fa5]+ \| v\d", l)]))

print("\n=== .scan-state.json 核对 ===")
state_files = STATE["files"]
print("STATE_KEYS", len(state_files))
computed = {}
for f in files:
    key = f"{role_of(f)}:{f['relative_path']}"
    computed[key] = f
missing_state = sorted(set(computed) - set(state_files))
extra_state = sorted(set(state_files) - set(computed))
print("FS_KEYS_NOT_IN_STATE", len(missing_state), json.dumps(missing_state[:10], ensure_ascii=False))
print("STATE_KEYS_NOT_ON_DISK", len(extra_state), json.dumps(extra_state[:10], ensure_ascii=False))
hash_bad=[]; id_bad=[]
for k,e in state_files.items():
    f = computed.get(k)
    if not f: continue
    if e.get("sha256") != f["sha256"]: hash_bad.append(k)
    expect = "DOC-"+hashlib.sha256(k.lower().encode()).hexdigest()[:12].upper()
    if e.get("document_id") != expect: id_bad.append(k)
print("STATE_HASH_MISMATCH", len(hash_bad), json.dumps(hash_bad[:10], ensure_ascii=False))
print("STATE_ID_MISMATCH", len(id_bad), json.dumps(id_bad[:10], ensure_ascii=False))

print("\n=== scan-report.md 辅助文件清单核对 ===")
listed = re.findall(r"^- (.+?)（辅助资料，当前阶段只登记不建模）$", SCANMD, re.M)
listed = [x.strip() for x in listed]
print("SCAN_REPORT_AUX_LISTED", len(listed))
reg_paths_set = set(reg_paths)
fs_paths_set = {f["relative_path"] for f in files}
expected_aux = sorted(fs_paths_set - reg_paths_set)
print("EXPECTED_AUX", len(expected_aux))
print("LISTED_NOT_IN_EXPECTED", len(set(listed)-set(expected_aux)), json.dumps(sorted(set(listed)-set(expected_aux))[:10], ensure_ascii=False))
print("EXPECTED_NOT_LISTED", len(set(expected_aux)-set(listed)), json.dumps(sorted(set(expected_aux)-set(listed))[:10], ensure_ascii=False))
print("DUP_LISTED_ENTRIES", len(listed)-len(set(listed)))
print("SCAN_REPORT_METRICS_ROWS", json.dumps(re.findall(r"^\| (文件总数|支持格式|不支持格式|新增|修改|未变化|源文件缺失|解析错误) \| (\d+) \|", SCANMD, re.M), ensure_ascii=False))

print("\n=== mtime 精度差确认 ===")
SAMPLE = json.load(open(os.path.join(BASE,"a2_register_diff.json"), encoding="utf-8"))["sample"]
# 重新按毫秒归一比对
ok=0; bad=[]
for r in SAMPLE:
    d = next((x for x in REG["documents"] if x["relative_path"]==r["path"]), None)
    f = next((x for x in files if x["relative_path"]==r["path"]), None)
    if not d or not f: continue
    a = d["modified_at"].replace("Z","")
    b = f["modified_at"].replace("Z","")
    # 截到毫秒
    def ms(s): return s[:23]
    if ms(a)==ms(b): ok+=1
    else: bad.append((r["path"],a,b))
print("MTIME_MS_EQUAL", ok, "MTIME_REAL_DIFF", len(bad), json.dumps(bad[:5], ensure_ascii=False))
