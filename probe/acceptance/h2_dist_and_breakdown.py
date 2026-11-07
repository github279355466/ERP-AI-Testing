#!/usr/bin/env python3
# 收口补证：dist 内容是否与验收前一致；source-index 细分；范围明细
import os, sys, json, hashlib, collections, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "h2_dist_and_breakdown.json")

def files(root):
    out = {}
    for dp, dns, fns in os.walk(root):
        for fn in fns:
            p = os.path.join(dp, fn)
            out[os.path.relpath(p, root).replace("\\", "/")] = p
    return out

def content_equal(p1, p2):
    with open(p1, "rb") as a, open(p2, "rb") as b:
        return a.read() == b.read()

# ---- dist: 与验收前隔离编译产物逐字节比对 ----
A = files("dist")
B = files("probe/acceptance/isolated/dist")
js_a = sorted(k for k in A if k.endswith(".js"))
js_b = sorted(k for k in B if k.endswith(".js"))
same, diff, only_a, only_b = [], [], [], []
for k in js_a:
    if k not in B: only_a.append(k)
    elif content_equal(A[k], B[k]): same.append(k)
    else: diff.append(k)
for k in js_b:
    if k not in A: only_b.append(k)
dist_res = {"repo_dist_js": len(js_a), "isolated_dist_js": len(js_b),
            "byte_identical": len(same), "different": len(diff),
            "only_in_repo": len(only_a), "only_in_isolated": len(only_b),
            "diff_samples": diff[:5], "only_in_repo_samples": only_a[:5]}
print("DIST", json.dumps(dist_res, ensure_ascii=False))
maps_a = sorted(k for k in A if k.endswith(".js.map"))
maps_b = sorted(k for k in B if k.endswith(".js.map"))
map_same = sum(1 for k in maps_a if k in B and content_equal(A[k], B[k]))
print("DIST_MAPS", len(maps_a), len(maps_b), "identical", map_same)
dist_res["maps"] = {"repo": len(maps_a), "isolated": len(maps_b), "byte_identical": map_same}

# ---- source-index 细分 ----
m = json.load(open("artifacts/acceptance/_snapshots/manifest-before.json", encoding="utf-8"))
si = [e["rel"] for e in m["files"] if e["rel"].startswith("artifacts/source-index/")]
def cat(rel):
    if "/.parse-cache/" in rel: return ".parse-cache/"
    if rel.endswith(".scan-state.json"): return ".scan-state.json"
    return "top-level (DOCUMENT_REGISTER.json / scan-report.md)"
brk = collections.Counter(cat(r) for r in si)
print("SOURCE_INDEX_BREAKDOWN", dict(brk))
kd = [e["rel"] for e in m["files"] if e["rel"].startswith("artifacts/knowledge/")]
rp = [e["rel"] for e in m["files"] if e["rel"].startswith("reports/")]
print("KNOWLEDGE_FILES", len(kd), "REPORTS_FILES", len(rp))

# 当前各范围文件字节数合计
def total_bytes(rels):
    return sum(os.path.getsize(r) for r in rels if os.path.isfile(r))
now = {"artifacts/knowledge": total_bytes(kd), "artifacts/source-index": total_bytes(si),
       "reports": total_bytes(rp)}
print("NOW_TOTAL_BYTES", now, "SUM", sum(now.values()),
      "MANIFEST_DECLARED", m["total_bytes"])

# ---- qa-lead 自报交叉核对 ----
d = json.load(open(os.path.join(BASE, "h1_final_hash_audit.json"), encoding="utf-8"))
diff_after = json.load(open("artifacts/acceptance/_snapshots/diff-after-prd.json", encoding="utf-8"))
qa = {"restore_325_files": d["baseline_integrity"]["snapshot_copies"] == 325,
      "verify_all_byte_identical": d["snapshot_total"]["different"] == 0 and
                                    all(v["byte_identical_to_snapshot_copy"] == v["total"]
                                        for v in d["ranges"].values()),
      "git_tracked_modifications_0": d["git"]["tracked_mods"] == [] and
                                      d["git"]["diff_name_only_HEAD"] == [],
      "diff_after_prd_unchanged_325": diff_after.get("unchanged") == 325 and
                                       diff_after.get("changed") == [] and
                                       diff_after.get("added") == [] and
                                       diff_after.get("missing") == []}
print("QA_SELF_REPORT_CROSSCHECK", json.dumps(qa, ensure_ascii=False))
print("QA_DIFF_AFTER_PRD", json.dumps(diff_after, ensure_ascii=False))

result = {"dist": dist_res, "source_index_breakdown": dict(brk),
          "knowledge_files": len(kd), "reports_files": len(rp),
          "now_total_bytes": now, "now_total_sum": sum(now.values()),
          "manifest_declared_total_bytes": m["total_bytes"],
          "qa_self_report_crosscheck": qa, "diff_after_prd": diff_after,
          "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", OUT)
