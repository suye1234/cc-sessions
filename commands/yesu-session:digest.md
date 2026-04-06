---
description: Generate, show, or update the Project Digest for a project. Aggregates cross-session knowledge into a project-level document at <project>/.claude/project-digest.json.
---

# Project Digest

Manage the Project Digest — a synthesized knowledge document aggregated from all sessions for a given project. The digest lives in the target project at `.claude/project-digest.json` and is version-controlled with the project.

## Process

### Step 1: Determine action and project path

Parse $ARGUMENTS:
- Empty or `show` → show digest for current project (detect from working directory)
- `generate [project-path]` → full generation from all matching sessions
- `show [project-path]` → display existing digest
- `update [project-path]` → incremental update with undigested sessions

If no project-path is provided, use the current working directory.

### Step 2: Execute

```bash
cd $SESSIONS_HOME

# Generate (full rebuild from all sessions)
npx tsx src/cli.ts digest generate "<PROJECT_PATH>"

# Show (display existing digest)
npx tsx src/cli.ts digest show "<PROJECT_PATH>"

# Update (incremental, only new sessions)
npx tsx src/cli.ts digest update "<PROJECT_PATH>"
```

### Step 3: Display results

For `show`, present the digest in a readable format:

```
PROJECT DIGEST: <project-path>
════════════════════════════════════════════════
Last updated: <date>
Sessions: <count>

ARCHITECTURE:
<current architecture description>

ACTIVE DECISIONS:
- <decision> (<date>)
- ...

HARD LESSONS (DO NOT REPEAT):
- [Nx] <lesson>
- ...

KEY LEARNINGS:
### <category>
- <item>
- ...

NEXT STEPS:
- <step>
════════════════════════════════════════════════
```

For `generate` or `update`, confirm:
```
Digest <generated|updated>: <N> sessions aggregated
Written to: <project-path>/.claude/project-digest.json
```

## Notes

- The digest is stored in the **target project**, not in the sessions data directory
- It's designed to be git-committed and shared with the team
- Decisions are all marked `active` by default — manually edit the JSON to mark as `reversed` or `superseded`
- Hard lessons are sorted by frequency (most repeated first)
- The digest complements CLAUDE.md: CLAUDE.md = instructions, Digest = evolutionary knowledge
