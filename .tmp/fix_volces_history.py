CODEX = r"C:\Users\lenovo\.codex"
import sqlite3, shutil, os, json, time

DB = os.path.join(CODEX, "state_5.sqlite")
ts = time.strftime("%Y%m%d-%H%M%S")
bk = os.path.join(CODEX, "backups", f"volces-history-fix-{ts}")
os.makedirs(bk, exist_ok=True)

# 1) backup sqlite (+ wal/shm)
for f in [DB, DB + "-wal", DB + "-shm"]:
    if os.path.exists(f):
        shutil.copy2(f, os.path.join(bk, os.path.basename(f)))

con = sqlite3.connect(DB)
cur = con.cursor()

# 2) find unarchived threads whose model_provider != 'volces'
rows = cur.execute(
    "SELECT id, rollout_path, model_provider, cwd, title FROM threads "
    "WHERE archived = 0 AND model_provider != 'volces'"
).fetchall()
print(f"unarchived non-volces threads: {len(rows)}")

jsonl_changed = 0
sqlite_changed = 0
for tid, rollout_path, old_mp, cwd, title in rows:
    # 2a) rewrite session_meta.model_provider in the JSONL
    if rollout_path and os.path.exists(rollout_path):
        # backup jsonl
        shutil.copy2(rollout_path, os.path.join(bk, os.path.basename(rollout_path)))
        out_lines = []
        file_changed = False
        with open(rollout_path, "r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    obj = json.loads(line)
                except Exception:
                    out_lines.append(line)
                    continue
                if obj.get("type") == "session_meta":
                    p = obj.get("payload", {})
                    if p.get("model_provider") != "volces":
                        p["model_provider"] = "volces"
                        obj["payload"] = p
                        file_changed = True
                out_lines.append(json.dumps(obj, ensure_ascii=False))
        if file_changed:
            with open(rollout_path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(out_lines) + "\n")
            jsonl_changed += 1
    # 2b) update sqlite
    cur.execute(
        "UPDATE threads SET model_provider = 'volces' WHERE id = ?", (tid,)
    )
    sqlite_changed += 1

con.commit()

# 3) report
print(f"jsonl files rewritten: {jsonl_changed}")
print(f"sqlite rows updated: {sqlite_changed}")
print(f"backup dir: {bk}")

# 4) verify
left = cur.execute(
    "SELECT model_provider, COUNT(*) FROM threads WHERE archived = 0 GROUP BY model_provider"
).fetchall()
print("unarchived by model_provider after fix:", left)
cur2 = con.cursor()
proj = cur2.execute(
    "SELECT COUNT(*) FROM threads WHERE archived = 0 AND cwd LIKE '%taozhiyy-monorepo%'"
).fetchone()[0]
print(f"unarchived in taozhiyy-monorepo after fix: {proj}")
con.close()
