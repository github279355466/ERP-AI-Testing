# -*- coding: utf-8 -*-
"""Read-only: extract 取单/来源/业务流程图 sections from the 7 core purchase PRDs;
and global stats on rule conditions / dependency mapping / workflow coverage."""
import os, json, re, collections

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
TC  = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
OUT = os.path.join(ROOT, "probe")
def load(n): return json.load(open(os.path.join(K, n), "r", encoding="utf-8"))

rules = load("rules.json"); deps = load("dependencies.json"); wfs = load("workflows.json")
docs = load("documents.json"); ents = load("entities.json")
L = []
def p(*a): L.append(" ".join(str(x) for x in a))

p("=== GLOBAL STRUCTURE STATS ===")
p("  rules with conditions non-empty:", sum(1 for r in rules if r.get("conditions")))
p("  rules with derivation non-null:", sum(1 for r in rules if (r.get("derivation") or "").strip()))
p("  rules with expected_result null:", sum(1 for r in rules if not (r.get("expected_result") or "").strip()))
p("  rules with trigger null:", sum(1 for r in rules if not (r.get("trigger") or "").strip()))
p("  deps with target_id non-null:", sum(1 for d in deps if d.get("target_id")))
p("  deps with mapping non-null:", sum(1 for d in deps if (d.get("mapping") or "").strip()))
p("  deps relation_type:", dict(collections.Counter(d.get("relation_type") for d in deps)))
p("  deps source_type:", dict(collections.Counter(d.get("source_type") for d in deps)))
p("  deps confidence:", dict(collections.Counter(d.get("confidence") for d in deps)))
p("  workflows total:", len(wfs))
p("  entity pairs linked by dependencies (target_id):", 0)

p("")
p("=== CANDIDATE_LINK / USES_MASTER_DATA / DERIVED_FROM / GENERATES / CONSUMES / RETURNS_TO present? ===")
for t in ["USES_MASTER_DATA","DERIVED_FROM","GENERATES","CONSUMES","RETURNS_TO","STATUS_TRANSITION","FIELD_DEPENDENCY","CANDIDATE_LINK"]:
    p("  ", t, sum(1 for d in deps if d.get("relation_type") == t))

CORE = {
 "请购单": os.path.join(TC, "采购域/请购单/DOC411595859844759552_请购单_V1.12.md"),
 "采购订单": os.path.join(TC, "采购域/采购订单/DOC415646892677804032_采购订单_V1.13.md"),
 "采购到货单": os.path.join(TC, "采购域/采购到货单/DOC411256039758987264_采购到货单_V1.23.md"),
 "采购入库单": os.path.join(TC, "采购域/采购入库单/DOC482078_采购入库单_V1.19.md"),
 "采购退货单": os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"),
 "采购退货出库单": os.path.join(PRD, "采购退货出库单/采购退货出库单PRD.v1.24.md"),
}
SECT = re.compile(r"取单|来源单据|业务流程图|流程图|回写|上游|下游|关联")
for name, path in CORE.items():
    p("")
    p("=" * 100)
    p("DOC " + name + " PATH " + path)
    lines = open(path, "r", encoding="utf-8", errors="replace").read().split("\n")
    p("  lines", len(lines))
    # find headings matching section keywords
    hs = [(i+1, ln.strip()) for i, ln in enumerate(lines) if re.match(r"^#{2,5}\s", ln) and SECT.search(ln)]
    for i, h in hs:
        p(f"  HEADING {i:5d}| {h[:160]}")
    # dump windows around 取单 headings (max 2 per doc, 18 lines each)
    for i, h in [x for x in hs if "取单" in x[1]][:3]:
        a, b = max(0, i-2), min(len(lines), i+16)
        p(f"  --- 取单 window lines {a+1}..{b} ---")
        for j in range(a, b):
            p(f"   {j+1:5d}| {lines[j][:260]}")
    # business flow diagram section
    for i, h in [x for x in hs if re.search(r"流程图|业务流程图", x[1])][:1]:
        a, b = max(0, i-2), min(len(lines), i+14)
        p(f"  --- 流程图 window lines {a+1}..{b} ---")
        for j in range(a, b):
            p(f"   {j+1:5d}| {lines[j][:260]}")
    # exact keyword lines for chain relations
    p("  --- chain relation lines ---")
    RX = re.compile(r"请购单|采购订单|到货单|入库单|退货单|已入库量|可退货量|取请购|来源单据类型|来源单号")
    shown = 0
    for i, ln in enumerate(lines):
        if RX.search(ln) and shown < 18:
            p(f"   {i+1:5d}| {ln.strip()[:240]}")
            shown += 1

p("")
p("=== PRD section 7 required chain checks: modeled deps per node ===")
for job in ["请购单","采购订单","采购到货单","采购入库单","采购退货单","采购退货出库单"]:
    ds = [d for d in docs if d.get("job_directory") == job and d.get("source_role") == "PRD" and d.get("is_latest")]
    ids = set(d["id"] for d in ds)
    dd = [x for x in deps if x.get("document_id") in ids]
    p("  ", job, "| latest doc", len(ds), "| deps", len(dd),
      "| targets", [x.get("target_ref") for x in dd][:12])

with open(os.path.join(OUT, "acc_chain_detail.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("\n".join(L))
