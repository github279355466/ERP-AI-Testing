import sqlite3, shutil, os, sys

src = r"C:\Users\Administrator\AppData\Local\ms-playwright\mcp-chrome-bd3acbc\Default\Network\Cookies"
dst = os.path.join(os.environ["TEMP"], "ck_probe.db")
shutil.copyfile(src, dst)
con = sqlite3.connect(dst)
for row in con.execute("select host_key, name, length(encrypted_value), expires_utc from cookies order by host_key"):
    print(row)
print("total", con.execute("select count(*) from cookies").fetchone()[0])
