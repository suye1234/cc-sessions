---
description: Update an existing session with new progress from the current conversation. Merges new sections into the existing session rather than creating a new one.
---

# Update Session

Update an existing session in `$SESSIONS_HOME/data/` with new progress from the current conversation.

## Process

### Step 1: Identify the target session

If $ARGUMENTS is provided, treat it as a session ID prefix.

If not provided, try to **auto-match the current conversation**:
1. Look at the current conversation context — identify the project path, title, or topic being discussed
2. Run: `cd $SESSIONS_HOME && npx tsx src/cli.ts list`
3. Match against session titles, projects, and tags to find the most likely candidate
4. If a single session clearly matches (same project path or very similar title), use it and inform the user:
   ```
   Auto-matched session: <id (first 8 chars)> — <title>
   ```
5. If no clear match or multiple candidates, show the list and ask the user which session to update

### Step 2: Load the current session

```bash
cd $SESSIONS_HOME
```

Read `data/sessions/<full_id>.json` directly to get the current sections.

### Step 3: Analyze what changed

Compare the existing session's sections with the current conversation. Identify:

- **New whatWorked items** — things confirmed working since last capture
- **New whatDidNotWork items** — new failed approaches
- **New decisions** — new architecture/design choices
- **Updated blockers** — resolved ones removed, new ones added
- **Updated nextStep** — what to do next based on current state
- **Updated keyLearnings** — new insights, categorized as `Record<string, string[]>`. Append to existing categories or add new ones.
- **Title/summary/tags** — update if scope changed significantly

Do NOT replace existing items — **append** new ones to lists.

### Step 4: Apply the update

Write a temporary script to merge updates:

```bash
cd $SESSIONS_HOME

npx tsx -e "
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./data/sessions/<FULL_ID>.json', 'utf-8'));
const sec = data.sections;

// Append to lists (don't replace)
sec.whatWorked = [...(sec.whatWorked || []), ...<NEW_ITEMS>];
sec.whatDidNotWork = [...(sec.whatDidNotWork || []), ...<NEW_ITEMS>];
sec.decisions = [...(sec.decisions || []), ...<NEW_ITEMS>];

// Replace scalar fields
sec.blockers = <UPDATED_BLOCKERS>;
sec.nextStep = '<NEW_NEXT_STEP>';
sec.keyLearnings = '<UPDATED_LEARNINGS>';

// Update metadata
data.title = '<UPDATED_TITLE_IF_CHANGED>';
data.summary = '<UPDATED_SUMMARY_IF_CHANGED>';
data.updatedAt = new Date().toISOString();

writeFileSync('./data/sessions/<FULL_ID>.json', JSON.stringify(data, null, 2));

// Also update the index
const idx = JSON.parse(readFileSync('./data/index.json', 'utf-8'));
const entry = idx.sessions.find(s => s.id === data.id);
if (entry) {
  entry.title = data.title;
  entry.summary = data.summary;
  entry.tags = data.tags;
  entry.updatedAt = data.updatedAt;
  entry.hasSections = true;
}
writeFileSync('./data/index.json', JSON.stringify(idx, null, 2));

console.log('Session updated: ' + data.id);
"
```

Alternatively, use CLI for simple field updates:
```bash
npx tsx src/cli.ts update <id> --sections '{"nextStep":"..."}' --title "..." --tags "..."
```

### Step 5: Update Project Digest (conditional)

**Only trigger digest update when** the session's tags include a `project:<name>` tag (e.g., `project:sessions`, `project:harness`).

If a `project:<name>` tag is present:
```bash
cd $SESSIONS_HOME
npx tsx src/cli.ts digest update "<PROJECT_NAME>" --session-id "<SESSION_ID>"
```

**Skip digest update when:**
- No `project:<name>` tag — the session is general learning, exploration, or discussion

### Step 6: Confirm with user

Display:

```
Session updated: <id (first 8 chars)>
Title: <title>

Changes:
  + whatWorked: <N> new items (total: <M>)
  + whatDidNotWork: <N> new items
  + decisions: <N> new items
  ~ nextStep: updated
  ~ blockers: updated
  Project Digest: updated (<project-path>/.claude/project-digest.json)

View in dashboard: cd $SESSIONS_HOME && npm run dashboard
```

## Key Principle

**Append, don't replace.** Existing whatWorked/whatDidNotWork/decisions items are history — add new items to the end. Only replace scalar fields (nextStep, keyLearnings, blockers).
