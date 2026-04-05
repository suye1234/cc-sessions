---
description: Load one or more structured sessions (max 5) from the sessions project and resume work with full context.
---

# Resume Session

Load sessions from `/Users/suye/AI/claudecode/sessions/data/` and orient fully before doing any work.

Supports loading **1–5 sessions** at once. Multiple sessions are useful when related topics need to be discussed together.

## Process

### Step 1: Parse arguments

$ARGUMENTS can be:
- Empty — show list and ask user to pick
- One ID prefix or keyword — load that single session
- Multiple IDs separated by **commas** (e.g., `5f76a811,6be87b42`) — load all of them

Spaces are **not** used as separators — they are part of the search keyword (e.g., `Claude Code` is one keyword, not two).

If more than 5 IDs are provided, reject with: "最多支持同时加载 5 个 session，请减少数量。"

For each argument, treat it as a session ID prefix or title keyword:
- Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts list --query "<arg>"`
- If multiple matches for one argument, show them and ask user to pick

If no argument:
- Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts list`
- Show the list and ask the user which session(s) to resume

### Step 2: Load sessions

For each session:
1. First resolve the short ID to the full UUID by listing files in `data/sessions/` that start with the short ID prefix
2. Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts show <short_id>` to get the session details — the CLI handles partial ID matching internally
3. Then read the full JSON from `data/sessions/<full_uuid>.json` for complete sections access

**Important:** Never assume the short ID is the full filename. Always resolve via CLI or glob match first.

### Step 3: Present structured briefing

#### Single session — full briefing:

```
SESSION LOADED: <id (first 8 chars)>
════════════════════════════════════════════════

TITLE: <title>
PROJECT: <project>
TAGS: <tags>
CREATED: <date>

WHAT WE WERE BUILDING:
<whatWeAreBuilding section>

WHAT WORKED:
<whatWorked items as bullet list>

WHAT DID NOT WORK:
<whatDidNotWork items — critical to avoid retrying>

DECISIONS MADE:
<decisions items>

BLOCKERS / OPEN QUESTIONS:
<blockers items>

NEXT STEP:
<nextStep — the exact thing to do next>

KEY LEARNINGS:
<keyLearnings>

════════════════════════════════════════════════
Ready to continue. What would you like to do?
```

#### Multiple sessions — first full, rest compact:

The **first session** gets the full briefing format above.

Each **additional session** uses a compact format to save context:

```
────────────────────────────────────────────────
SESSION [N]: <id (first 8 chars)>
TITLE: <title>
PROJECT: <project>  |  TAGS: <tags>

BUILDING: <whatWeAreBuilding — first 200 chars>

DO NOT RETRY:
<whatDidNotWork items — always show in full>

DECISIONS: <decisions as comma-separated list>
NEXT STEP: <nextStep>
KEY LEARNINGS: <keyLearnings — first 200 chars>
────────────────────────────────────────────────
```

After all sessions are displayed, show:

```
════════════════════════════════════════════════
<N> sessions loaded. Ready to continue. What would you like to do?
════════════════════════════════════════════════
```

### Step 4: Wait for user

Do NOT start working automatically. Wait for the user to say what to do next.

- **Single session:** If the next step is clearly defined and the user says "continue" — proceed with that exact step.
- **Multiple sessions:** Do NOT auto-continue. Ask the user which session's next step to work on, or what cross-session task they want to do.

## Notes

- Never modify sessions when loading — read-only context
- The "What Did Not Work" / "DO NOT RETRY" section is critical — do not retry those approaches
- All sessions' whatDidNotWork are shown in full regardless of compact mode
- After resuming and completing work, suggest `/yesu-session:capture` to save the new session
