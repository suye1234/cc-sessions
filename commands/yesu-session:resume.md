---
description: Load a structured session from the sessions project and resume work with full context from where the last session ended.
---

# Resume Session

Load a session from `/Users/suye/AI/claudecode/sessions/data/` and orient fully before doing any work.

## Process

### Step 1: Find the session

If $ARGUMENTS is provided:
- Treat it as a session ID prefix or title keyword
- Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts list --query "$ARGUMENTS"`
- If multiple matches, show them and ask user to pick

If no argument:
- Run: `cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts list`
- Show the list and ask the user which session to resume

### Step 2: Load the full session

```bash
cd /Users/suye/AI/claudecode/sessions && npx tsx src/cli.ts show <id>
```

Read the session JSON directly from `data/sessions/<id>.json` for full sections access.

### Step 3: Present structured briefing

Display in this format:

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

### Step 4: Wait for user

Do NOT start working automatically. Wait for the user to say what to do next.

If the next step is clearly defined and the user says "continue" — proceed with that exact step.

## Notes

- Never modify the session when loading — it's read-only context
- The "What Did Not Work" section is critical — do not retry those approaches
- After resuming and completing work, suggest `/yesu-session:capture` to save the new session
