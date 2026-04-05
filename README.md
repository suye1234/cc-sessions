# cc-sessions

[中文文档](./README.zh-CN.md)

A TypeScript CLI tool and library for managing Claude Code conversation sessions. Structured JSON storage, full-text search, import from existing session data, and a Neo-Brutalism web dashboard.

**Zero runtime dependencies** — uses only Node.js built-in modules.

## Features

- **Structured Storage** — One JSON file per session + lightweight index for fast listing
- **CRUD Operations** — Create, read, update, delete sessions with immutable data patterns
- **Full-Text Search** — Case-insensitive search across titles, summaries, and messages with snippet highlighting
- **Import** — Parse and import from `~/.claude/session-data/*.tmp` markdown files
- **CLI** — Complete command-line interface for all operations
- **Web Dashboard** — Neo-Brutalism styled browser UI for browsing, filtering, and searching sessions

## Quick Start

```bash
# Install dependencies
npm install

# Import existing Claude Code sessions
npx tsx src/cli.ts import

# Start the web dashboard
npm run dashboard
# Open http://localhost:8283
```

## CLI Usage

```bash
# List sessions (with optional filters)
npx tsx src/cli.ts list [--tag TAG] [--project PROJECT] [--query QUERY]

# Show session details
npx tsx src/cli.ts show <id>

# Search across all sessions
npx tsx src/cli.ts search <query> [--tag TAG] [--project PROJECT]

# Create a new session
npx tsx src/cli.ts create --title TITLE [--project P] [--tags a,b] [--summary S]

# Update a session
npx tsx src/cli.ts update <id> [--title T] [--summary S] [--tags a,b]

# Add a message to a session
npx tsx src/cli.ts add-message <id> --role ROLE --content CONTENT

# Import from session-data directory
npx tsx src/cli.ts import [path]    # default: ~/.claude/session-data/

# Delete a session
npx tsx src/cli.ts delete <id>
```

## Architecture

```
src/
├── types.ts      # Type definitions (Session, Message, SessionIndex, etc.)
├── store.ts      # File I/O: reads/writes JSON session files + index
├── session.ts    # SessionManager: CRUD operations, uses Store internally
├── search.ts     # SearchEngine: full-text search with snippet highlighting
├── server.ts     # HTTP server: JSON API + static file serving for dashboard
├── cli.ts        # CLI entry point + session-data import parser
└── index.ts      # Public API exports
public/
└── index.html    # Web dashboard (Neo-Brutalism, vanilla HTML/CSS/JS)
```

## Data Model

Sessions use **structured sections** rather than raw conversation messages:

| Section | Description |
|---------|-------------|
| `whatWeAreBuilding` | Project description and goals |
| `whatWorked` | Successful approaches (append-only list) |
| `whatDidNotWork` | Failed approaches to avoid retrying |
| `decisions` | Key decisions made during the session |
| `nextStep` | The exact next action to take |
| `keyLearnings` | Insights worth carrying forward |
| `blockers` | Open questions or blockers |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSIONS_DATA_DIR` | `./data` | Data directory path |
| `PORT` | `8283` | Dashboard server port |

## Claude Code Commands

This project includes custom `/yesu-session:*` commands for Claude Code:

| Command | Description |
|---------|-------------|
| `/yesu-session:capture` | Save current conversation as a structured session |
| `/yesu-session:update` | Append new progress to an existing session |
| `/yesu-session:resume` | Load a session and restore context |
| `/yesu-session:list` | List all sessions |
| `/yesu-session:search` | Full-text search across sessions |

Install commands (symlinks to `~/.claude/commands/`):

```bash
./install.sh
```

## Development

```bash
npm run build          # Build TypeScript
npm test               # Run tests (26 tests)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## License

MIT
