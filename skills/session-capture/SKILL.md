---
name: session-capture
description: Save the current conversation as a structured session summary to the sessions project. WHEN "save session", "capture session", "record session", "save conversation", "save progress".
compatibility: Requires Node.js 18+ and npx/tsx. Set $SESSIONS_HOME to the sessions project directory.
metadata:
  author: suye1234
  version: "0.1.0"
---

# Capture Session

Capture the current conversation into the sessions project at `$SESSIONS_HOME/` as a structured session summary. Focus on **what was accomplished**, not raw messages.

## Process

### Step 1: Analyze the conversation and extract sections

Review the current conversation and fill in these sections (skip empty ones):

1. **title**: One-line topic summary (e.g., "Build auth module for API server")
2. **topic**: Same as title or slightly more detailed
3. **project**: Working directory path
4. **tags**: Lowercase keywords (e.g., `typescript,sessions,dashboard`)
5. **whatWeAreBuilding**: 1-3 paragraphs describing the goal and context
6. **whatWorked**: List of confirmed working items with evidence
7. **whatDidNotWork**: List of failed approaches with reasons
8. **decisions**: Architecture/design decisions made and why
9. **blockers**: Open questions or unresolved issues
10. **nextStep**: The single next action to take when resuming
11. **keyLearnings**: Notable insights, organized by category. Use `Record<string, string[]>` format:
    ```json
    {
      "Category Name": ["insight 1", "insight 2"],
      "Another Category": ["insight 3"]
    }
    ```

### Step 2: Create the session via CLI

Build a JSON object with the extracted sections, then call CLI `create` directly:

```bash
cd $SESSIONS_HOME

npx tsx src/cli.ts create \
  --title "<TITLE>" \
  --topic "<TOPIC>" \
  --project "<PROJECT>" \
  --tags "<tag1>,<tag2>" \
  --summary "<WHAT_WE_ARE_BUILDING first 300 chars>" \
  --sections '<SECTIONS_JSON>'
```

The `--sections` value is a JSON string containing all sections:

```json
{
  "whatWeAreBuilding": "<full description>",
  "whatWorked": ["<item1>", "<item2>"],
  "whatDidNotWork": ["<item1>"],
  "decisions": ["<decision1>"],
  "blockers": ["<blocker1>"],
  "nextStep": "<next step>",
  "keyLearnings": "<learnings>"
}
```

**Tip:** If the JSON is too long for a single command line, write the sections JSON to a temp file and use `$(cat _sections.json)` — but prefer inline for simplicity.

### Step 3: Update Project Digest (conditional)

**Only trigger digest update when** the session's tags include a `project:<name>` tag (e.g., `project:sessions`, `project:harness`).

If a `project:<name>` tag is present:
```bash
cd $SESSIONS_HOME
npx tsx src/cli.ts digest update "<PROJECT_NAME>" --session-id "<SESSION_ID>"
```

**Skip digest update when:**
- No `project:<name>` tag — the session is general learning, exploration, or discussion

### Step 4: Confirm with user

Display:
```
Session captured: <id>
Title: <title>
Tags: <tags>
Sections: <list of non-empty sections>
Project Digest: updated (<project-path>/.claude/project-digest.json)

View in dashboard: cd $SESSIONS_HOME && npm run dashboard
```

## Key Principle

Capture the **what, why, outcomes, and next steps**, not individual messages. A future session should be able to pick up where this one left off by reading the sections.

## Notes

- This saves to `$SESSIONS_HOME/data/` (JSON), viewed via dashboard at localhost:8283
- Use the conversation's language for title and summary
- Tags should be lowercase for consistency
