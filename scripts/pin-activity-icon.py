#!/usr/bin/env python3
"""Run this script while VS Code is CLOSED to pin the MCP AI Studio icon to the activity bar."""
import sqlite3, json, sys

db_path = "/Users/harishkaparwan/Library/Application Support/Code/User/globalStorage/state.vscdb"

conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT value FROM ItemTable WHERE key = 'workbench.activity.pinnedViewlets2'")
row = cur.fetchone()
if not row:
    print("ERROR: Could not find pinnedViewlets2 key. Make sure VS Code is closed.")
    sys.exit(1)

items = json.loads(row[0])

mcp_id = "workbench.view.extension.mcpWorkbench"
if any(i["id"] == mcp_id for i in items):
    for i in items:
        if i["id"] == mcp_id:
            i["pinned"] = True
            i["visible"] = True
    print("Updated existing mcpWorkbench entry to pinned=True")
else:
    # Insert after Extensions (order 4) → order 5
    items.append({"id": mcp_id, "pinned": True, "visible": True, "order": 5})
    print("Added mcpWorkbench to pinned activity bar items")

cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'workbench.activity.pinnedViewlets2'", (json.dumps(items),))
conn.commit()
conn.close()
print("Done. You can now reopen VS Code.")
