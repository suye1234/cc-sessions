---
description: Save the current conversation as a structured session summary (aligned with /save-session format) to the sessions project for dashboard viewing.
---

# Capture Session

Capture the current conversation into the sessions project at `/Users/suye/AI/claudecode/sessions/` as a structured session summary. Focus on **what was accomplished**, not raw messages.

## Process

### Step 1: Analyze the conversation and extract sections

Review the current conversation and fill in these sections (skip empty ones):

1. **title**: One-line topic summary (e.g., "创建 sessions 项目 — 会话管理工具")
2. **topic**: Same as title or slightly more detailed
3. **project**: Working directory path
4. **tags**: Lowercase keywords (e.g., `typescript,sessions,dashboard`)
5. **whatWeAreBuilding**: 1-3 paragraphs describing the goal and context
6. **whatWorked**: List of confirmed working items with evidence
7. **whatDidNotWork**: List of failed approaches with reasons
8. **decisions**: Architecture/design decisions made and why
9. **blockers**: Open questions or unresolved issues
10. **nextStep**: The single next action to take when resuming
11. **keyLearnings**: Notable insights from this session

### Step 2: Create the session via CLI

Build a JSON object with the extracted sections, then call CLI `create` directly:

```bash
cd /Users/suye/AI/claudecode/sessions

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

### Step 3: Confirm with user

Display:
```
Session captured: <id>
Title: <title>
Tags: <tags>
Sections: <list of non-empty sections>

View in dashboard: cd /Users/suye/AI/claudecode/sessions && npm run dashboard
```

## Key Principle

Think like `/save-session` — capture the **what, why, outcomes, and next steps**, not individual messages. A future session should be able to pick up where this one left off by reading the sections.

## Notes

- This saves to `sessions/data/` (JSON), viewed via dashboard at localhost:3456
- Use Chinese in title and summary when the conversation was in Chinese
- Tags should be lowercase for consistency
