---
description: Full-text search across all structured sessions — searches in titles, summaries, and message content.
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

$ARGUMENTS is treated as the search query. If it contains `--tag` or `--project`, extract those as filters.

## Examples

```
/yesu-session:search hud
/yesu-session:search typescript --tag imported
/yesu-session:search 认证 --project auth-app
```
