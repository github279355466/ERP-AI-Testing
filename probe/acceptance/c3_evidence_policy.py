#!/usr/bin/env python3
# C 项取证 3：证据完整性（开发包 04 契约 §5）/ 开放问题分类 / 配置策略落地 / 断链目标
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

KD = "artifacts/knowledge"
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "c3_evidence_policy.json")
R = {}

# ---- 1) 全部知识对象的 source_refs 证据定位情况 ----
ARR = ["documents","entities","pages","fields","controls","rules","actions","workflows","dependencies","scenarios"]
ev = {}
for name in ARR:
    total = 0; no_refs = 0; refs_total = 0
    no_doc = 0; no_path = 0; no_line = 0; no_section = 0; no_excerpt = 0
    samples = collections.defaultdict(list)
    for o in stream_array(os.path.join(KD, name + ".json")):
        total += 1
        sr = o.get("source_refs") or []
        if not sr: no_refs += 1
        refs_total += len(sr)
    # 精确统计引用字段缺失情况
    no_doc=no_path=no_line=no_section=no_excerpt=0
    for o in stream_array(os.path.join(KD, name + ".json")):
        for ref in (o.get("source_refs") or []):
            if not ref.get("document_id"): no_doc += 1
            if not ref.get("file_path"): no_path += 1
            if ref.get("line_start") in (None, 0, ""): no_line += 1
            if not ref.get("section"): no_section += 1
            if not ref.get("excerpt"): no_excerpt += 1
            if no_line <= 3 and ref.get("line_start") in (None, 0, ""):
                samples["no_line"].append({"id": o.get("id"), "ref": {k: ref.get(k) for k in ("document_id","file_path","section")}})
    ev[name] = {"objects": total, "objects_without_refs": no_refs, "refs": refs_total,
                "no_document_id": no_doc, "no_file_path": no_path, "no_line_start": no_line,
                "no_section": no_section, "no_excerpt": no_excerpt,
                "samples": {k: v[:3] for k, v in samples.items()}}
    print("EVIDENCE", name, ev[name]["objects"], "refs=", refs_total, "no_line=", no_line, "no_path=", no_path, "no_doc=", no_doc)

# ---- 2) PRD_EXPLICIT 规则的证据完整性 ----
explicit = 0; explicit_no_evidence = 0; explicit_no_line = 0
src_type_dist = collections.Counter(); conf_dist = collections.Counter(); rule_type_dist = collections.Counter()
for r in stream_array(os.path.join(KD, "rules.json")):
    src_type_dist[r.get("source_type")] += 1
    conf_dist[r.get("confidence")] += 1
    rule_type_dist[r.get("rule_type")] += 1
    if r.get("source_type") == "PRD_EXPLICIT":
        explicit += 1
        sr = r.get("source_refs") or []
        if not any(x.get("document_id") and x.get("file_path") for x in sr): explicit_no_evidence += 1
        if not any(x.get("line_start") for x in sr): explicit_no_line += 1
R["explicit_rules"] = {"total": explicit, "no_evidence": explicit_no_evidence, "no_line_start": explicit_no_line}
R["rule_source_type_dist"] = dict(src_type_dist)
R["rule_confidence_dist"] = dict(conf_dist)
R["rule_type_dist"] = dict(rule_type_dist)
print("EXPLICIT_RULES", R["explicit_rules"])
print("SOURCE_TYPE_DIST", dict(src_type_dist))

# ---- 3) EVIDENCE_MISSING 标记是否存在 ----
hits = {}
for f in ["open-questions.json", "rules.json"]:
    n = 0
    for o in stream_array(os.path.join(KD, f)):
        if "EVIDENCE_MISSING" in json.dumps(o, ensure_ascii=False): n += 1
    hits[f] = n
R["EVIDENCE_MISSING_marker_count"] = hits
print("EVIDENCE_MISSING_MARKER", hits)

# ---- 4) 开放问题分类 / 严重度 ----
q_cat = collections.Counter(); q_sev = collections.Counter(); q_status = collections.Counter()
oq_prefix = collections.Counter()
for q in stream_array(os.path.join(KD, "open-questions.json")):
    q_cat[q.get("category")] += 1
    q_sev[q.get("severity")] += 1
    q_status[q.get("status")] += 1
    oq_prefix["OQ-" if str(q.get("id","")).startswith("OQ-") else "other"] += 1
R["open_questions"] = {"category": dict(q_cat), "severity": dict(q_sev), "status": dict(q_status), "id_prefix": dict(oq_prefix)}
print("OQ_CATEGORY", dict(q_cat))
print("OQ_SEVERITY", dict(q_sev))

# ---- 5) 依赖关系 target_id / target_ref 断链 ----
entity_no = set(); field_no = set(); entity_id = set(); field_id = set()
for e in stream_array(os.path.join(KD, "entities.json")):
    entity_id.add(e["id"])
    if e.get("entity_no"): entity_no.add(e["entity_no"])
for f in stream_array(os.path.join(KD, "fields.json")):
    field_id.add(f["id"])
    if f.get("field_no"): field_no.add(f["field_no"])
dep_target_null = 0; dep_target_ref_resolved = 0; dep_target_ref_unresolved = 0
dep_bad_samples = []
for d in stream_array(os.path.join(KD, "dependencies.json")):
    if d.get("target_id") is None: dep_target_null += 1
    tr = d.get("target_ref")
    if tr in entity_no or tr in field_no or tr in entity_id or tr in field_id:
        dep_target_ref_resolved += 1
    else:
        dep_target_ref_unresolved += 1
        if len(dep_bad_samples) < 8: dep_bad_samples.append({"id": d["id"], "target_ref": tr, "relation_type": d.get("relation_type")})
R["dependencies"] = {"total": 722, "target_id_null": dep_target_null,
                     "target_ref_resolved": dep_target_ref_resolved, "target_ref_unresolved": dep_target_ref_unresolved,
                     "samples": dep_bad_samples}
print("DEPENDENCIES", R["dependencies"])

# ---- 6) rules.open_question_ids / scenarios.review_required / status ----
r_oq = 0; s_review = 0; s_status = collections.Counter(); s_feas = collections.Counter(); s_origin = collections.Counter()
for r in stream_array(os.path.join(KD, "rules.json")):
    if r.get("open_question_ids"): r_oq += 1
for s in stream_array(os.path.join(KD, "scenarios.json")):
    if s.get("review_required") is True: s_review += 1
    s_status[s.get("status")] += 1
    s_feas[s.get("automation_feasibility")] += 1
    s_origin[s.get("origin")] += 1
R["linkage"] = {"rules_with_open_question_ids": r_oq, "scenarios_review_required_true": s_review,
                "scenario_status": dict(s_status), "scenario_feasibility": dict(s_feas), "scenario_origin": dict(s_origin)}
print("LINKAGE", R["linkage"])

R["evidence"] = ev
R["evidence_source_refs_total"] = sum(v["refs"] for v in ev.values())
json.dump(R, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("SOURCE_REFS_TOTAL", R["evidence_source_refs_total"])
print("OUTPUT", OUT)
