import sqlite3, json, os, shutil, re
from datetime import datetime

CODEX = r"C:\Users\lenovo\.codex"
DB = os.path.join(CODEX, "state_5.sqlite")
TARGET = "volces"

ts = datetime.now().strftime("%Y%m%d-%H%M%S")
bk = os.path.join(CODEX, "backups", f"volces-session-meta-fix-{ts}")
os.makedirs(bk, exist_ok=True)
for f in [DB, DB + "-wal", DB + "-shm"]:
    if os.path.exists(f):
        shutil.copy2(f, os.path.join(bk, os.path.basename(f)))
print("BACKUP_DIR:", bk)

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
cur = con.cursor()

# Find unarchived threads whose model_provider is not volces
rows = cur.execute(
    "SELECT id, rollout_path, model_provider, cwd, title, archived FROM threads "
    "WHERE archived = 0 AND model_provider != ?",
    (TARGET,),
).fetchall()
print("THREADS_TO_FIX:", len(rows))

jsonl_changed = 0
sqlite_changed = 0
for r in rows:
    rp = r["rollout_path"]
    old = r["model_provider"]
    if rp and os.path.exists(rp):
        with open(rp, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
        changed = False
        for i, line in enumerate(lines):
            if '"session_meta"' in line and '"model_provider"' in line:
                # Replace the model_provider value in this JSON line
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                payload = obj.get("payload", {})
                if payload.get("model_provider") and payload["model_provider"] != TARGET:
                    # back up jsonl once
                    shutil.copy2(rp, os.path.join(bk, os.path.basename(rp)))
                    payload["model_provider"] = TARGET
                    obj["payload"] = payload
                    lines[i] = json.dumps(obj, ensure_ascii=False) + "\n"
                    changed = True
        if changed:
            with open(rp, "w", encoding="utf-8") as fh:
                fh.writelines(lines)
            jsonl_changed += 1
    # update sqlite
    cur.execute(
        "UPDATE threads SET model_provider = ? WHERE id = ?",
        (TARGET, r["id"]),
    )
    sqlite_changed += 1
    print(f"  {old} -> {TARGET}: {r['title'][:40] if r['title'] else '(no title)'} | {r['cwd']}")

con.commit()

# Verify
rows2 = cur.execute(
    "SELECT model_provider, COUNT(*) c FROM threads WHERE archived=0 GROUP BY model_provider ORDER BY c DESC"
).fetchall()
print("AFTER (unarchived by provider):")
for r2 in rows2:
    print(f"  {r2['model_provider']}: {r2['c']}")

cwd_rows = cur.execute(
    "SELECT model_provider, COUNT(*) c FROM threads WHERE archived=0 AND cwd LIKE '%taozhiyy%' GROUP BY model_provider"
).fetchall()
print("AFTER (taozhiyy unarchived by provider):")
for r2 in cwd_rows:
    print(f"  {r2['model_provider']}: {r2['c']}")

con.close()
print("JSONL_CHANGED:", jsonl_changed)
print("SQLITE_CHANGED:", sqlite_changed)
print("DONE")
