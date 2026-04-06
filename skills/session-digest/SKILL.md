---
name: session-digest
description: Generate, show, or update the Project Digest — aggregates cross-session knowledge into a project-level document. WHEN "project digest", "generate digest", "show digest", "update digest", "project knowledge".
compatibility: Requires Node.js 18+ and npx/tsx. Set $SESSIONS_HOME to the sessions project directory.
metadata:
  author: suye1234
  version: "0.1.0"
---

# Project Digest

Manage the Project Digest — a synthesized knowledge document aggregated from all sessions for a given project. The digest lives in the target project at `.claude/project-digest.json` and is version-controlled with the project.

## Process

### Step 1: Determine action and project

Parse the user's intent:
- `show` (default) → display existing digest for current project
- `generate [project-name]` → full generation from all matching sessions
- `update [project-name]` → incremental update with undigested sessions

If no project name is provided, detect from the current working directory.

### Step 2: Execute

```bash
cd $SESSIONS_HOME

# Generate (full rebuild from all sessions tagged project:<name>)
npx tsx src/cli.ts digest generate "<PROJECT_NAME>" [--path /project/path]

# Show (display existing digest)
npx tsx src/cli.ts digest show [/project/path]

# Update (incremental, only new sessions)
npx tsx src/cli.ts digest update "<PROJECT_NAME>" [--path /project/path]
```

### Step 3: Display results

For `show`, present the digest in a readable format:

```
PROJECT DIGEST: <project-name>
════════════════════════════════════════════════
Last updated: <date>
Sessions: <count>

ARCHITECTURE:
<current architecture description>

ACTIVE DECISIONS:
- <decision> (<date>)

HARD LESSONS (DO NOT REPEAT):
- [Nx] <lesson>

KEY LEARNINGS:
### <category>
- <item>

NEXT STEPS:
- <step>
════════════════════════════════════════════════
```

For `generate` or `update`, confirm:
```
Digest <generated|updated>: <N> sessions aggregated
Changes: +<N> decision(s), +<N> lesson(s), +<N> learning(s)
Written to: <project-path>/.claude/project-digest.json
```

## Notes

- The digest is stored in the **target project**, not in the sessions data directory
- It's designed to be git-committed and shared with the team
- Decisions are all marked `active` by default — manually edit the JSON to mark as `reversed` or `superseded`
- Hard lessons are sorted by frequency (most repeated first)
- The digest complements CLAUDE.md: CLAUDE.md = instructions, Digest = evolutionary knowledge
