# -*- coding: utf-8 -*-
"""Read-only final checks: dependency trace verification, OQ coverage, framework map gap."""
import os, json, re, collections

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
TC  = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
OUT = os.path.join(ROOT, "probe")
def load(n): return json.load(open(os.path.join(K, n), "r", encoding="utf-8"))
deps = load("dependencies.json"); oqs = load("open-questions.json"); docs = load("documents.json")
rules = load("rules.json")
L = []
def p(*a): L.append(" ".join(str(x) for x in a))

doc_by_id = {d["id"]: d for d in docs}

def resolve(rel):
    for base in (PRD, TC):
        c = os.path.join(base, rel)
        if os.path.exists(c): return c
    return None

p("=== 15+ DEPENDENCY TRACE VERIFICATION (target_ref near reported line) ===")
# choose purchase-chain deps from core latest docs
jobs = ["请购单","采购订单","采购到货单","采购入库单","采购退货单","采购退货出库单","询价单","采购取价策略"]
cand = [d for d in deps if any(j in (d.get("name") or "") for j in jobs)]
p("  candidate deps", len(cand))
import random
random.seed(77)
sample = random.sample(cand, min(20, len(cand)))
verified = 0
for d in sample:
    ref = (d.get("source_refs") or [{}])[0]
    rel = ref.get("file_path") or ""
    path = resolve(rel)
    line = ref.get("line_start")
    tgt = d.get("target_ref") or ""
    found = False
    where = None
    if path and line:
        ls = open(path, "r", encoding="utf-8", errors="replace").read().split("\n")
        for off in range(0, 15):
            j = line - 1 + off
            if 0 <= j < len(ls) and tgt and tgt in ls[j]:
                found = True; where = j + 1; break
        if not found:
            for j, ln in enumerate(ls):
                if tgt and tgt in ln:
                    found = True; where = j + 1; break
    if found: verified += 1
    p("  ", d["id"], "|", d.get("target_ref"), "| rel", d.get("relation_type"),
      "| src", d.get("source_type"), "| conf", d.get("confidence"),
      "| file", rel, "| line", line, "| token_found", found, "at", where,
      "| section", ref.get("section"))
p("  VERIFIED target token present in source:", verified, "/", len(sample))

p("")
p("=== OPEN_QUESTIONS: categories and section-7 gap coverage ===")
p("  categories", dict(collections.Counter(q.get("category") for q in oqs)))
p("  status", dict(collections.Counter(q.get("status") for q in oqs)))
for kw in ["数量口径", "数量约束", "状态条件", "回写", "取单", "入库取到货", "退货关联已入库", "候选关联", "PRD 缺失", "缺 PRD", "未建模", "上游", "下游"]:
    n = sum(1 for q in oqs if kw in (q.get("question") or ""))
    p("  OQ containing", kw, ":", n)
p("  OQ with category MISSING_EVIDENCE / PARSE_ERROR / UNSUPPORTED_FORMAT / SCENARIO_GAP:",
  dict(collections.Counter(q.get("category") for q in oqs if q.get("category") in
       ["MISSING_EVIDENCE","PARSE_ERROR","UNSUPPORTED_FORMAT","SCENARIO_GAP"])))
p("  OQ about 采购入库单 / 请购单 / 采购订单 / 采购到货单 PRD missing or relation gap:",
  sum(1 for q in oqs if re.search(r"采购入库单|请购单|采购订单|采购到货单", q.get("question") or "") and
      re.search(r"缺|未|无|关系|关联|取单|口径", q.get("question") or "")))

p("")
p("=== RULES capturing 取单 可用条件/前置校验 in 采购退货单 (section-7 quantity/status/precondition) ===")
pur = [r for r in rules if r.get("module") == "采购" and re.search(r"取单", r.get("trigger") or "")]
p("  count rules with trigger containing 取单", len(pur))
for r in pur[:12]:
    ref = (r.get("source_refs") or [{}])[0]
    p("   ", r["id"], "|", r.get("source_type"), "|", r.get("rule_type"), "|", (r.get("description") or "")[:150])
    p("      conditions", r.get("conditions"), "| file", ref.get("file_path"), ":", ref.get("line_start"))

p("")
p("=== FRAMEWORK PRD INDEX (knowledge/athena-prd-map.json) vs Phase 1 purchase chain ===")
mp = json.load(open(os.path.join(ROOT, "knowledge", "athena-prd-map.json"), "r", encoding="utf-8"))
ents = mp.get("entries", [])
p("  entries count", len(ents), "generatedAt", mp.get("generatedAt"))
names = []
for e in ents:
    nm = e.get("workItem") or e.get("job") or e.get("name") or e.get("work_item") or str(list(e.keys())[:6])
    names.append(str(nm))
p("  entry names", names)
p("  purchase-chain names present:", [n for n in names if any(k in n for k in ["采购","请购","询价","退货","入库","到货","供应商","品号"])])

p("")
p("=== COVERAGE_MATRIX section 6 logic check ===")
folders = set(d.get("relative_path","").split("/")[0] for d in docs if d.get("source_role") == "PRD")
p("  first-segment folders of PRD docs (sample)", sorted(folders)[:40])
cases = load("existing-cases.json")
mods = sorted(set(c.get("module") for c in cases))
p("  existing-case modules", mods)
p("  modules NOT equal to any first-segment folder:", [m for m in mods if m not in folders])
p("  NOTE: report compares module(job name) vs path first segment(domain folder) -> structural mismatch")

p("")
p("=== VERSION_CONFLICTS registration for purchase core jobs ===")
vq = [q for q in oqs if q.get("category") == "VERSION_CONFLICT"]
p("  VERSION_CONFLICT count", len(vq))
p("  jobs with version conflict", [q.get("question","").split(" 存在")[0] for q in vq])
p("  core 4 jobs (请购单/采购订单/采购到货单/采购入库单) have version conflict:",
  any(any(k in (q.get("question") or "") for k in ["请购单","采购订单","采购到货单","采购入库单"]) for q in vq))

with open(os.path.join(OUT, "acc_final_checks.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("\n".join(L))
