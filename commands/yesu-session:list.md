---
description: List all structured sessions from the sessions project with optional filtering by tag, project, or keyword.
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

If the user provides filters via $ARGUMENTS, pass them as flags:
- First word treated as `--query` if it doesn't start with `--`
- `--tag`, `--project`, `--query` flags supported

## Examples

```
/yesu-session:list
/yesu-session:list typescript
/yesu-session:list --tag imported
/yesu-session:list --project claudecode
```
