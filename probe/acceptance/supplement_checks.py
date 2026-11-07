#!/usr/bin/env python3
# 主理人补充口径取证：02 规范 §2/§3/§4/§15、04 契约 §1/§2/§7
import os, sys, json, collections, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

BASE = os.path.dirname(os.path.abspath(__file__))
KD = "artifacts/knowledge"
OUT = os.path.join(BASE, "supplement_checks.json")
R = {}

# ---- 04 §2 通用字段齐备情况（12 个数组逐类） ----
COMMON = ["id", "object_type", "name", "module", "status", "source_refs",
          "created_by_parser_version", "updated_at"]
ARR = ["documents","entities","pages","fields","controls","rules","actions","workflows",
       "dependencies","scenarios","existing-cases","open-questions"]
common = {}
for name in ARR:
    n = 0; miss = collections.Counter(); extra_id = 0
    for o in stream_array(os.path.join(KD, name + ".json")):
        n += 1
        for k in COMMON:
            if k not in o: miss[k] += 1
        if name == "existing-cases" and "case_id" in o and "id" not in o: extra_id += 1
    common[name] = {"items": n, "missing_count": dict(miss), "missing_fields": sorted(miss),
                    "uses_case_id_instead_of_id": extra_id}
    print("COMMON", name, "n=", n, "missing=", sorted(miss))
R["common_fields_04_section2"] = common

# ---- 02 §3 文档登记 8 类必备信息 ----
REG = json.load(open("artifacts/source-index/DOCUMENT_REGISTER.json", encoding="utf-8"))
reg_keys = sorted(REG["documents"][0].keys())
docs_keys = None
for o in stream_array(os.path.join(KD, "documents.json")):
    docs_keys = sorted(o.keys()); break
required_groups = {
  "原始路径/文件名/哈希": ["relative_path", "file_name", "sha256"],
  "标题/业务模块/业务对象": ["title", "module", "business_object"],
  "版本/发布日期/文档状态": ["doc_version", "doc_date", "doc_status"],
  "解析器版本": ["parser", "created_by_parser_version"],
  "扫描时间": ["scanned_at"],
  "文档间替代/引用/关联关系": ["supersedes", "replaces", "relations", "references", "replaced_by"],
}
reg_check = {}
for label, keys in required_groups.items():
    reg_check[label] = {"keys": keys, "in_register": [k for k in keys if k in reg_keys],
                        "in_documents_json": [k for k in keys if k in (docs_keys or [])]}
R["register_required_info_02_section3"] = {"register_keys": reg_keys,
                                           "documents_json_keys": docs_keys, "groups": reg_check}
print("REGISTER_KEYS", reg_keys)
print("DOCUMENTS_JSON_KEYS", docs_keys)
for k, v in reg_check.items(): print("  REG-REQUIRED", k, "register=", v["in_register"], "documents.json=", v["in_documents_json"])

# 版本 UNKNOWN 标记
ver_null = 0; ver_unknown = 0; ver_vals = collections.Counter()
status_vals = collections.Counter()
for o in stream_array(os.path.join(KD, "documents.json")):
    v = o.get("doc_version")
    if v is None: ver_null += 1
    elif str(v).upper() == "UNKNOWN": ver_unknown += 1
    else: ver_vals[str(v)] += 1
    status_vals[str(o.get("doc_status"))] += 1
R["version_unknown_marking"] = {"doc_version_null": ver_null, "doc_version_UNKNOWN_string": ver_unknown,
                                "doc_version_distinct_values": len(ver_vals),
                                "doc_status_values": dict(status_vals)}
print("VERSION_UNKNOWN_MARKING", R["version_unknown_marking"])

# ---- 04 §7 schema_version ----
schema_in_objects = 0; total = 0
for name in ARR:
    for o in stream_array(os.path.join(KD, name + ".json")):
        total += 1
        if "schema_version" in o: schema_in_objects += 1
summary = json.load(open(os.path.join(KD, "summary.json"), encoding="utf-8"))
report_hits = {}
for f in sorted(os.listdir("reports")):
    if not f.endswith(".md"): continue
    t = open(os.path.join("reports", f), encoding="utf-8").read()
    report_hits[f] = bool(re.search(r"schema_version|schema 版本|Schema 版本|1\.0\.0", t, re.I))
R["schema_version_04_section7"] = {
    "objects_with_schema_version": schema_in_objects, "objects_total": total,
    "summary_has_schema_version": "schema_version" in summary, "summary_value": summary.get("schema_version"),
    "reports_mentioning_version": report_hits,
}
print("SCHEMA_VERSION", R["schema_version_04_section7"])

# ---- 02 §4 12 类统一知识对象 ----
planned = ["Document","Entity","Page","Field","Control","Rule","Action","Workflow","Dependency",
           "Scenario","Evidence","OpenQuestion"]
present = collections.Counter()
for name in ARR:
    for o in stream_array(os.path.join(KD, name + ".json")):
        if isinstance(o, dict) and o.get("object_type"): present[o["object_type"]] += 1
R["unified_objects_02_section4"] = {
    "planned_12": planned, "present": dict(present),
    "missing": [t for t in planned if t not in present],
    "present_count": len(present),
    "note_existing_cases_has_no_object_type": "object_type" not in (common["existing-cases"]["missing_fields"]),
}
print("UNIFIED_12", R["unified_objects_02_section4"])

json.dump(R, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", OUT)
