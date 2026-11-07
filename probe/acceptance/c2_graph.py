#!/usr/bin/env python3
# C 项取证 2：全库 ID 唯一性 / 格式 / 跨类型冲突 / 错误引用 / 孤立节点
import os, sys, json, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

KD = "artifacts/knowledge"
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "c2_graph.json")
ARR = ["documents","entities","pages","fields","controls","rules","actions","workflows",
       "dependencies","scenarios","existing-cases","open-questions"]
ID_FIELD = {"existing-cases": "case_id"}

ids = {}          # type -> set(id)
dups = {}         # type -> list of duplicated ids
format_bad = {}   # type -> list of (id, expected prefix)
all_id_owner = collections.defaultdict(list)  # id -> [(type,count)]
# 保留每个对象的引用字段（只保留必要字段，避免 37MB 全量驻留）
refs = collections.defaultdict(list)  # (src_type, field, target_type) -> list of (src_id, value)

def collect(stream, name):
    s = set(); dup = []
    for o in stream:
        i = o.get(ID_FIELD.get(name, "id"))
        if i is None: continue
        if i in s: dup.append(i)
        s.add(i)
        all_id_owner[i].append(name)
        yield o, i
    ids[name] = s; dups[name] = dup

def add_ref(src_type, src_id, field, target_type, value):
    if value is None: return
    vals = value if isinstance(value, list) else [value]
    for v in vals:
        if isinstance(v, str) and v:
            refs[(src_type, field, target_type)].append((src_id, v))

def main():
    # 逐类扫描，收集 ID 与引用（流式，单对象驻留）
    for name in ARR:
        p = os.path.join(KD, name + ".json")
        def gen(name=name):
            for o in stream_array(p):
                oid = o.get(ID_FIELD.get(name, "id"))
                if oid is None: continue
                if name == "documents":
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "entities":
                    add_ref(name, oid, "document_ids", "documents", o.get("document_ids"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "pages":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "entity_id", "entities", o.get("entity_id"))
                    add_ref(name, oid, "parent_page_id", "pages", o.get("parent_page_id"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "fields":
                    for f, t in [("document_id","documents"),("entity_id","entities"),("page_id","pages")]:
                        add_ref(name, oid, f, t, o.get(f))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "controls":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "field_id", "fields", o.get("field_id"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "rules":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "applies_to", "entities", o.get("applies_to"))
                    add_ref(name, oid, "open_question_ids", "open-questions", o.get("open_question_ids"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "actions":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "workflows":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "entity_id", "entities", o.get("entity_id"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "dependencies":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "source_id", "MIXED", o.get("source_id"))
                    add_ref(name, oid, "target_id", "MIXED", o.get("target_id"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "scenarios":
                    add_ref(name, oid, "rule_ids", "rules", o.get("rule_ids"))
                    add_ref(name, oid, "document_ids", "documents", o.get("document_ids"))
                    add_ref(name, oid, "source_refs.document_id", "documents",
                            [r.get("document_id") for r in o.get("source_refs", []) if isinstance(r, dict)])
                elif name == "existing-cases":
                    add_ref(name, oid, "document_id", "documents", o.get("document_id"))
                    add_ref(name, oid, "rule_ids", "rules", o.get("rule_ids"))
                elif name == "open-questions":
                    add_ref(name, oid, "document_ids", "documents", o.get("document_ids"))
                yield o
        # consume generator via collect
        for _ in collect(gen(), name): pass

    PREFIX = {"documents":"DOC-","entities":"ENT-","pages":"PAGE-","fields":"FLD-","controls":"CTL-",
              "rules":"RULE-","actions":"ACT-","workflows":"WF-","dependencies":"DEP-",
              "scenarios":"SCN-","existing-cases":"TC-","open-questions":"OQ-"}
    for name in ARR:
        bad = [(i, PREFIX[name]) for i in ids[name] if not i.startswith(PREFIX[name])]
        format_bad[name] = bad[:10]
        format_bad[name+"_count"] = len(bad)

    print("=== ID 唯一性 / 格式 ===")
    for name in ARR:
        print(name, "ids=", len(ids[name]), "dups=", len(dups[name]),
              "format_bad=", format_bad.get(name+"_count"), "samples=", (dups[name][:3] or format_bad[name][:3]))
    cross = {i: owners for i, owners in all_id_owner.items() if len(set(owners)) > 1}
    print("CROSS_TYPE_ID_CONFLICTS", len(cross), list(cross.items())[:5])

    print("\n=== 错误引用（目标 ID 不存在）===")
    ref_report = {}
    for (st, field, tt), pairs in sorted(refs.items()):
        if tt == "MIXED":
            # source_id / target_id 可能引用 Document / Entity / Field / 业务码，单独统计
            union = set().union(*[ids[t] for t in ARR])
            missing = [(s, v) for s, v in pairs if v not in union]
            kind = "MIXED"
        else:
            target = ids.get(tt, set())
            missing = [(s, v) for s, v in pairs if v not in target]
            kind = "STRICT"
        ref_report[f"{st}.{field}->{tt}"] = {
            "kind": kind, "total": len(pairs), "missing": len(missing),
            "missing_rate": round(len(missing)/len(pairs), 4) if pairs else 0,
            "samples": [{"src": s, "value": v} for s, v in missing[:5]],
        }
        print(f"  {st}.{field} -> {tt}: total={len(pairs)} missing={len(missing)} ({ref_report[f'{st}.{field}->{tt}']['missing_rate']}) kind={kind}")

    # 跨命名空间的 rule_ids（existing-cases 用 F-xxx 而非 RULE-xxx）
    ec_rule_pattern = collections.Counter()
    for o in stream_array(os.path.join(KD, "existing-cases.json")):
        for r in o.get("rule_ids", []) or []:
            ec_rule_pattern["RULE-*" if r.startswith("RULE-") else "other"] += 1
    # 统计 existing-cases 的 rule_ids 取值样例
    ec_rule_samples = []
    for o in stream_array(os.path.join(KD, "existing-cases.json")):
        if o.get("rule_ids"):
            ec_rule_samples.extend(o["rule_ids"][:3])
        if len(ec_rule_samples) >= 10: break
    print("EXISTING_CASES_RULE_ID_PATTERN", dict(ec_rule_pattern), "samples=", ec_rule_samples[:10])

    print("\n=== 孤立节点（无入边且无出边）===")
    incoming = collections.defaultdict(set)
    outgoing = collections.defaultdict(set)
    strict_edges = [(st, field, tt) for (st, field, tt) in refs if tt != "MIXED"]
    for st, field, tt in strict_edges:
        for src, val in refs[(st, field, tt)]:
            outgoing[(st, src)].add((tt, val))
            if val in ids.get(tt, set()):
                incoming[(tt, val)].add((st, src))
    orphan = {}
    for name in ARR:
        orph = [i for i in ids[name] if not incoming.get((name, i)) and not outgoing.get((name, i))]
        no_in = [i for i in ids[name] if not incoming.get((name, i))]
        no_out = [i for i in ids[name] if not outgoing.get((name, i))]
        orphan[name] = {"total": len(ids[name]), "isolated_both": len(orph), "no_in": len(no_in), "no_out": len(no_out),
                        "samples": orph[:5]}
        print(f"  {name}: total={len(ids[name])} isolated={len(orph)} no_in={len(no_in)} no_out={len(no_out)} samples={orph[:3]}")

    result = {
        "id_counts": {n: len(ids[n]) for n in ARR},
        "id_duplicates": {n: dups[n][:20] for n in ARR},
        "id_duplicate_counts": {n: len(dups[n]) for n in ARR},
        "format_bad": format_bad,
        "cross_type_conflicts": dict(list(cross.items())[:20]),
        "cross_type_conflict_count": len(cross),
        "refs": ref_report,
        "existing_cases_rule_id_pattern": dict(ec_rule_pattern),
        "orphans": orphan,
    }
    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("OUTPUT", OUT)

if __name__ == "__main__":
    main()
