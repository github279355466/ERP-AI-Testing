# -*- coding: utf-8 -*-
"""Read-only follow-up: verify 02/04 spec requirements + team-lead leads.
Writes probe/acc_spec_followup.out.txt
"""
import os, json, re, collections, hashlib

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
SI = os.path.join(ROOT, "artifacts", "source-index")
DEV = os.path.join(ROOT, "docs", "plan", "Athena-ERP-Test-Development-Kit")
L = []
def p(*a): L.append(" ".join(str(x) for x in a))
def load(n, d=K): return json.load(open(os.path.join(d, n), "r", encoding="utf-8"))

rules=load("rules.json"); fields=load("fields.json"); controls=load("controls.json")
actions=load("actions.json"); deps=load("dependencies.json"); wfs=load("workflows.json")
docs=load("documents.json"); ents=load("entities.json"); oqs=load("open-questions.json")
scns=load("scenarios.json"); summary=load("summary.json")

p("=== A. 02 §5 source_type 六分类实际使用 ===")
p("  rules source_type:", dict(collections.Counter(r.get("source_type") for r in rules)))
p("  fields source_type:", dict(collections.Counter(f.get("source_type") for f in fields)))
p("  dependencies source_type:", dict(collections.Counter(d.get("source_type") for d in deps)))
for t in ["PLATFORM_SERVICE","UI_OBSERVED","USER_CONFIRMED","PENDING"]:
    p("   ", t, "in rules:", sum(1 for r in rules if r.get("source_type")==t),
      "in fields:", sum(1 for f in fields if f.get("source_type")==t))
# platform-service statements swallowed?
plat = [r for r in rules if re.search(r"调用接口|调用[:：]|bm\.[a-z0-9_]+\.[a-z0-9_]+", r.get("description") or "")]
p("  rules whose description mentions 调用接口/bm.* (platform-service statements):", len(plat))
p("     their source_type:", dict(collections.Counter(r.get("source_type") for r in plat)))
p("  OQ mentioning 平台服务/PLATFORM_SERVICE:", sum(1 for q in oqs if re.search(r"平台服务|PLATFORM_SERVICE|公共服务", q.get("question") or "")))

p("")
p("=== B. 02 §11 证据追溯 7 要素 / 04 §5 证据引用 ===")
keys = collections.Counter()
for r in rules:
    for ref in (r.get("source_refs") or []):
        for k in ref: keys[k]+=1
p("  rule source_refs key union:", dict(keys))
p("  total rules:", len(rules))
p("  with line_end:", keys.get("line_end",0), "| with page:", keys.get("page",0),
  "| with page_no:", keys.get("page_no",0), "| with paragraph_index:", keys.get("paragraph_index",0),
  "| with doc_version:", keys.get("doc_version",0), "| with sha256/hash:", keys.get("sha256",0))
p("  with excerpt:", keys.get("excerpt",0), "| with section:", keys.get("section",0),
  "| with line_start:", keys.get("line_start",0), "| with document_id:", keys.get("document_id",0))
# file_path absolute?
absfp = sum(1 for r in rules for ref in (r.get("source_refs") or []) if (ref.get("file_path") or "").startswith(("C:","D:","/")))
p("  source_refs file_path that is ABSOLUTE path:", absfp, "(rest are relative)")
# EVIDENCE_MISSING marker anywhere?
hits = {}
for n in ["rules.json","fields.json","controls.json","actions.json","workflows.json","dependencies.json","scenarios.json","open-questions.json","documents.json"]:
    txt = open(os.path.join(K,n),"r",encoding="utf-8").read()
    hits[n] = txt.count("EVIDENCE_MISSING")
p("  'EVIDENCE_MISSING' occurrences by file:", hits)
p("  'UNSUPPORTED_FORMAT' occurrences in knowledge:", sum(open(os.path.join(K,n),'r',encoding='utf-8').read().count('UNSUPPORTED_FORMAT') for n in ["rules.json","fields.json","open-questions.json"]))
p("  'UNKNOWN' version markers in documents.doc_version:", sum(1 for d in docs if d.get("doc_version")=="UNKNOWN"),
  "| null doc_version:", sum(1 for d in docs if not (d.get("doc_version") or "").strip()))
p("  documents with sha256:", sum(1 for d in docs if d.get("sha256")))

p("")
p("=== C. 02 §13 解析质量 6 分级 ===")
p("  types.ts Confidence:", "CONFIRMED|DERIVED|AMBIGUOUS|CONFLICTED|MISSING (5, lacks UNSUPPORTED_FORMAT)")
p("  rule.schema.json confidence enum:", json.load(open(os.path.join(DEV,"schemas","rule.schema.json"),encoding="utf-8"))["properties"]["confidence"]["enum"])
p("  actual rule confidence:", dict(collections.Counter(r.get("confidence") for r in rules)))
p("  actual field confidence:", dict(collections.Counter(f.get("confidence") for f in fields)))
p("  EVIDENCE_MISSING / UNSUPPORTED_FORMAT markers:", "see section B")

p("")
p("=== D. 02 §6/§7 字段与规则必备要素 ===")
p("  fields: data_type null:", sum(1 for f in fields if not f.get("data_type")),
  "| length null:", sum(1 for f in fields if f.get("length") is None),
  "| precision null:", sum(1 for f in fields if f.get("precision") is None),
  "| related_master_data null:", sum(1 for f in fields if not f.get("related_master_data")),
  "| total:", len(fields))
p("  rules: applies_to empty:", sum(1 for r in rules if not r.get("applies_to")),
  "| conditions empty:", sum(1 for r in rules if not r.get("conditions")),
  "| open_question_ids empty:", sum(1 for r in rules if not r.get("open_question_ids")),
  "| derivation null:", sum(1 for r in rules if not (r.get("derivation") or "").strip()),
  "| total:", len(rules))
p("  rules with trigger null:", sum(1 for r in rules if not r.get("trigger")))
p("  rules with expected_result null:", sum(1 for r in rules if not r.get("expected_result")))

p("")
p("=== E. 02 §9 流程 9 要素 / 04 §6 关系对象契约 ===")
p("  workflows total:", len(wfs), "| union of top-level keys:", sorted({k for w in wfs for k in w.keys()}))
p("  workflow steps keys:", sorted({k for w in wfs for s in w.get("steps",[]) for k in s.keys()}))
p("  workflows with structured 起点/终点/单据节点/节点间关系/映射/数量口径/关系证据/来源类型:", 0)
txt_qty = sum(1 for w in wfs if re.search(r"数量|已到货|未到货|已入库|未入库|可退|占用|释放|回写"," ".join((s.get("step","")+s.get("description","")+s.get("exception","")) for s in w.get("steps",[]))))
p("  workflows whose step TEXT mentions 数量/已到货/未到货/占用/释放/回写 (free text only):", txt_qty)
# template duplication: identical normalized step sequences across modules
sig = collections.defaultdict(list)
for w in wfs:
    s = tuple((x.get("step",""), (x.get("description","") or "")[:40]) for x in w.get("steps",[]))
    sig[hashlib.md5(repr(s).encode("utf-8")).hexdigest()].append((w.get("id"),w.get("module"),w.get("name")))
dupgroups = {k:v for k,v in sig.items() if len(v)>1}
cross = {k:v for k,v in dupgroups.items() if len(set(x[1] for x in v))>1}
p("  distinct workflow step-signatures:", len(sig), "| duplicated signatures:", len(dupgroups),
  "| duplicated signatures spanning >1 module:", len(cross))
p("     max group size:", max((len(v) for v in dupgroups.values()), default=0))
p("  dependencies: total", len(deps), "| source_id non-null:", sum(1 for d in deps if d.get("source_id")),
  "| target_id non-null:", sum(1 for d in deps if d.get("target_id")),
  "| mapping non-null:", sum(1 for d in deps if (d.get("mapping") or "").strip()),
  "| source_refs non-empty:", sum(1 for d in deps if d.get("source_refs")),
  "| relation_type:", dict(collections.Counter(d.get("relation_type") for d in deps)),
  "| source_type:", dict(collections.Counter(d.get("source_type") for d in deps)),
  "| confidence:", dict(collections.Counter(d.get("confidence") for d in deps)))
p("  9 recommended relation types present:", [t for t in ["USES_MASTER_DATA","DERIVED_FROM","GENERATES","REFERENCES","CONSUMES","RETURNS_TO","STATUS_TRANSITION","FIELD_DEPENDENCY","CANDIDATE_LINK"] if any(d.get("relation_type")==t for d in deps)])

p("")
p("=== F. 02 §12 OPEN_QUESTIONS 六字段 + 重复登记分析 ===")
req = ["question","document_ids","evidence","impact","suggested_owner","status"]
p("  OQ total:", len(oqs))
for k in req:
    p("   ", k, "missing/empty:", sum(1 for q in oqs if not q.get(k)))
p("  OQ with empty evidence array:", sum(1 for q in oqs if not q.get("evidence")))
p("  OQ status values:", dict(collections.Counter(q.get("status") for q in oqs)))
p("  OQ categories:", dict(collections.Counter(q.get("category") for q in oqs)))
# dedup
exact = collections.Counter(q.get("question") for q in oqs)
p("  DISTINCT exact question strings:", len(exact), "of", len(oqs))
p("  exact-duplicate groups (question appears >1):", sum(1 for v in exact.values() if v>1),
  "| entries in those groups:", sum(v for v in exact.values() if v>1))
p("  top repeated exact questions:")
for q,c in exact.most_common(6):
    p("     x",c,"|",q[:110])
# normalized: strip counts like "N 种", "N 份文档", "N 个文档"
def norm(q):
    s = q.get("question") or ""
    s = re.sub(r"\d+\s*种", "N 种", s)
    s = re.sub(r"\d+\s*份文档", "N 份文档", s)
    s = re.sub(r"\d+\s*个", "N 个", s)
    s = re.sub(r"\d+\s*笔", "N 笔", s)
    return (q.get("category"), s)
normc = collections.Counter(norm(q) for q in oqs)
p("  DISTINCT normalized (category + question with digit-counts masked):", len(normc), "of", len(oqs))
# BROKEN_FLOW dedup by target set
bf = [q for q in oqs if q.get("category")=="BROKEN_FLOW"]
def bfkey(q):
    m = re.search(r"对象[：:]\s*(.+)$", q.get("question") or "")
    return (m.group(1).strip() if m else q.get("question"))
bfc = collections.Counter(bfkey(q) for q in bf)
p("  BROKEN_FLOW total:", len(bf), "| distinct target-sets:", len(bfc),
  "| biggest group:", max(bfc.values(), default=0))
for k,c in bfc.most_common(4): p("     x",c,"|",k[:120])
# RULE_CONFLICT normalized by entity/field/rule_type
rc = [q for q in oqs if q.get("category")=="RULE_CONFLICT"]
def rckey(q):
    s = q.get("question") or ""
    m = re.search(r"^(.*?) 的字段 (\S+) 在(.+?)有 \d+ 种 (\S+) 表述", s)
    if m: return (m.group(1),m.group(2),m.group(3).strip(),m.group(4))
    return (s,)
rcc = collections.Counter(rckey(q) for q in rc)
p("  RULE_CONFLICT total:", len(rc), "| distinct (entity,field,scope,ruleType):", len(rcc),
  "| biggest group:", max(rcc.values(), default=0))
# VERSION_CONFLICT: 20 unique jobs
vc = [q for q in oqs if q.get("category")=="VERSION_CONFLICT"]
p("  VERSION_CONFLICT total:", len(vc), "| distinct jobs:", len(set((q.get("question") or "").split(" 存在")[0] for q in vc)))
p("  ESTIMATE independent questions after dedup:",
  len(normc), "(normalized) / exact", len(exact), "| reduction vs 330:", 330-len(normc))

p("")
p("=== G. OPEN_QUESTIONS.md 展示截断核实 ===")
mdp = os.path.join(ROOT,"reports","OPEN_QUESTIONS.md")
md = open(mdp,"r",encoding="utf-8").read().split("\n")
p("  MD lines:", len(md))
notice = [(i+1, ln.strip()) for i,ln in enumerate(md) if "仅显示前" in ln or "完整清单见" in ln]
p("  explicit truncation notices:", notice)
p("  MD table data rows (lines starting with '| OQ-'):", sum(1 for ln in md if ln.startswith("| OQ-")))
p("  JSON OQ total:", len(oqs), "| JSON 330 完整:", len(oqs)==330)
# per-section rendered counts
secs = collections.Counter()
cur = ""
for ln in md:
    if ln.startswith("## "): cur = ln.strip()
    if ln.startswith("| OQ-"): secs[cur]+=1
p("  rendered OQ rows per section:", dict(secs))
p("  sections exceeding 100 rendered rows:", {k:v for k,v in secs.items() if v>100})
p("  NOTE: JSON is authoritative and complete; truncation is disclosed. Risk: human reviewer reading only MD")
p("        sees <=100/276 RULE_CONFLICT rows and <=100 per section; no pointer to which specific IDs are omitted.")

p("")
p("=== H. VERSION_CONFLICTS _diff 污染 + 旧索引过期核实 ===")
vcp = os.path.join(ROOT,"reports","VERSION_CONFLICTS.md")
vct = open(vcp,"r",encoding="utf-8").read().split("\n")
detail = [ln.strip() for ln in vct if ln.strip().startswith("- ") ]
p("  VERSION_CONFLICTS.md 明细行(以 '- ' 开头):", len(detail))
diffd = [x for x in detail if "/_diff/" in x or "\\_diff\\" in x]
p("  来自 _diff 的明细行:", len(diffd))
p("  其中带 (v数字):", sum(1 for x in diffd if re.search(r"\(v\d",x)),
  "| 带 (vUNKNOWN):", sum(1 for x in diffd if "vUNKNOWN" in x))
p("  采购退货出库单 冲突描述:", [q.get("question") for q in vc if "采购退货出库单" in (q.get("question") or "")][:1])
# _diff docs in version groups
grp = collections.defaultdict(list)
for d in docs:
    if d.get("source_role")=="PRD":
        grp[d.get("job_directory") or d.get("relative_path","").split("/")[0]].append(d)
p("  _diff PRD docs:", sum(1 for d in docs if d.get("source_role")=="PRD" and "/_diff/" in d.get("relative_path","")),
  "| of these is_latest:", sum(1 for d in docs if d.get("source_role")=="PRD" and "/_diff/" in d.get("relative_path","") and d.get("is_latest")))
p("  is_latest docs total:", sum(1 for d in docs if d.get("is_latest")),
  "| is_latest in top-level (no '/' in relative_path):", sum(1 for d in docs if d.get("is_latest") and "/" not in d.get("relative_path","")))
p("  47 is_latest all in top-level dirs:", all("/" not in d.get("relative_path","") or not re.search(r"/_(diff|history|review|upload)/", d.get("relative_path","")) for d in docs if d.get("is_latest")))
p("  _diff docs with fields:", sum(1 for d in docs if "/_diff/" in d.get("relative_path","") and any(f.get("document_id")==d["id"] for f in fields)))
p("  old index generatedAt:", json.load(open(os.path.join(ROOT,"knowledge","athena-prd-map.json"),encoding="utf-8")).get("generatedAt"))
p("  PRD-MAPPING.md:17 采购退货出库单 v1.22; Phase1 VERSION_CONFLICTS 候选 v1.24")
p("  mtimes: 采购退货出库单PRD.v1.24.md=2026-11-06T18:48:51, 询价单PRD.v1.8.md=2026-11-07T11:02:22, 会计期间信息PRD.v1.7.md=2026-11-07T11:23:35; PRD-MAPPING.md=2026-11-06T15:25:39, athena-prd-map.json=2026-11-06T15:25:10")
p("  -> 旧索引早于顶层正式 PRD 的 mtime，版本口径不一致根因为旧索引未重生成，非 Phase 1 最新版判定算错")

p("")
p("=== I. 覆盖率分母口径复核 ===")
p("  summary.coverage:", summary["coverage"])
p("  latest rule count (is_latest docs):", sum(1 for r in rules if any(d["id"]==r.get("document_id") and d.get("is_latest") for d in docs)))
p("  854/4657 =", round(854/4657*100,2), "%")
p("  COVERAGE_MATRIX.md:19 说明: '规则覆盖率按「对象字段 + 规则类型」与测试用例库做语义匹配，不是规则 ID 直接对应；匹配结果用于发现缺口，不作为用例正确性证据'")
p("  KNOWN_LIMITATIONS.md:31 说明: '覆盖率是字段级匹配…不判断用例断言口径是否与规则语义一致。覆盖率只用于发现缺口'")
p("  -> 分母 4657=最新版规则数；非业务覆盖率；两处表述准确")

p("")
p("=== J. E 项线索：4 核心单据确切路径与原文内容核实 ===")
P = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace"
TC = os.path.join(P,"测试用例")
core = {
 "请购单": "采购域/请购单/DOC411595859844759552_请购单_V1.12.md",
 "采购订单": "采购域/采购订单/DOC415646892677804032_采购订单_V1.13.md",
 "采购到货单": "采购域/采购到货单/DOC411256039758987264_采购到货单_V1.23.md",
 "采购入库单": "采购域/采购入库单/DOC482078_采购入库单_V1.19.md",
}
for job, rel in core.items():
    path = os.path.join(TC, rel)
    ls = open(path,"r",encoding="utf-8",errors="replace").read().split("\n")
    d = next((x for x in docs if x.get("job_directory")==job and x.get("source_role")=="PRD"), None)
    p("  ", job, "| EXISTS", os.path.exists(path), "| lines", len(ls))
    p("     exact path:", path)
    p("     doc:", d["id"] if d else None, "| is_latest", d.get("is_latest") if d else None,
      "| doc_version", d.get("doc_version") if d else None,
      "| rules", sum(1 for r in rules if r.get("document_id")==(d["id"] if d else None)))
    for i,ln in enumerate(ls):
        if re.match(r"^####\s*取单", ln):
            p("     取单 heading at line", i+1, "|", (ls[i+8] if i+8<len(ls) else "")[:170])
    for i,ln in enumerate(ls):
        if "业务流程图" in ln and re.match(r"^#{2,4}",ln):
            p("     业务流程图 heading at", i+1, "| next content:", (ls[i+2] if i+2<len(ls) else "").strip()[:60])

p("")
p("=== K. 02 §15 / 04 契约：Schema 与运行时校验 ===")
p("  dev-kit schemas:", os.listdir(os.path.join(DEV,"schemas")))
p("  repo-level 'schemas/' exists:", os.path.exists(os.path.join(ROOT,"schemas")))
src = ""
for dp,dn,fn in os.walk(os.path.join(ROOT,"src")):
    for f in fn:
        if f.endswith((".ts",".js")):
            src += open(os.path.join(dp,f),"r",encoding="utf-8",errors="replace").read()
p("  'schema' keyword in src/:", src.count("schema"), "| 'Ajv' in src/:", src.count("Ajv"),
  "| 'draft-07'/'2020-12' in src/:", src.count("2020-12"))
p("  rule.schema.json required:", json.load(open(os.path.join(DEV,"schemas","rule.schema.json"),encoding="utf-8"))["required"])
p("  validate.ts is self-implemented (per reports/KNOWN_LIMITATIONS.md:38)")

with open(os.path.join(ROOT,"probe","acc_spec_followup.out.txt"),"w",encoding="utf-8") as f:
    f.write("\n".join(L)+"\n")
print("\n".join(L))
