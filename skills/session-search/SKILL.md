---
name: session-search
description: Full-text search across all structured sessions — searches in titles, summaries, and message content. WHEN "search sessions", "find session", "look up session", "search history".
compatibility: Requires Node.js 18+ and npx/tsx. Set $SESSIONS_HOME to the sessions project directory.
metadata:
  author: suye1234
  version: "0.1.0"
---

# Search Sessions

Search across all sessions in `$SESSIONS_HOME/data/`.

## Process

Run the CLI:

```bash
cd $SESSIONS_HOME
npx tsx src/cli.ts search "<query>" [--tag TAG] [--project PROJECT]
```

Display the results with matched snippets.

## Examples

```bash
# Search by keyword
cd $SESSIONS_HOME && npx tsx src/cli.ts search "authentication"

# Search with tag filter
cd $SESSIONS_HOME && npx tsx src/cli.ts search "typescript" --tag imported

# Search within a project
cd $SESSIONS_HOME && npx tsx src/cli.ts search "migration" --project auth-app
```
