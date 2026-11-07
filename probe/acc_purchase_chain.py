# -*- coding: utf-8 -*-
"""Read-only: purchase-chain relationship evidence in PRD originals vs modeled objects."""
import os, json, re, collections

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
TC  = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
OUT = os.path.join(ROOT, "probe")

def load(n): return json.load(open(os.path.join(K, n), "r", encoding="utf-8"))
docs = load("documents.json"); deps = load("dependencies.json"); wfs = load("workflows.json")
ents = load("entities.json"); rules = load("rules.json"); oqs = load("open-questions.json")
L = []
def p(*a): L.append(" ".join(str(x) for x in a))

CORE = {
 "供应商资料(代理:供应商业务信息)": os.path.join(TC, "供应商域/供应商业务信息/DOC410884105204498432_供应商业务信息_V1.16.md"),
 "品号资料(代理:品号通用信息)": os.path.join(TC, "基础资料域/品号通用信息/DOC408784437012168705_品号通用信息_V1.10.md"),
 "请购单": os.path.join(TC, "采购域/请购单/DOC411595859844759552_请购单_V1.12.md"),
 "采购订单": os.path.join(TC, "采购域/采购订单/DOC415646892677804032_采购订单_V1.13.md"),
 "采购到货单": os.path.join(TC, "采购域/采购到货单/DOC411256039758987264_采购到货单_V1.23.md"),
 "采购入库单": os.path.join(TC, "采购域/采购入库单/DOC482078_采购入库单_V1.19.md"),
 "采购退货单": os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"),
 "采购退货出库单": os.path.join(PRD, "采购退货出库单/采购退货出库单PRD.v1.24.md"),
 "询价单": os.path.join(PRD, "询价单/询价单PRD.v1.8.md"),
}
KW = re.compile(r"取单|来源单据|上游|下游|回写|关联|请购|采购订单|到货单|入库单|退货单|可退货量|已入库量|数量约束|状态|审核|前置条件|引用")
for name, path in CORE.items():
    p("")
    p("=" * 100)
    p("DOC " + name)
    p("PATH " + path)
    if not os.path.exists(path):
        p("  MISSING FILE")
        continue
    lines = open(path, "r", encoding="utf-8", errors="replace").read().split("\n")
    p("  total_lines", len(lines))
    hits = [(i+1, ln.strip()) for i, ln in enumerate(lines) if KW.search(ln)]
    p("  keyword hits", len(hits))
    # show headings containing 取单/来源/关联/流程/状态
    p("  --- headings & 取单/来源/关联 sections ---")
    for i, ln in enumerate(lines):
        if re.match(r"^#{1,6}\s", ln) and KW.search(ln):
            p(f"   {i+1:5d}| {ln.strip()[:160]}")
    p("  --- first 25 keyword lines (truncated 200 chars) ---")
    for i, ln in hits[:25]:
        p(f"   {i:5d}| {ln[:200]}")

p("")
p("=" * 100)
p("MODELED OBJECTS FOR THE 7 CORE NODES")
jobs = ["请购单", "采购订单", "采购到货单", "采购入库单", "采购退货单", "供应商业务信息", "品号通用信息", "采购退货出库单", "询价单"]
for job in jobs:
    ds = [d for d in docs if d.get("job_directory") == job and d.get("source_role") == "PRD"]
    ids = set(d["id"] for d in ds)
    d_deps = [x for x in deps if x.get("document_id") in ids]
    d_wfs = [x for x in wfs if x.get("document_id") in ids]
    p(" ", job, "| docs", len(ds), "| deps", len(d_deps), "| workflows", len(d_wfs),
      "| dep relation_types", dict(collections.Counter(x.get("relation_type") for x in d_deps)),
      "| dep source_types", dict(collections.Counter(x.get("source_type") for x in d_deps)))
    for x in d_deps[:6]:
        p("     DEP", x["id"], "->", x.get("target_ref"), "| section", (x.get("source_refs") or [{}])[0].get("section"))

p("")
p("=== DEPENDENCIES whose target_ref looks like a purchase DOCUMENT/entity (not API/field token) ===")
doclike = ["请购单", "采购订单", "采购到货单", "采购入库单", "采购退货单", "询价单", "requ_doc", "pur_arr_doc",
           "pur_stkin_doc", "pur_rtn_doc", "inq_doc", "po", "供应商", "品号"]
for x in deps:
    t = x.get("target_ref") or ""
    if any(k in t for k in doclike):
        p("  ", x["id"], "|", x.get("name"), "| target", t, "|", (x.get("source_refs") or [{}])[0].get("file_path"))
p("  count", sum(1 for x in deps if any(k in (x.get("target_ref") or "") for k in doclike)))

p("")
p("=== workflow steps mentioning 取单/上游/来源/关联 ===")
for w in wfs:
    joined = " ".join((s.get("step","") + s.get("description","") + s.get("exception","")) for s in w.get("steps", []))
    if KW.search(joined) and any(k in joined for k in ["取单","来源","上游","关联","回写"]):
        p("  ", w["id"], "|", w.get("name"), "| steps", len(w.get("steps", [])),
          "| file", (w.get("source_refs") or [{}])[0].get("file_path"))
        for s in w.get("steps", [])[:4]:
            p("      ", s.get("seq"), s.get("step"), "|", (s.get("description") or "")[:100])

p("")
p("=== RULES with 取单/来源单据/回写 keywords in purchase module (evidence for chain relations) ===")
rx = [r for r in rules if r.get("module") == "采购" and re.search(r"取单|来源单据|回写|上游|下游", r.get("description") or "")]
p("  count", len(rx))
for r in rx[:25]:
    ref = (r.get("source_refs") or [{}])[0]
    p("   ", r["id"], "|", r.get("source_type"), "|", r.get("rule_type"), "|", (r.get("description") or "")[:120],
      "|", ref.get("file_path"), ":", ref.get("line_start"))

p("")
p("=== OPEN QUESTIONS: any about missing PRD / unconfirmed purchase relations / quantity/status/writeback? ===")
for q in oqs:
    t = q.get("question") or ""
    if re.search(r"采购|请购|到货|入库|退货|数量|状态|回写|取单|PRD", t):
        p("  ", q["id"], "|", q.get("category"), "|", q.get("severity"), "|", t[:150])
p("  count of OQ mentioning purchase-ish", sum(1 for q in oqs if re.search(r"采购|请购|到货|入库|退货|数量|状态|回写|取单|PRD", q.get("question") or "")))

with open(os.path.join(OUT, "acc_purchase_chain.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("written", len(L), "lines")
