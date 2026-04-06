---
name: session-delete
description: Delete one or more sessions with confirmation. Supports ID prefix matching. WHEN "delete session", "remove session", "clean up sessions".
compatibility: Requires Node.js 18+ and npx/tsx. Set $SESSIONS_HOME to the sessions project directory.
metadata:
  author: suye1234
  version: "0.1.0"
---

# Delete Session

Delete sessions from `$SESSIONS_HOME/data/`.

## Process

### Step 1: Identify target session(s)

If session IDs are provided:
- Treat as one or more session ID prefixes (comma-separated for multiple)
- Resolve each to the full UUID via CLI

If not provided:
- Run: `cd $SESSIONS_HOME && npx tsx src/cli.ts list`
- Show the list and ask the user which session(s) to delete

### Step 2: Confirm with user

Display the sessions to be deleted:

```
About to delete:
  - <id (first 8 chars)> — <title>
  - <id (first 8 chars)> — <title>

This action is irreversible. Proceed?
```

Wait for explicit confirmation. Do NOT proceed without it.

### Step 3: Delete

```bash
cd $SESSIONS_HOME
npx tsx src/cli.ts delete <full_id>
```

Repeat for each session.

### Step 4: Confirm result

```
Deleted <N> session(s):
  - <id (first 8 chars)> — <title>
```

## Notes

- Always confirm before deleting — no silent deletes
- Supports partial ID matching (same as other commands)
- Multiple IDs use comma separator (e.g., `5f76a811,6be87b42`)
