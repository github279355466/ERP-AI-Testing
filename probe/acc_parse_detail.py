# -*- coding: utf-8 -*-
"""Read-only parse-quality deep checks."""
import os, json, collections

ROOT = r"D:/AIProject/ERP-AI-Testing"
K = os.path.join(ROOT, "artifacts", "knowledge")
PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
TC  = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
OUT = os.path.join(ROOT, "probe")

def load(n):
    return json.load(open(os.path.join(K, n), "r", encoding="utf-8"))

docs = load("documents.json")
rules = load("rules.json")
fields = load("fields.json")
entities = load("entities.json")
L = []
def p(*a): L.append(" ".join(str(x) for x in a))

by_doc_rules = collections.Counter(r["document_id"] for r in rules)
by_doc_fields = collections.Counter(f["document_id"] for f in fields)
doc_entities = collections.Counter()
for e in entities:
    for d in e.get("document_ids", []):
        doc_entities[d] += 1

p("=== ROOT-LEVEL scattered MD (no job directory) ===")
for d in docs:
    rp = d.get("relative_path", "")
    if "/" not in rp and rp.lower().endswith((".md", ".markdown", ".txt")):
        p(" ", d["id"], "|", rp, "| parser", d.get("parser"), "| module", d.get("module"),
          "| sec", d.get("section_count"), "| tbl", d.get("table_count"),
          "| fields", by_doc_fields[d["id"]], "| rules", by_doc_rules[d["id"]],
          "| entities", doc_entities[d["id"]], "| entity_names", d.get("entity_names"),
          "| is_latest", d.get("is_latest"), "| size", d.get("size_bytes"))
p("  count root-level md in register", sum(1 for d in docs if "/" not in d.get("relative_path","") and d.get("relative_path","").lower().endswith((".md",".markdown",".txt"))))

p("")
p("=== entity_names FALSE-NEGATIVE (markdown PRD docs with entities but entity_names empty) ===")
fn = [d for d in docs if d.get("source_role") == "PRD" and not d.get("entity_names") and doc_entities[d["id"]] > 0]
p("  count", len(fn))
for d in fn[:12]:
    p("   ", d.get("relative_path"), "| parser", d.get("parser"), "| entities", doc_entities[d["id"]])
p("  PRD_ANALYSIS_REPORT '文档未识别实体' metric = PRD docs with entity_names empty =",
  sum(1 for d in docs if d.get("source_role") == "PRD" and not d.get("entity_names")))

p("")
p("=== PRD docs with 0 rules (content-loss candidates) ===")
zero = [d for d in docs if d.get("source_role") == "PRD" and by_doc_rules[d["id"]] == 0]
p("  count", len(zero))
byfolder = collections.Counter()
for d in zero:
    rp = d.get("relative_path", "")
    seg = rp.split("/")[0] if "/" in rp else "(root)"
    byfolder[seg] += 1
for d in zero[:45]:
    p("   ", d["id"], "|", d.get("relative_path"), "| parser", d.get("parser"),
      "| size", d.get("size_bytes"), "| sec", d.get("section_count"), "| tbl", d.get("table_count"),
      "| latest", d.get("is_latest"))
p("  by first segment", dict(byfolder))

p("")
p("=== docs with table_count>0 but 0 fields (tables not parsed into fields) ===")
tbf = [d for d in docs if d.get("source_role") == "PRD" and d.get("table_count", 0) > 0 and by_doc_fields[d["id"]] == 0]
p("  count", len(tbf))
for d in tbf[:15]:
    p("   ", d.get("relative_path"), "| tbl", d.get("table_count"), "| rules", by_doc_rules[d["id"]])

p("")
p("=== PLATFORM JSON fidelity (source attrs/operations/changeLog vs output fields/rules) ===")
jsondocs = [d for d in docs if d.get("parser") == "json"]
p("  json PRD docs", len(jsondocs))
def readjson(path):
    try:
        return json.load(open(path, "r", encoding="utf-8"))
    except Exception as e:
        return {"__err__": str(e)}
for d in jsondocs[:30]:
    path = d.get("file_path")
    j = readjson(path)
    spec = None
    if isinstance(j, dict):
        root = j.get("data", {}).get("params", {}).get("prd_spec") if isinstance(j.get("data"), dict) else None
        sl = root if isinstance(root, list) else j.get("prd_spec")
        if isinstance(sl, list) and sl and isinstance(sl[0], dict):
            spec = sl[0]
    attrs = spec.get("prd_spec_attr_func_cfg") if spec else None
    oprs = spec.get("prd_spec_opr_func_cfg") if spec else None
    logs = spec.get("prd_spec_chg_log") if spec else None
    noun = spec.get("noun_expl_list") if spec else None
    bkg = spec.get("dem_bkg") if spec else None
    p("  ", d.get("relative_path"))
    p("     src attrs", len(attrs) if isinstance(attrs, list) else "N/A",
      "| src operations", len(oprs) if isinstance(oprs, list) else "N/A",
      "| src changelog", len(logs) if isinstance(logs, list) else "N/A",
      "| noun_list", bool(noun), "| background", bool(bkg))
    p("     out fields", by_doc_fields[d["id"]], "| out rules", by_doc_rules[d["id"]],
      "| out actions(doc)", sum(1 for a in load("actions.json") if a.get("document_id") == d["id"]),
      "| out section_count", d.get("section_count"), "| out table_count", d.get("table_count"))

p("")
p("=== STRUCTURE RETENTION CHECK (what types.ts / documents.json actually store) ===")
p("  DocumentRecord has section_count, table_count, entity_names only; no list/paragraph/heading fields.")
p("  MarkdownDocument (parsers.ts) keeps lines/headings/tables/sections but NOT list items or paragraph objects.")
p("  parsePrdJsonPayload keeps attrs/operations/changeLog/nounList/background; output objects keep no raw paragraph/list structure.")
p("  docs with section_count==0:", sum(1 for d in docs if d.get("section_count") == 0),
  "(of which json parser:", sum(1 for d in docs if d.get("section_count") == 0 and d.get("parser") == "json"),
  ", test-case-json:", sum(1 for d in docs if d.get("section_count") == 0 and d.get("parser") == "test-case-json"), ")")

with open(os.path.join(OUT, "acc_parse_detail.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("\n".join(L))
