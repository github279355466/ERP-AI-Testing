# -*- coding: utf-8 -*-
"""Phase 1 acceptance: read-only statistics over artifacts/knowledge/*.json.
Does NOT modify any artifact. Writes a compact digest to probe/acc_overview.out.txt
and a full stratified rule sample to probe/acc_rule_sample.json.
"""
import json, os, collections, random, io, sys

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
SI = os.path.join(ROOT, "artifacts", "source-index")
OUT = os.path.join(ROOT, "probe")

def load(name):
    with open(os.path.join(K, name), "r", encoding="utf-8") as f:
        return json.load(f)

def loadsi(name):
    with open(os.path.join(SI, name), "r", encoding="utf-8") as f:
        return json.load(f)

docs = load("documents.json")
rules = load("rules.json")
entities = load("entities.json")
deps = load("dependencies.json")
wfs = load("workflows.json")
oqs = load("open-questions.json")
reg = loadsi("DOCUMENT_REGISTER.json")

L = []
def p(*a):
    L.append(" ".join(str(x) for x in a))

p("=== COUNTS ===")
p("documents", len(docs), "rules", len(rules), "entities", len(entities),
  "deps", len(deps), "workflows", len(wfs), "open_questions", len(oqs))
p("register documents", len(reg.get("documents", [])))

doc_by_id = {d["id"]: d for d in docs}
latest_ids = set(d["id"] for d in docs if d.get("is_latest"))
p("is_latest docs", len(latest_ids))

p("")
p("=== RULE source_type DISTRIBUTION (ALL) ===")
c = collections.Counter(r.get("source_type") for r in rules)
for k, v in c.most_common():
    p("  ", k, v, f"{v/len(rules)*100:.2f}%")
p("=== RULE source_type DISTRIBUTION (LATEST docs only) ===")
cl = collections.Counter(r.get("source_type") for r in rules if r.get("document_id") in latest_ids)
tot_latest = sum(cl.values())
p("  latest rule total", tot_latest)
for k, v in cl.most_common():
    p("  ", k, v, f"{v/tot_latest*100:.2f}%")

p("")
p("=== RULE confidence / rule_type (ALL) ===")
for k, v in collections.Counter(r.get("confidence") for r in rules).most_common():
    p("  confidence", k, v)
for k, v in collections.Counter(r.get("rule_type") for r in rules).most_common():
    p("  rule_type", k, v)

p("")
p("=== RULE EVIDENCE 4-ELEMENT CHECK ===")
# element A file_path, B version(any version field in ref OR doc_version resolvable),
# C section, D excerpt(original snippet). Also line_start.
keys_union = collections.Counter()
for r in rules:
    for ref in (r.get("source_refs") or []):
        for k in ref.keys():
            keys_union[k] += 1
p("  source_ref key union:", dict(keys_union))

missing = collections.Counter()
excerpt_eq_desc = 0
excerpt_present = 0
for r in rules:
    refs = r.get("source_refs") or []
    if not refs:
        missing["NO_REF"] += 1
        continue
    ref = refs[0]
    if not (ref.get("file_path") or "").strip():
        missing["file_path"] += 1
    if not (ref.get("section") or "").strip():
        missing["section"] += 1
    if ref.get("line_start") in (None, ""):
        missing["line_start"] += 1
    if not (ref.get("excerpt") or "").strip():
        missing["excerpt"] += 1
    # version: explicit field in ref?
    if not any("version" in k.lower() for k in ref.keys()):
        missing["version_in_ref"] += 1
    # doc-level version resolvable?
    d = doc_by_id.get(r.get("document_id"))
    if not (d and (d.get("doc_version") or "").strip()):
        missing["doc_version_resolvable"] += 1
    ex = (ref.get("excerpt") or "").strip()
    if ex:
        excerpt_present += 1
        if ex == (r.get("description") or "").strip():
            excerpt_eq_desc += 1
p("  total rules", len(rules))
for k, v in missing.most_common():
    p("  missing", k, v, f"{v/len(rules)*100:.2f}%")
p("  excerpt present", excerpt_present, "excerpt == description (synthesized, not verbatim PRD quote)",
  excerpt_eq_desc, f"{excerpt_eq_desc/max(excerpt_present,1)*100:.2f}% of present")

p("")
p("=== DERIVED / EXPLICIT CONSISTENCY ===")
deriv_rules = [r for r in rules if r.get("source_type") == "PRD_DERIVED"]
expl_rules = [r for r in rules if r.get("source_type") == "PRD_EXPLICIT"]
p("  PRD_DERIVED", len(deriv_rules), "with derivation text",
  sum(1 for r in deriv_rules if (r.get("derivation") or "").strip()))
p("  PRD_EXPLICIT", len(expl_rules), "WITH derivation text (should be 0 if clean)",
  sum(1 for r in expl_rules if (r.get("derivation") or "").strip()))
p("  PRD_DERIVED with confidence != DERIVED",
  sum(1 for r in deriv_rules if r.get("confidence") != "DERIVED"))
p("  PRD_EXPLICIT with confidence != CONFIRMED",
  sum(1 for r in expl_rules if r.get("confidence") != "CONFIRMED"))
p("  derivation value samples:", list(dict.fromkeys(
    (r.get("derivation") or "") for r in deriv_rules))[:8])

p("")
p("=== DOCUMENTS parse-quality signals ===")
p("  by parser", dict(collections.Counter(d.get("parser") for d in docs)))
p("  by source_role", dict(collections.Counter(d.get("source_role") for d in docs)))
p("  by last_scan_status", dict(collections.Counter(d.get("last_scan_status") for d in docs)))
p("  section_count == 0", sum(1 for d in docs if d.get("section_count") == 0))
p("  table_count == 0", sum(1 for d in docs if d.get("table_count") == 0))
p("  section_count==0 AND table_count==0", sum(1 for d in docs if d.get("section_count") == 0 and d.get("table_count") == 0))
p("  size_bytes < 200", sum(1 for d in docs if d.get("size_bytes", 0) < 200))
p("  doc_version null/empty", sum(1 for d in docs if not (d.get("doc_version") or "").strip()))
p("  entity_names empty", sum(1 for d in docs if not d.get("entity_names")))
# docs with 0 fields
field_doc_counts = collections.Counter()
for r in rules:
    field_doc_counts[r.get("document_id")] += 1
p("  PRD docs with 0 rules", sum(1 for d in docs if d.get("source_role") == "PRD" and field_doc_counts.get(d["id"], 0) == 0))

p("")
p("  --- PRD docs: section_count==0 OR table_count==0 (first 40) ---")
susp = [d for d in docs if d.get("source_role") == "PRD" and (d.get("section_count") == 0 or d.get("table_count") == 0)]
for d in susp[:40]:
    p("   ", d["id"], "|", d.get("relative_path"), "| parser", d.get("parser"),
      "| size", d.get("size_bytes"), "| sec", d.get("section_count"), "| tbl", d.get("table_count"),
      "| rules", field_doc_counts.get(d["id"], 0), "| latest", d.get("is_latest"))
p("  total suspicious PRD docs", len(susp))

p("")
p("=== .parse-cache vs register ===")
cache_dir = os.path.join(SI, ".parse-cache")
cache_files = [f for f in os.listdir(cache_dir) if f.endswith(".json")]
p("  cache files", len(cache_files), "register docs", len(reg.get("documents", [])))
reg_ids = set(x["document_id"] for x in reg.get("documents", []))
cache_ids = set(f[:-5] for f in cache_files)
p("  cache ids not in register", len(cache_ids - reg_ids))
p("  register ids not in cache", len(reg_ids - cache_ids))

p("")
p("=== PURCHASE CHAIN: documents by job_directory ===")
PURCH = ["供应商资料", "供应商业务信息", "供应商品号价格", "客户供应商关系", "品号资料",
         "品号通用信息", "品号采购信息", "品号属性", "品号群组", "请购单", "采购订单",
         "采购到货单", "采购入库单", "采购退货单", "采购退货出库单", "询价单",
         "采购取价策略", "到货单验收", "运营单元采购参数"]
for job in PURCH:
    dl = [d for d in docs if d.get("job_directory") == job and d.get("source_role") == "PRD"]
    latest = [d for d in dl if d.get("is_latest")]
    rc = sum(field_doc_counts.get(d["id"], 0) for d in dl)
    p("  ", job, "| PRD docs", len(dl), "| latest", len(latest), "| rules", rc,
      "| paths", "; ".join(d.get("relative_path", "") for d in dl[:3]))

p("")
p("=== ENTITIES (purchase-ish) ===")
for e in entities:
    nm = (e.get("name") or "") + " " + (e.get("label") or "") + " " + (e.get("entity_no") or "")
    if any(k in nm for k in ["采购", "请购", "询价", "退货", "到货", "入库", "供应商", "品号", "supp", "pur_", "item"]):
        p("  ", e["id"], "|", e.get("name"), "| entity_no", e.get("entity_no"),
          "| module", e.get("module"), "| field_count", e.get("field_count"),
          "| rule_count", e.get("rule_count"), "| docs", len(e.get("document_ids", [])))

p("")
p("=== DEPENDENCIES ===")
p("  relation_type", dict(collections.Counter(d.get("relation_type") for d in deps)))
p("  source_type", dict(collections.Counter(d.get("source_type") for d in deps)))
p("  confidence", dict(collections.Counter(d.get("confidence") for d in deps)))
p("  target_id non-null", sum(1 for d in deps if d.get("target_id")))
p("  mapping non-null", sum(1 for d in deps if (d.get("mapping") or "").strip()))
p("  total", len(deps))
p("  --- purchase-related deps (first 60) ---")
pdeps = [d for d in deps if "采购" in (d.get("name") or "") or "采购" in (d.get("module") or "")]
for d in pdeps[:60]:
    r0 = (d.get("source_refs") or [{}])[0]
    p("   ", d["id"], "|", d.get("name"), "| rel", d.get("relation_type"),
      "| src", d.get("source_type"), "| conf", d.get("confidence"),
      "| target_ref", d.get("target_ref"), "| section", r0.get("section"),
      "| file", r0.get("file_path"))
p("  purchase-related deps count", len(pdeps))

p("")
p("=== WORKFLOWS (purchase-ish) ===")
for w in wfs:
    if "采购" in (w.get("name") or "") or "采购" in (w.get("module") or ""):
        p("  ", w["id"], "|", w.get("name"), "| steps", len(w.get("steps", [])),
          "| file", (w.get("source_refs") or [{}])[0].get("file_path"))
p("  total workflows", len(wfs))

p("")
p("=== OPEN QUESTIONS ===")
p("  category", dict(collections.Counter(q.get("category") for q in oqs)))
p("  severity", dict(collections.Counter(q.get("severity") for q in oqs)))
p("  status", dict(collections.Counter(q.get("status") for q in oqs)))
p("  --- questions mentioning purchase chain docs ---")
for q in oqs:
    txt = (q.get("question") or "") + " " + " ".join(q.get("evidence") or [])
    if any(k in txt for k in ["请购单", "采购订单", "采购到货单", "采购入库单", "采购退货单", "供应商资料", "品号资料"]):
        p("   ", q["id"], "|", q.get("category"), "|", q.get("severity"), "|", q.get("question")[:120])

p("")
p("=== COVERAGE cross-check ===")
summary = load("summary.json")
p("  summary.counts", summary["counts"])
p("  summary.coverage", summary["coverage"])
p("  summary.validation", summary["validation"])

with open(os.path.join(OUT, "acc_overview.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")

# ---------- stratified rule sample ----------
random.seed(20261107)
def pick(pool, n):
    return random.sample(pool, min(n, len(pool)))

buckets = {}
# purchase latest explicit
buckets["purchase_latest_EXPLICIT"] = [r for r in rules if r.get("module") == "采购" and r.get("document_id") in latest_ids and r.get("source_type") == "PRD_EXPLICIT"]
# purchase latest derived
buckets["purchase_latest_DERIVED"] = [r for r in rules if r.get("module") == "采购" and r.get("document_id") in latest_ids and r.get("source_type") == "PRD_DERIVED"]
# purchase non-latest explicit
buckets["purchase_nonlatest_EXPLICIT"] = [r for r in rules if r.get("module") == "采购" and r.get("document_id") not in latest_ids and r.get("source_type") == "PRD_EXPLICIT"]
# other modules latest explicit
buckets["other_latest_EXPLICIT"] = [r for r in rules if r.get("module") != "采购" and r.get("document_id") in latest_ids and r.get("source_type") == "PRD_EXPLICIT"]
# other modules derived
buckets["other_DERIVED"] = [r for r in rules if r.get("module") != "采购" and r.get("source_type") == "PRD_DERIVED"]
# PENDING
buckets["PENDING"] = [r for r in rules if r.get("source_type") == "PENDING"]
# EXPLICIT with derivation (mix)
buckets["EXPLICIT_with_derivation"] = [r for r in rules if r.get("source_type") == "PRD_EXPLICIT" and (r.get("derivation") or "").strip()]

sample = []
plan = [("purchase_latest_EXPLICIT", 16), ("purchase_latest_DERIVED", 6),
        ("purchase_nonlatest_EXPLICIT", 4), ("other_latest_EXPLICIT", 8),
        ("other_DERIVED", 4), ("PENDING", 2), ("EXPLICIT_with_derivation", 4)]
for key, n in plan:
    for r in pick(buckets.get(key, []), n):
        d = doc_by_id.get(r.get("document_id"), {})
        ref = (r.get("source_refs") or [{}])[0]
        sample.append({
            "bucket": key,
            "rule_id": r["id"],
            "name": r.get("name"),
            "module": r.get("module"),
            "source_type": r.get("source_type"),
            "confidence": r.get("confidence"),
            "rule_type": r.get("rule_type"),
            "description": r.get("description"),
            "derivation": r.get("derivation"),
            "field_no": r.get("field_no"),
            "field_name": r.get("field_name"),
            "expected_result": r.get("expected_result"),
            "trigger": r.get("trigger"),
            "conditions": r.get("conditions"),
            "ref": ref,
            "doc_relative_path": d.get("relative_path"),
            "doc_file_path": d.get("file_path"),
            "doc_version": d.get("doc_version"),
            "doc_is_latest": d.get("is_latest"),
            "doc_title": d.get("title"),
            "doc_job_directory": d.get("job_directory"),
        })
with open(os.path.join(OUT, "acc_rule_sample.json"), "w", encoding="utf-8") as f:
    json.dump(sample, f, ensure_ascii=False, indent=2)
p("")
p("=== BUCKET SIZES (for sampling) ===")
for k, v in buckets.items():
    p("  ", k, len(v))
p("  sample written", len(sample))

with open(os.path.join(OUT, "acc_overview.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("\n".join(L))
