#!/usr/bin/env python3
# 主理人补充线索：Phase 1 是否把 _diff 差异文档的版本号纳入「候选最新版本」
import os, sys, json, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

KD = "artifacts/knowledge"
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "a7_diff_version.json")

docs = list(stream_array(os.path.join(KD, "documents.json")))
fields_by_doc = collections.Counter()
for f in stream_array(os.path.join(KD, "fields.json")):
    fields_by_doc[f["document_id"]] += 1
rules_by_doc = collections.Counter()
for r in stream_array(os.path.join(KD, "rules.json")):
    rules_by_doc[r["document_id"]] += 1

def aux(rel):
    return [p for p in rel.split("/")[:-1] if p.startswith("_")]
def job(rel):
    parts = rel.split("/")[:-1]
    m = [p for p in parts if not p.startswith("_") and not p.endswith("域")]
    return m[-1] if m else (parts[0] if parts else "(ROOT)")

R = {}
for target in ["采购退货出库单", "询价单", "会计期间信息", "会计期间表", "采购取价策略"]:
    grp = [d for d in docs if d["source_role"] == "PRD" and job(d["relative_path"]) == target]
    top = [d for d in grp if not aux(d["relative_path"])]
    diff = [d for d in grp if any(a.startswith("_diff") for a in aux(d["relative_path"]))]
    hist = [d for d in grp if any(a.startswith("_history") for a in aux(d["relative_path"]))]
    versions = sorted({d["doc_version"] for d in grp if d["doc_version"]}, key=lambda s: [int(x) for x in s.split(".")])
    diff_versions = sorted({d["doc_version"] for d in diff if d["doc_version"]}, key=lambda s: [int(x) for x in s.split(".")])
    top_versions = sorted({d["doc_version"] for d in top if d["doc_version"]}, key=lambda s: [int(x) for x in s.split(".")])
    # 候选版本号是否只由 _diff 提供
    max_v = versions[-1] if versions else None
    providers_max = [d["relative_path"] for d in grp if d["doc_version"] == max_v]
    latest = [d for d in grp if d.get("is_latest")]
    R[target] = {
        "group_size": len(grp), "top": len(top), "_diff": len(diff), "_history": len(hist),
        "all_versions": versions, "top_versions": top_versions, "_diff_versions": diff_versions,
        "max_version": max_v, "max_version_providers": providers_max,
        "max_version_only_from_aux": all(aux(p) for p in providers_max) if providers_max else None,
        "diff_docs_with_fields": sum(1 for d in diff if fields_by_doc[d["id"]] > 0),
        "diff_docs_with_rules": sum(1 for d in diff if rules_by_doc[d["id"]] > 0),
        "is_latest_docs": [{"path": d["relative_path"], "version": d["doc_version"]} for d in latest],
        "is_latest_in_aux": [d["relative_path"] for d in latest if aux(d["relative_path"])],
    }
    print("==", target)
    print("  group", len(grp), "top", len(top), "_diff", len(diff), "versions", versions)
    print("  _diff_versions", diff_versions, "max", max_v, "providers", providers_max[:4])
    print("  max_only_from_aux", R[target]["max_version_only_from_aux"],
          "diff_with_fields", R[target]["diff_docs_with_fields"],
          "is_latest", R[target]["is_latest_docs"])

# 全库 _diff 统计
all_diff = [d for d in docs if any(a.startswith("_diff") for a in aux(d["relative_path"])) and d["source_role"]=="PRD"]
R["all_diff_summary"] = {
    "diff_docs": len(all_diff),
    "diff_with_doc_version": sum(1 for d in all_diff if d["doc_version"]),
    "diff_with_fields": sum(1 for d in all_diff if fields_by_doc[d["id"]] > 0),
    "diff_with_rules": sum(1 for d in all_diff if rules_by_doc[d["id"]] > 0),
    "diff_is_latest": sum(1 for d in all_diff if d.get("is_latest")),
}
print("ALL_DIFF", R["all_diff_summary"])

# VERSION_CONFLICTS.md 明细里 _diff 条目版本
vc = open("reports/VERSION_CONFLICTS.md", encoding="utf-8").read()
detail = [l.strip() for l in vc.splitlines() if l.startswith("- ")]
diff_lines = [l for l in detail if "/_diff/" in l]
R["version_conflicts_detail"] = {
    "detail_lines": len(detail), "diff_lines": len(diff_lines),
    "diff_lines_with_version": sum(1 for l in diff_lines if re.search(r"\(v[\d.]+\)$", l)),
    "diff_lines_vUNKNOWN": sum(1 for l in diff_lines if "(vUNKNOWN)" in l),
    "samples": diff_lines[:8],
}
print("VERSION_CONFLICTS_DETAIL", R["version_conflicts_detail"])
json.dump(R, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", OUT)
