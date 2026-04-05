---
description: Delete one or more sessions from the sessions project. Supports ID prefix matching with confirmation.
---

# Delete Session

Delete sessions from `/Users/suye/AI/claudecode/sessions/data/`.

## Process

### Step 1: Identify target session(s)

If $ARGUMENTS is provided:
- Treat as one or more session ID prefixes (comma-separated for multiple)
- Resolve each to the full UUID via CLI

If not provided:
- Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts list`
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
cd /Users/suye/AI/claudecode/sessions
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
