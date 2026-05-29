#!/bin/bash
# Fixes the MCP AI Studio icon in VS Code activity bar.
# Run this script from Terminal (not VS Code terminal).
# It will: quit VS Code → patch the state DB → reopen VS Code.

DB="$HOME/Library/Application Support/Code/User/globalStorage/state.vscdb"

echo "Quitting VS Code..."
osascript -e 'quit app "Visual Studio Code"' 2>/dev/null
# Wait until VS Code has fully exited (max 15 seconds)
for i in $(seq 1 15); do
  sleep 1
  if ! pgrep -x "Electron" > /dev/null 2>&1; then
    break
  fi
done
sleep 1  # extra buffer for DB flush

echo "Patching VS Code state database..."
python3 << 'PYEOF'
import sqlite3, json, sys

db_path = "/Users/harishkaparwan/Library/Application Support/Code/User/globalStorage/state.vscdb"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

MCP_ID = "workbench.view.extension.mcpWorkbench"

# 1. Fix placeholderViewlets — remove stale entry so VS Code regenerates it fresh
cur.execute("SELECT value FROM ItemTable WHERE key = 'workbench.activity.placeholderViewlets'")
row = cur.fetchone()
if row:
    items = json.loads(row[0])
    # Remove the stale mcpWorkbench entry entirely so VS Code recreates it from package.json
    items = [i for i in items if i['id'] != MCP_ID]
    cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'workbench.activity.placeholderViewlets'", (json.dumps(items),))
    print("Removed stale mcpWorkbench placeholder (VS Code will recreate from package.json)")

# 2. Fix pinnedViewlets2 — ensure mcpWorkbench is pinned
cur.execute("SELECT value FROM ItemTable WHERE key = 'workbench.activity.pinnedViewlets2'")
row = cur.fetchone()
if row:
    pinned = json.loads(row[0])
    if not any(i['id'] == MCP_ID for i in pinned):
        pinned.append({"id": MCP_ID, "pinned": True, "visible": True, "order": 5})
        print("Added mcpWorkbench to pinnedViewlets2")
    else:
        for i in pinned:
            if i['id'] == MCP_ID:
                i['pinned'] = True
                i['visible'] = True
        print("mcpWorkbench already in pinnedViewlets2, set pinned=True")
    cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'workbench.activity.pinnedViewlets2'", (json.dumps(pinned),))

conn.commit()
conn.close()
print("Database patched successfully.")
PYEOF

echo "Reopening VS Code..."
open -a "Visual Studio Code"
echo "Done! The MCP AI Studio icon should now appear in the activity bar."
