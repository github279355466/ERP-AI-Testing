#!/usr/bin/env python3
# C 项取证 1：实际执行 JSON Schema 校验 + 基于 src/prd/types.ts 的全量结构校验（流式）
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_stream import stream_array

KD = "artifacts/knowledge"
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "c1_schema_validate.json")

# ---------- 极简 JSON Schema draft 2020-12 子集校验器（不安装依赖） ----------
class MiniSchema:
    def __init__(self, root):
        self.root = root
    def resolve(self, ref, root):
        if not ref.startswith("#/"): return {}
        node = root
        for part in ref[2:].split("/"):
            node = node.get(part.replace("~1", "/").replace("~0", "~"), {})
        return node
    def validate(self, inst, schema, root, path="$"):
        errs = []
        if "$ref" in schema:
            return self.validate(inst, self.resolve(schema["$ref"], root), root, path)
        t = schema.get("type")
        if t is not None:
            types = t if isinstance(t, list) else [t]
            def ok(v, tt):
                return {"object": isinstance(v, dict), "array": isinstance(v, list),
                        "string": isinstance(v, str), "number": isinstance(v, (int, float)) and not isinstance(v, bool),
                        "integer": isinstance(v, int) and not isinstance(v, bool),
                        "boolean": isinstance(v, bool), "null": v is None}.get(tt, True)
            if not any(ok(inst, tt) for tt in types):
                errs.append((path, "TYPE", f"期望 {types}，实际 {type(inst).__name__}"))
                return errs
        if "const" in schema and inst != schema["const"]:
            errs.append((path, "CONST", f"期望常量 {schema['const']!r}，实际 {inst!r}"))
        if "enum" in schema and inst not in schema["enum"]:
            errs.append((path, "ENUM", f"值 {inst!r} 不在枚举 {schema['enum']}"))
        if isinstance(inst, str) and "minLength" in schema and len(inst) < schema["minLength"]:
            errs.append((path, "MINLENGTH", f"长度 {len(inst)} < {schema['minLength']}"))
        if isinstance(inst, dict):
            for req in schema.get("required", []):
                if req not in inst:
                    errs.append((path, "REQUIRED", f"缺少必填字段 {req}"))
            props = schema.get("properties", {})
            if schema.get("additionalProperties") is False:
                for k in inst:
                    if k not in props:
                        errs.append((path, "ADDITIONAL", f"未允许字段 {k}"))
            for k, sub in props.items():
                if k in inst:
                    errs.extend(self.validate(inst[k], sub, root, f"{path}.{k}"))
        if isinstance(inst, list) and "items" in schema:
            for i, item in enumerate(inst):
                errs.extend(self.validate(item, schema["items"], root, f"{path}[{i}]"))
        return errs

# ---------- 基于 src/prd/types.ts 的结构规约 ----------
CONF = {"CONFIRMED","DERIVED","AMBIGUOUS","CONFLICTED","MISSING"}
SRC = {"PRD_EXPLICIT","PRD_DERIVED","PLATFORM_SERVICE","UI_OBSERVED","USER_CONFIRMED","PENDING"}
OBJ_ENUM = {
 "documents":("Document",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "entities":("Entity",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "pages":("Page",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "fields":("Field",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "controls":("Control",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "rules":("Rule",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "actions":("Action",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "workflows":("Workflow",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "dependencies":("Dependency",{"ACTIVE","DRAFT","MISSING_SOURCE"}),
 "scenarios":("Scenario",{"DRAFT","REVIEW_REQUIRED","APPROVED","REJECTED","EXECUTABLE"}),
}
BASE_REQ = ["id","object_type","name","module","status","source_refs","created_by_parser_version","updated_at"]
EXTRA_REQ = {
 "documents": ["file_path","relative_path","file_name","sha256","size_bytes","modified_at","title","doc_version","doc_date",
               "doc_status","prd_type","business_object","biz_model_no","application","entity_names","section_count",
               "table_count","last_scan_status","parser","source_role","job_directory","is_latest"],
 "entities": ["entity_no","label","parent_entity_no","document_ids","field_count","page_count","rule_count"],
 "pages": ["page_type","entity_id","document_id","parent_page_id","menu_path"],
 "fields": ["field_no","label","entity_id","entity_no","entity_label","page_id","document_id","control_type","required",
            "readonly","hidden","disabled","options","confidence","source_type","data_type","length","precision"],
 "controls": ["control_type","field_id","document_id","evidence_text"],
 "rules": ["description","rule_type","source_type","confidence","applies_to","field_no","document_id"],
 "actions": ["action_name","scope","apis","document_id"],
 "workflows": ["document_id","entity_id","steps"],
 "dependencies": ["source_id","target_id","target_ref","relation_type","source_type","confidence","document_id"],
 "scenarios": ["title","scenario_type","status","automation_feasibility","preconditions","steps","assertions",
               "rule_ids","document_ids","review_required","origin"],
 "existing-cases": ["case_id","package","module","title","category","priority","rule_ids","needs_confirm","assertion_types","document_id"],
 "open-questions": ["id","object_type","question","category","severity","document_ids","evidence","impact","suggested_owner","status","created_at"],
}
ENUM_FIELDS = {
 "rules": {"source_type": SRC, "confidence": CONF,
           "rule_type": {"REQUIRED","READONLY","HIDDEN","DISABLED","DEFAULT_VALUE","LOOKUP","VALIDATION","UNIQUENESS","FORMAT","PRECISION","CALCULATION","LINKAGE","STATE_TRANSITION","PERMISSION","WORKFLOW","API_CONTRACT","UNKNOWN"}},
 "fields": {"confidence": CONF, "source_type": SRC,
            "control_type": {"TEXT_INPUT","NUMBER_INPUT","DATE_PICKER","DROPDOWN","LOOKUP","TREE_SELECT","CHECKBOX","RADIO","GRID","BUTTON","TAB","MODAL","UNKNOWN"}},
 "controls": {"control_type": {"TEXT_INPUT","NUMBER_INPUT","DATE_PICKER","DROPDOWN","LOOKUP","TREE_SELECT","CHECKBOX","RADIO","GRID","BUTTON","TAB","MODAL","UNKNOWN"}},
 "pages": {"page_type": {"LIST","FORM","TAB","MODAL","UNKNOWN"}},
 "actions": {"scope": {"HEADER","DETAIL","LIST","UNKNOWN"}},
 "dependencies": {"source_type": SRC, "confidence": CONF,
                  "relation_type": {"USES_MASTER_DATA","DERIVED_FROM","GENERATES","REFERENCES","CONSUMES","RETURNS_TO","STATUS_TRANSITION","FIELD_DEPENDENCY","CANDIDATE_LINK"}},
 "scenarios": {"status": {"DRAFT","REVIEW_REQUIRED","APPROVED","REJECTED","EXECUTABLE"},
               "automation_feasibility": {"UI_READY","NEEDS_UI_EXPLORATION","NEEDS_CONFIRMATION","NOT_UI_OBSERVABLE"},
               "origin": {"GENERATED","EXISTING_CASE"}},
 "open-questions": {"category": {"VERSION_CONFLICT","RULE_CONFLICT","MISSING_EVIDENCE","MISSING_DEFINITION","AMBIGUOUS_RULE","INCOMPLETE_STATE_MACHINE","BROKEN_FLOW","UNSUPPORTED_FORMAT","PARSE_ERROR","SCENARIO_GAP"},
                    "severity": {"HIGH","MEDIUM","LOW"}, "status": {"OPEN","CLOSED"}},
 "documents": {"last_scan_status": {"NEW","MODIFIED","UNCHANGED","SOURCE_MISSING"},
               "source_role": {"PRD","TEST_CASE_LIBRARY"}},
}
TYPE_FIELDS = {
 "documents": {"sha256": str, "size_bytes": int, "section_count": int, "table_count": int, "is_latest": bool, "entity_names": list},
 "entities": {"field_count": int, "page_count": int, "rule_count": int, "document_ids": list},
 "pages": {"menu_path": list},
 "fields": {"required": bool, "readonly": bool, "hidden": bool, "disabled": bool, "options": list},
 "rules": {"applies_to": list, "conditions": list},
 "actions": {"apis": list},
 "workflows": {"steps": list},
 "scenarios": {"preconditions": list, "steps": list, "assertions": list, "rule_ids": list, "document_ids": list, "review_required": bool},
 "existing-cases": ["rule_ids", "field_nos", "assertion_types"],
 "open-questions": {"document_ids": list, "evidence": list},
}

def structural(name, obj, idx):
    errs = []
    if not isinstance(obj, dict):
        return [(idx, "NOT_OBJECT", type(obj).__name__)]
    if name in OBJ_ENUM:
        req = BASE_REQ + EXTRA_REQ.get(name, [])
        for k in req:
            if k not in obj: errs.append((idx, "MISSING", k))
        ot, st = OBJ_ENUM[name]
        if obj.get("object_type") != ot: errs.append((idx, "OBJECT_TYPE", f"{obj.get('object_type')!r} != {ot!r}"))
        if obj.get("status") not in st: errs.append((idx, "STATUS_ENUM", f"{obj.get('status')!r}"))
    elif name in ("existing-cases", "open-questions"):
        for k in EXTRA_REQ.get(name, []):
            if k not in obj: errs.append((idx, "MISSING", k))
        if name == "open-questions" and obj.get("object_type") != "OpenQuestion":
            errs.append((idx, "OBJECT_TYPE", f"{obj.get('object_type')!r}"))
    for fld, allowed in ENUM_FIELDS.get(name, {}).items():
        if fld in obj and obj[fld] not in allowed:
            errs.append((idx, "ENUM", f"{fld}={obj[fld]!r}"))
    tf = TYPE_FIELDS.get(name, {})
    if isinstance(tf, list):
        for k in tf:
            if k in obj and obj[k] is not None and not isinstance(obj[k], list):
                errs.append((idx, "TYPE", f"{k}={type(obj[k]).__name__}"))
    else:
        for k, typ in tf.items():
            if k in obj and obj[k] is not None and not isinstance(obj[k], typ):
                errs.append((idx, "TYPE", f"{k}={type(obj[k]).__name__} != {typ.__name__}"))
    return errs

def main():
    result = {}
    # 1) 正式 JSON Schema 校验
    schemas = {
      "rule": "docs/plan/Athena-ERP-Test-Development-Kit/schemas/rule.schema.json",
      "scenario": "docs/plan/Athena-ERP-Test-Development-Kit/schemas/scenario.schema.json",
      "test-cases-v2": "artifacts/session-outputs/test-cases.v2.schema.json",
    }
    result["schema_files"] = {k: {"path": v, "exists": os.path.exists(v)} for k, v in schemas.items()}
    for key, target in [("rule", "rules.json"), ("scenario", "scenarios.json")]:
        sp = schemas[key]
        if not os.path.exists(sp): continue
        sch = json.load(open(sp, encoding="utf-8"))
        validator = MiniSchema(sch)
        err_counts = collections.Counter(); samples = collections.defaultdict(list); n = 0
        for i, obj in enumerate(stream_array(os.path.join(KD, target))):
            n += 1
            errs = validator.validate(obj, sch, sch, f"${i}")
            for path, code, msg in errs:
                err_counts[code] += 1
                if len(samples[code]) < 3: samples[code].append({"index": i, "id": obj.get("id"), "path": path, "msg": msg})
        result[f"jsonschema_{key}"] = {"schema": sp, "target": target, "items": n,
                                       "total_errors": sum(err_counts.values()),
                                       "errors_by_code": dict(err_counts), "samples": dict(samples)}
        print(f"JSONSCHEMA {key}: items={n} errors={sum(err_counts.values())} by={dict(err_counts)}")

    # 2) 全量结构校验
    arr_files = ["documents","entities","pages","fields","controls","rules","actions","workflows",
                 "dependencies","scenarios","existing-cases","open-questions"]
    struct = {}
    for name in arr_files:
        p = os.path.join(KD, name + ".json")
        err_counts = collections.Counter(); samples = collections.defaultdict(list); n = 0
        for i, obj in enumerate(stream_array(p)):
            n += 1
            for idx, code, msg in structural(name, obj, i):
                err_counts[code] += 1
                if len(samples[code]) < 3: samples[code].append({"index": i, "id": obj.get("id") if isinstance(obj, dict) else None, "msg": msg})
        struct[name] = {"items": n, "total_errors": sum(err_counts.values()),
                        "errors_by_code": dict(err_counts), "samples": dict(samples)}
        print(f"STRUCT {name}: items={n} errors={sum(err_counts.values())} by={dict(err_counts)}")
    result["structural"] = struct

    # 3) summary.json counts 核对
    summary = json.load(open(os.path.join(KD, "summary.json"), encoding="utf-8"))
    counts = {name: struct[name]["items"] for name in arr_files}
    docs_roles = collections.Counter()
    for d in stream_array(os.path.join(KD, "documents.json")):
        docs_roles[d.get("source_role")] += 1
    actual_derived = {
        "documents": counts["documents"], "prd_documents": docs_roles.get("PRD", 0),
        "test_case_documents": docs_roles.get("TEST_CASE_LIBRARY", 0),
        "entities": counts["entities"], "pages": counts["pages"], "fields": counts["fields"],
        "controls": counts["controls"], "rules": counts["rules"], "actions": counts["actions"],
        "workflows": counts["workflows"], "dependencies": counts["dependencies"],
        "scenarios": counts["scenarios"], "existing_cases": counts["existing-cases"],
        "open_questions": counts["open-questions"],
    }
    rows = []
    for k, target in summary["counts"].items():
        actual = actual_derived.get(k, "N/A")
        rows.append({"key": k, "target": target, "actual": actual,
                     "match": (actual == target) if actual != "N/A" else None})
    result["summary_counts"] = rows
    for r in rows: print("SUMMARY", r["key"], "target=", r["target"], "actual=", r["actual"], "match=", r["match"])

    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("OUTPUT", OUT)

if __name__ == "__main__":
    main()
