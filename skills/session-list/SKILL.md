---
name: session-list
description: List all structured sessions with optional filtering by tag, project, or keyword. WHEN "list sessions", "show sessions", "my sessions", "session history".
compatibility: Requires Node.js 18+ and npx/tsx. Set $SESSIONS_HOME to the sessions project directory.
metadata:
  author: suye1234
  version: "0.1.0"
---

# List Sessions

List all sessions stored in `$SESSIONS_HOME/data/`.

## Process

Run the CLI:

```bash
cd $SESSIONS_HOME
npx tsx src/cli.ts list [--tag TAG] [--project PROJECT] [--query QUERY]
```

Display the results to the user in a readable format.

If the user provides filters, pass them as flags:
- A plain keyword is treated as `--query`
- `--tag`, `--project`, `--query` flags are supported

## Examples

```bash
# List all sessions
cd $SESSIONS_HOME && npx tsx src/cli.ts list

# Filter by keyword
cd $SESSIONS_HOME && npx tsx src/cli.ts list --query typescript

# Filter by tag
cd $SESSIONS_HOME && npx tsx src/cli.ts list --tag imported

# Filter by project
cd $SESSIONS_HOME && npx tsx src/cli.ts list --project claudecode
```
