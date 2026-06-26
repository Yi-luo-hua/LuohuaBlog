import os, sqlite3, json, shutil, time, glob

CODEX = r"C:\Users\lenovo\.codex"
DB = os.path.join(CODEX, "state_5.sqlite")
TARGET = "volces"  # current model_provider in config.toml
ts = time.strftime("%Y%m%d-%H%M%S")
bk = os.path.join(CODEX, "backups", f"volces-history-fix-{ts}")
os.makedirs(bk, exist_ok=True)

# 1. Backup sqlite files
for f in [DB, DB + "-wal", DB + "-shm"]:
    if os.path.exists(f):
        shutil.copy2(f, os.path.join(bk, os.path.basename(f)))

con = sqlite3.connect(DB)
cur = con.cursor()

# 2. Find unarchived threads whose model_provider != volces
rows = cur.execute(
    "SELECT id, rollout_path, model_provider, cwd FROM threads "
    "WHERE archived = 0 AND model_provider != ?",
    (TARGET,)
).fetchall()

print(f"Unarchived threads to migrate: {len(rows)}")
by_old = {}
jsonl_to_fix = []
for tid, rp, mp, cwd in rows:
    by_old[mp] = by_old.get(mp, 0) + 1
    if rp and os.path.exists(rp):
        jsonl_to_fix.append((tid, rp, mp))

print("By old provider:", by_old)
print("JSONL files to fix:", len(jsonl_to_fix))

# 3. Update JSONL session_meta.model_provider (only first session_meta line per file)
jsonl_changed = 0
for tid, rp, old_mp in jsonl_to_fix:
    with open(rp, "r", encoding="utf-8") as fh:
        lines = fh.readlines()
    changed = False
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        try:
            obj = json.loads(s)
        except Exception:
            continue
        if obj.get("type") == "session_meta" and isinstance(obj.get("payload"), dict):
            if obj["payload"].get("model_provider") != TARGET:
                # backup original jsonl
                shutil.copy2(rp, os.path.join(bk, os.path.basename(rp) + ".orig"))
                obj["payload"]["model_provider"] = TARGET
                lines[i] = json.dumps(obj, ensure_ascii=False) + "\n"
                changed = True
            break  # only first session_meta
    if changed:
        with open(rp, "w", encoding="utf-8", newline="") as fh:
            fh.writelines(lines)
        jsonl_changed += 1

print(f"JSONL files actually changed: {jsonl_changed}")

# 4. Update SQLite threads.model_provider
cur.execute(
    "UPDATE threads SET model_provider = ? WHERE archived = 0 AND model_provider != ?",
    (TARGET, TARGET)
)
con.commit()
print(f"SQLite rows updated: {cur.rowcount}")

# 5. Verify
print("\n=== After migration (unarchived) ===")
for mp, cnt in cur.execute(
    "SELECT model_provider, COUNT(*) FROM threads WHERE archived = 0 GROUP BY model_provider ORDER BY 2 DESC"
).fetchall():
    print(f"  {mp}: {cnt}")

print("\n=== D:\\taozhiyy-monorepo (unarchived) ===")
for mp, cnt in cur.execute(
    "SELECT model_provider, COUNT(*) FROM threads WHERE archived = 0 AND cwd LIKE '%taozhiyy-monorepo%' GROUP BY model_provider"
).fetchall():
    print(f"  {mp}: {cnt}")

con.close()
print(f"\nBackup dir: {bk}")
