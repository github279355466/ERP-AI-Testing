#!/usr/bin/env python3
# 收口取证：验收前后「被验收交付物」哈希一致性独立只读复核
# 前基线：artifacts/acceptance/_snapshots/before/manifest-before.json（qa-lead 留）
# 追踪文件基线：git HEAD（唯一提交 7c13b445，2026-11-07 16:53:46 +0800，早于验收开始 17:05）
import os, sys, json, hashlib, subprocess, re, collections, datetime

ROOT = os.getcwd()
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "h1_final_hash_audit.json")
MANIFEST = "artifacts/acceptance/_snapshots/manifest-before.json"
SNAPDIR = "artifacts/acceptance/_snapshots/before"

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def files_under(dirpath):
    """递归列出目录内全部文件（含隐藏目录与隐藏文件），返回相对仓库根的 POSIX 路径"""
    out = []
    for dp, dns, fns in os.walk(dirpath):
        for fn in fns:
            p = os.path.join(dp, fn)
            out.append(os.path.relpath(p, ROOT).replace("\\", "/"))
    return sorted(out)

def git_show(rel):
    r = subprocess.run(["git", "show", "HEAD:" + rel], capture_output=True)
    return r.stdout if r.returncode == 0 else None

def git_tracked(rel):
    r = subprocess.run(["git", "ls-files", "--error-unmatch", rel], capture_output=True)
    return r.returncode == 0

# ---------- 1) 前基线 ----------
m = json.load(open(MANIFEST, encoding="utf-8"))
before = {e["rel"]: {"size": e["size"], "sha256": e["sha256"]} for e in m["files"]}
print("MANIFEST captured_at", m["captured_at"], "targets", m["targets"],
      "file_count", m["file_count"], "total_bytes", m["total_bytes"],
      "entries", len(before))
# 基线自身完整性：快照副本数量、逐文件字节与 manifest 记录是否吻合
snap_files = sorted(os.path.relpath(os.path.join(dp, fn), SNAPDIR).replace("\\", "/")
                    for dp, dns, fns in os.walk(SNAPDIR) for fn in fns)
snap_bad = []
for rel in snap_files:
    p = os.path.join(SNAPDIR, rel)
    b = before.get(rel)
    if b is None:
        snap_bad.append({"rel": rel, "reason": "NOT_IN_MANIFEST"}); continue
    data = open(p, "rb").read()
    if len(data) != b["size"] or hashlib.sha256(data).hexdigest() != b["sha256"]:
        snap_bad.append({"rel": rel, "reason": "SNAP_VS_MANIFEST_MISMATCH"})
print("SNAPSHOT_COPIES", len(snap_files), "BASELINE_INTEGRITY_BAD", len(snap_bad), snap_bad[:5])

# ---------- 2) 三个快照范围的逐文件比对 ----------
scope_defs = [
    ("artifacts/knowledge", lambda p: p.startswith("artifacts/knowledge/") and p.endswith(".json")),
    ("artifacts/source-index (全部，含 .scan-state.json 与 .parse-cache/)",
     lambda p: p.startswith("artifacts/source-index/")),
    ("reports", lambda p: p.startswith("reports/") and p.endswith(".md")),
]
ranges = {}
all_changed = []
range_rows = {}
for label, pred in scope_defs:
    keys = sorted(k for k in before if pred(k))
    rows = []
    for rel in keys:
        cur_exists = os.path.isfile(rel)
        cur_size = os.path.getsize(rel) if cur_exists else None
        cur_sha = sha(rel) if cur_exists else None
        b = before[rel]
        ok = cur_exists and cur_size == b["size"] and cur_sha == b["sha256"]
        snap_path = os.path.join(SNAPDIR, rel)
        if cur_exists and os.path.isfile(snap_path):
            byte_identical = open(snap_path, "rb").read() == open(rel, "rb").read()
        else:
            byte_identical = False
        rows.append({"rel": rel, "before_size": b["size"], "now_size": cur_size,
                     "before_sha256": b["sha256"][:16], "now_sha256": (cur_sha or "")[:16],
                     "exists": cur_exists, "identical": ok,
                     "byte_identical_to_snapshot_copy": byte_identical})
        if not ok: all_changed.append(rel)
    cnt = collections.Counter(r["identical"] for r in rows)
    byt = sum(1 for r in rows if r["byte_identical_to_snapshot_copy"])
    range_rows[label] = {"total": len(rows), "identical": cnt[True], "different": cnt[False],
                         "byte_identical_to_snapshot_copy": byt, "rows": rows}
    print("RANGE", label, "total", len(rows), "identical", cnt[True], "different", cnt[False],
          "byte_identical", byt)

# 当前文件枚举 -> added / missing
current_snapshot = set()
for d in ["artifacts/knowledge", "artifacts/source-index", "reports"]:
    for p in files_under(d):
        if d == "reports" and not p.endswith(".md"): continue
        current_snapshot.add(p)
added = sorted(current_snapshot - set(before))
missing = sorted(set(before) - current_snapshot)
print("SNAPSHOT_ADDED", len(added), added[:10])
print("SNAPSHOT_MISSING", len(missing), missing[:10])

# ---------- 3) 差异归因：内容等价但字节不同？ ----------
VOLATILE_JSON_KEYS = {"generated_at", "updated_at", "scanned_at", "created_at", "extracted_at",
                      "mode", "last_scan_status"}
def normalize_json(obj):
    if isinstance(obj, dict):
        return {k: normalize_json(v) for k, v in sorted(obj.items()) if k not in VOLATILE_JSON_KEYS}
    if isinstance(obj, list):
        return [normalize_json(x) for x in obj]
    return obj

def normalized_bytes(rel):
    raw = open(rel, "rb").read()
    if rel.endswith(".json"):
        try:
            return json.dumps(normalize_json(json.loads(raw.decode("utf-8"))),
                              ensure_ascii=False, sort_keys=True).encode("utf-8")
        except Exception:
            return raw
    if rel.endswith(".md"):
        s = raw.decode("utf-8", errors="replace")
        s = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", "<TS>", s)
        return s.encode("utf-8")
    return raw

attribution = []
for rel in all_changed[:50]:
    if not os.path.isfile(rel): continue
    b = before[rel]
    # 用快照副本做归一化对比（快照目录 _snapshots/before/ 下存放原始字节）
    snap = os.path.join(SNAPDIR, rel)
    a = {"rel": rel, "before_size": b["size"], "now_size": os.path.getsize(rel),
         "sha_changed": True}
    if os.path.isfile(snap):
        a["snapshot_copy_exists"] = True
        a["normalized_equivalent"] = normalized_bytes(snap) == normalized_bytes(rel)
        a["before_sha256"] = hashlib.sha256(open(snap,"rb").read()).hexdigest()
        a["snapshot_matches_manifest"] = a["before_sha256"] == b["sha256"]
    else:
        a["snapshot_copy_exists"] = False
        a["normalized_equivalent"] = None
    attribution.append(a)
print("CHANGED_TOTAL", len(all_changed))
print("ATTRIBUTION_SAMPLE", json.dumps(attribution[:6], ensure_ascii=False))

# ---------- 4) 快照范围外的追踪文件：与 git HEAD 比对 ----------
extra_paths = []
for d in ["knowledge", "config", "src"]:
    for p in files_under(d):
        if d == "knowledge" and not p.endswith(".json"): continue
        if d == "config" and not p.endswith(".json"): continue
        if d == "src" and not p.endswith(".ts"): continue
        extra_paths.append(p)
extra_paths += ["package.json", "tsconfig.json", "AGENTS.md"]
extra_paths = sorted(set(extra_paths))

extra_rows = []
for rel in extra_paths:
    tracked = git_tracked(rel)
    head = git_show(rel) if tracked else None
    cur = open(rel, "rb").read() if os.path.isfile(rel) else None
    ok = bool(tracked and head is not None and cur == head)
    extra_rows.append({"rel": rel, "tracked": tracked, "exists": cur is not None,
                       "head_bytes": len(head) if head is not None else None,
                       "now_bytes": len(cur) if cur is not None else None,
                       "sha256_head": hashlib.sha256(head).hexdigest() if head is not None else None,
                       "sha256_now": hashlib.sha256(cur).hexdigest() if cur is not None else None,
                       "head_equals_now": ok})
extra_by_dir = collections.defaultdict(lambda: [0, 0])
for r in extra_rows:
    key = r["rel"].split("/")[0] if "/" in r["rel"] else r["rel"]
    extra_by_dir[key][0] += 1
    extra_by_dir[key][1] += 1 if r["head_equals_now"] else 0
print("EXTRA_TRACKED_TOTAL", len(extra_rows), "matching_HEAD", sum(1 for r in extra_rows if r["head_equals_now"]))
for k, (t, ok) in sorted(extra_by_dir.items()): print("  ", k, t, ok)
print("EXTRA_MISMATCH", [r["rel"] for r in extra_rows if not r["head_equals_now"]][:20])

# git 视角
porcelain = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout.splitlines()
tracked_mods = [l for l in porcelain if not l.startswith("??")]
untracked = [l for l in porcelain if l.startswith("??")]
diff_names = subprocess.run(["git", "diff", "--name-only", "HEAD"], capture_output=True, text=True).stdout.splitlines()
print("GIT_PORCELAIN_TOTAL", len(porcelain), "TRACKED_MODS", len(tracked_mods), "UNTRACKED", len(untracked))
print("GIT_DIFF_NAME_ONLY_HEAD", len(diff_names), diff_names[:10])

# ---------- 5) 外部 PRD 源目录 540 文件哈希复算 ----------
inv = json.load(open(os.path.join(BASE, "a1_fs_inventory.json"), encoding="utf-8"))
prd_bad = []
for f in inv["files"]:
    p = f["absolute_path"]
    if not os.path.isfile(p):
        prd_bad.append({"rel": f["relative_path"], "reason": "MISSING"}); continue
    if sha(p) != f["sha256"]:
        prd_bad.append({"rel": f["relative_path"], "reason": "SHA_MISMATCH"})
print("EXTERNAL_PRD_FILES", len(inv["files"]), "MISMATCH", len(prd_bad), prd_bad[:5])

# ---------- 6) dist/ 观察（npm run build 被执行过） ----------
dist_ts = []
for p in files_under("dist")[:5]:
    dist_ts.append({"rel": p, "mtime": datetime.datetime.fromtimestamp(
        os.path.getmtime(p), datetime.timezone.utc).isoformat()})
print("DIST_SAMPLE_MTIME", json.dumps(dist_ts[:3]))

# ---------- 汇总 ----------
summary = {
  "manifest": {"captured_at": m["captured_at"], "targets": m["targets"],
               "declared_file_count": m["file_count"], "declared_total_bytes": m["total_bytes"],
               "parsed_entries": len(before)},
  "baseline_integrity": {"snapshot_copies": len(snap_files), "bad": snap_bad},
  "ranges": {k: {"total": v["total"], "identical": v["identical"], "different": v["different"],
                 "byte_identical_to_snapshot_copy": v["byte_identical_to_snapshot_copy"]}
             for k, v in range_rows.items()},
  "snapshot_total": {"total": sum(v["total"] for v in range_rows.values()),
                     "identical": sum(v["identical"] for v in range_rows.values()),
                     "different": sum(v["different"] for v in range_rows.values())},
  "added": added, "missing": missing,
  "changed_list": all_changed, "attribution": attribution,
  "extra_tracked": {"total": len(extra_rows),
                    "matching_HEAD": sum(1 for r in extra_rows if r["head_equals_now"]),
                    "by_dir": {k: {"total": v[0], "matching": v[1]} for k, v in sorted(extra_by_dir.items())},
                    "mismatches": [r["rel"] for r in extra_rows if not r["head_equals_now"]],
                    "rows": extra_rows},
  "git": {"porcelain_total": len(porcelain), "tracked_mods": tracked_mods,
          "untracked_count": len(untracked), "diff_name_only_HEAD": diff_names},
  "external_prd": {"total": len(inv["files"]), "mismatch": len(prd_bad), "samples": prd_bad[:10]},
  "dist_sample_mtime": dist_ts,
  "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
json.dump(summary, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OUTPUT", OUT)
