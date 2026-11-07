# -*- coding: utf-8 -*-
"""Read-only: dump exact line windows from PRD originals and check whether
generated rule descriptions appear verbatim in the source near reported line.
Also scan purchase-chain docs for relationship keywords.
"""
import os, json, re

PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
TC  = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
OUT = r"D:/AIProject/ERP-AI-Testing/probe"

def readlines(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read().split("\n")

def dump(L, path, ranges, label):
    lines = readlines(path)
    L.append("")
    L.append("=" * 100)
    L.append("FILE " + label)
    L.append("PATH " + path)
    L.append("TOTAL_LINES " + str(len(lines)))
    for (a, b) in ranges:
        L.append("-" * 90)
        L.append(f"--- lines {a}..{b} ---")
        for i in range(max(0, a - 1), min(len(lines), b)):
            L.append(f"{i+1:5d}| {lines[i]}")

def find_verbatim(L, path, needle, near=None, label=""):
    lines = readlines(path)
    hits = [i + 1 for i, ln in enumerate(lines) if needle and needle in ln]
    L.append(f"VERBATIM_CHECK {label}: needle_len={len(needle)} hits={hits[:12]} total={len(hits)}")
    if near:
        L.append(f"  reported_line={near} near_hits={[h for h in hits if abs(h-near)<=12]}")

L = []
sample = json.load(open(os.path.join(OUT, "acc_rule_sample.json"), "r", encoding="utf-8"))

# map rule -> (path, windows, verbatim needle)
targets = {
 "RULE-CB7323C0CD49": (os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"), [(2245, 2270)]),
 "RULE-BD4E7E4BDC75": (os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"), [(850, 880)]),
 "RULE-FD086AEB558E": (os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"), [(850, 880)]),
 "RULE-0D46D8D5D4B4": (os.path.join(PRD, "采购退货单/采购退货单PRD.v1.11.md"), [(200, 225)]),
 "RULE-B015B0F41E60": (os.path.join(PRD, "询价单/询价单PRD.v1.8.md"), [(1412, 1432)]),
 "RULE-FDB3C16FE60D": (os.path.join(PRD, "询价单/询价单PRD.v1.8.md"), [(238, 268)]),
 "RULE-ADB1BDA8BC97": (os.path.join(PRD, "询价单/询价单PRD.v1.8.md"), [(334, 356)]),
 "RULE-513D09A47C42": (os.path.join(TC, "采购域/到货单验收/DOC420406209235615745_到货单验收_V1.4.md"), [(1056, 1078)]),
 "RULE-9E60EC5D54FB": (os.path.join(TC, "采购域/采购订单/DOC415646892677804032_采购订单_V1.13.md"), [(1616, 1640)]),
 "RULE-624B93CFA158": (os.path.join(TC, "采购域/采购入库单/DOC482078_采购入库单_V1.19.md"), [(1008, 1035)]),
 "RULE-FDDC09830838": (os.path.join(TC, "采购域/采购入库单/DOC482078_采购入库单_V1.19.md"), [(865, 890)]),
 "RULE-1B6407D2A92E": (os.path.join(TC, "采购域/采购入库单/DOC482078_采购入库单_V1.19.md"), [(1925, 1945)]),
 "RULE-4916EB642CCE": (os.path.join(TC, "采购域/采购到货单/DOC411256039758987264_采购到货单_V1.23.md"), [(1105, 1130)]),
 "RULE-42B6E8938F33": (os.path.join(TC, "采购域/采购到货单/DOC411256039758987264_采购到货单_V1.23.md"), [(1657, 1680)]),
 "RULE-2B0C20DD6E5A": (os.path.join(TC, "参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md"), [(288, 308)]),
 "RULE-830FBF25AFA6": (os.path.join(TC, "基础资料域/客户品号/DOC960059_客户品号_V1.3.md"), [(410, 430)]),
 "RULE-AB5CE2F245E6": (os.path.join(TC, "基础资料域/品号采购信息/DOC408689616771710976_品号采购信息_V1.8.md"), [(826, 846)]),
 "RULE-407BEB64E9AC": (os.path.join(PRD, "采购退货出库单/采购退货出库单PRD.v1.24.md"), [(1538, 1560)]),
 "RULE-557FFF142C6A": (os.path.join(PRD, "采购退货出库单/采购退货出库单PRD.v1.24.md"), [(1128, 1148)]),
 "RULE-5102DB21ED32": (os.path.join(PRD, "采购退货出库单/_history/采购退货出库单PRD.v1.13.md"), [(1420, 1440)]),
}
for rid, (path, ranges) in targets.items():
    rec = next((s for s in sample if s["rule_id"] == rid), None)
    dump(L, path, ranges, f"for {rid} | {rec['name'] if rec else ''} | {rec['source_type'] if rec else ''}")
    if rec:
        desc = rec["description"]
        body = re.sub(r"^【[^】]*】", "", desc)
        find_verbatim(L, path, body[:40], rec["ref"].get("line_start"), rid + " body")
        find_verbatim(L, path, desc[:40], rec["ref"].get("line_start"), rid + " full-desc")

# ---- root-level scattered md ----
root_md = [
 "四单PRD-平台对接会议议程.md",
 "四单PRD-平台确认事项清单.md",
 "四单PRD-第2轮修订审查报告.md",
]
for name in root_md:
    p = os.path.join(PRD, name)
    if os.path.exists(p):
        ls = readlines(p)
        L.append("")
        L.append("=" * 100)
        L.append("ROOT_LEVEL_MD " + name + " lines=" + str(len(ls)))
        for i, ln in enumerate(ls[:40]):
            L.append(f"{i+1:5d}| {ln}")

# ---- platform JSON ----
pj = os.path.join(PRD, "采购取价策略/_upload/采购取价策略-v1.6.prd_spec.json")
if os.path.exists(pj):
    d = json.load(open(pj, "r", encoding="utf-8"))
    L.append("")
    L.append("=" * 100)
    L.append("PLATFORM_JSON " + pj)
    L.append("top keys " + str(list(d.keys())[:20] if isinstance(d, dict) else type(d)))
    def brief(x, depth=0):
        if isinstance(x, dict):
            return {k: brief(v, depth+1) for k, v in list(x.items())[:12]} if depth < 3 else "{...}"
        if isinstance(x, list):
            return [brief(v, depth+1) for v in x[:2]] + (["..."] if len(x) > 2 else [])
        if isinstance(x, str):
            return x[:160]
        return x
    L.append(json.dumps(brief(d), ensure_ascii=False, indent=1)[:4000])

# ---- verbatim check across all 40 sample rules ----
L.append("")
L.append("=" * 100)
L.append("ALL_SAMPLE_VERBATIM_CHECK (does generated description body appear verbatim in source file?)")
res = {"body_found": 0, "body_not_found": 0, "full_desc_found": 0, "full_desc_not_found": 0}
for s in sample:
    path = s["doc_file_path"]
    if not path or not os.path.exists(path):
        continue
    ls = readlines(path)
    desc = s["description"] or ""
    body = re.sub(r"^【[^】]*】", "", desc)
    needle = body[:30]
    fullneedle = desc[:30]
    bf = any(needle in ln for ln in ls) if needle else False
    ff = any(fullneedle in ln for ln in ls) if fullneedle else False
    res["body_found" if bf else "body_not_found"] += 1
    res["full_desc_found" if ff else "full_desc_not_found"] += 1
    L.append(f"{s['rule_id']} | {s['source_type']:13s} | body_verbatim={bf} | full_desc_verbatim={ff} | {s['name']}")
L.append("SUMMARY " + json.dumps(res, ensure_ascii=False))

with open(os.path.join(OUT, "acc_originals.out.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("written", len(L), "lines")
print(json.dumps(res, ensure_ascii=False))
