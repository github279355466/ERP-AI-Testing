#!/usr/bin/env python3
# A 项取证 1：递归枚举两个真实输入目录的文件系统事实（只读）
# 输出 probe/acceptance/a1_fs_inventory.json
import os, sys, json, hashlib, datetime, collections

PRD = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd"
CASES = r"C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/测试用例"
INCLUDE = {".md", ".markdown", ".txt", ".json"}
RESERVED = {".docx", ".xlsx", ".xls", ".pdf", ".png", ".jpg", ".jpeg"}
EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".cache"}

def walk(root):
    rows = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
        if rel_dir == ".":
            rel_dir = ""
        for d in list(dirnames):
            rows_dirnote = None
        for name in filenames:
            abs_path = os.path.join(dirpath, name)
            rel = os.path.relpath(abs_path, root).replace("\\", "/")
            parts = rel.split("/")
            hidden = any(p.startswith(".") for p in parts[:-1]) or name.startswith(".")
            excluded_hit = [p for p in parts[:-1] if p in EXCLUDE_DIRS]
            try:
                st = os.stat(abs_path)
                with open(abs_path, "rb") as f:
                    data = f.read()
                h = hashlib.sha256(data).hexdigest()
                size = st.st_size
                mtime = datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc).isoformat().replace("+00:00", "Z")
                err = None
            except Exception as e:
                h, size, mtime, err = "", 0, "", str(e)
            ext = os.path.splitext(name)[1].lower()
            rows.append({
                "root": "PRD" if root == PRD else "CASES",
                "relative_path": rel,
                "absolute_path": abs_path.replace("\\", "/"),
                "file_name": name,
                "extension": ext,
                "size_bytes": size,
                "modified_at": mtime,
                "sha256": h,
                "hidden": hidden,
                "excluded_dir_hits": excluded_hit,
                "supported": ext in INCLUDE,
                "reserved": ext in RESERVED,
                "top_dir": parts[0] if len(parts) > 1 else "(ROOT)",
                "depth": len(parts) - 1,
                "read_error": err,
            })
    return rows

def main():
    rows = walk(PRD) + walk(CASES)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "a1_fs_inventory.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   "prd_root": PRD, "cases_root": CASES, "files": rows}, f, ensure_ascii=False, indent=1)
    # 控制台摘要
    print("TOTAL_FILES", len(rows))
    print("BY_ROOT", dict(collections.Counter(r["root"] for r in rows)))
    print("BY_EXT", dict(collections.Counter(r["extension"] for r in rows).most_common()))
    print("SUPPORTED", sum(1 for r in rows if r["supported"]))
    print("RESERVED", sum(1 for r in rows if r["reserved"]))
    print("OTHER_EXT", dict(collections.Counter(r["extension"] for r in rows if not r["supported"] and not r["reserved"])))
    print("HIDDEN", sum(1 for r in rows if r["hidden"]))
    print("EXCLUDED_DIR_FILES", sum(1 for r in rows if r["excluded_dir_hits"]))
    print("TOP_DIRS_PRD", len(set(r["top_dir"] for r in rows if r["root"] == "PRD")))
    print("TOP_DIRS_CASES", len(set(r["top_dir"] for r in rows if r["root"] == "CASES")))
    print("BY_TOP_DIR", json.dumps(dict(collections.Counter(r["top_dir"] for r in rows).most_common()), ensure_ascii=False))
    print("AUX_SEGMENTS", json.dumps(dict(collections.Counter(
        p for r in rows for p in r["relative_path"].split("/")[:-1] if p.startswith("_")).most_common()), ensure_ascii=False))
    print("OUTPUT", out)

if __name__ == "__main__":
    main()
