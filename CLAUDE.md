
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sessions is a TypeScript CLI tool and library for managing Claude Code conversation session data. It provides CRUD operations, full-text search, and import from existing `~/.claude/session-data/*.tmp` files. Zero runtime dependencies — uses only Node.js built-in modules.

## Commands

```bash
# Install dependencies
npm install

# Run tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run tests with coverage
npx vitest run --coverage

# Build TypeScript
npm run build

# Run CLI directly (dev mode)
npx tsx src/cli.ts <command>

# CLI commands
npx tsx src/cli.ts list [--tag TAG] [--project PROJECT] [--query QUERY]
npx tsx src/cli.ts show <id>
npx tsx src/cli.ts search <query> [--tag TAG] [--project PROJECT]
npx tsx src/cli.ts create --title TITLE [--project P] [--tags a,b] [--summary S]
npx tsx src/cli.ts update <id> [--title T] [--summary S] [--tags a,b]
npx tsx src/cli.ts add-message <id> --role ROLE --content CONTENT
npx tsx src/cli.ts import [path]           # default: ~/.claude/session-data/
npx tsx src/cli.ts delete <id>

# Start web dashboard
npm run dashboard                          # http://localhost:3456
```

## Architecture

```
src/
├── types.ts      # All type definitions (Session, Message, SessionIndex, etc.)
├── store.ts      # Low-level file I/O: reads/writes JSON session files + index
├── session.ts    # SessionManager: CRUD operations, uses Store internally
├── search.ts     # SearchEngine: full-text search across session messages
├── server.ts     # HTTP server: JSON API + static file serving for dashboard
├── cli.ts        # CLI entry point + session-data import parser
└── index.ts      # Public API exports
public/
└── index.html    # Web dashboard (vanilla HTML/CSS/JS, dark theme)
```

- **Store** handles file persistence: one JSON file per session in `data/sessions/`, with a lightweight `data/index.json` for fast listing.
- **SessionManager** wraps Store with business logic: create/get/update/delete/list/addMessage. All mutations are immutable (new objects).
- **SearchEngine** performs case-insensitive full-text search across messages, titles, and summaries with snippet highlighting.
- **CLI** provides command-line access and can import from existing `session-data/*.tmp` markdown files.

## Environment Variables

- `SESSIONS_DATA_DIR` — override the data directory (default: `./data`)
- `PORT` — dashboard server port (default: `3456`)
