import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { Store } from './store.js';
import { SessionManager } from './session.js';
import { SearchEngine } from './search.js';
import { DigestManager } from './digest.js';
import type { SessionFilter, SessionSections, FileState } from './types.js';

const DEFAULT_DATA_DIR = join(resolve('.'), 'data');
const DEFAULT_IMPORT_DIR = join(homedir(), '.claude', 'session-data');

function getDataDir(): string {
  return process.env['SESSIONS_DATA_DIR'] ?? DEFAULT_DATA_DIR;
}

async function createManager(): Promise<{ manager: SessionManager; search: SearchEngine }> {
  const store = new Store(getDataDir());
  const manager = new SessionManager(store);
  const search = new SearchEngine(store);
  await manager.init();
  return { manager, search };
}

// -- Import from existing session-data/*.tmp files --

interface ParsedSessionFile {
  topic: string;
  date: string;
  started: string;
  project: string;
  branch: string;
  worktree: string;
  toolsUsed: string[];
  totalMessages: number;
  sections: SessionSections;
}

function parseSessionFile(content: string): ParsedSessionFile {
  const result: ParsedSessionFile = {
    topic: '', date: '', started: '', project: '', branch: '', worktree: '',
    toolsUsed: [], totalMessages: 0,
    sections: {},
  };

  const lines = content.split('\n');

  // Extract header metadata
  for (const line of lines) {
    const m = (pattern: RegExp) => line.match(pattern)?.[1]?.trim() ?? '';
    if (!result.date) result.date = m(/^\*\*Date:\*\*\s*(.+)/);
    if (!result.started) result.started = m(/^\*\*Started:\*\*\s*(.+)/);
    if (!result.project) result.project = m(/^\*\*Project:\*\*\s*(.+)/);
    if (!result.branch) result.branch = m(/^\*\*Branch:\*\*\s*(.+)/);
    if (!result.worktree) result.worktree = m(/^\*\*Worktree:\*\*\s*(.+)/);
    if (!result.topic) result.topic = m(/^\*\*Topic:\*\*\s*(.+)/);
  }

  // Section mapping: markdown heading → section key + type
  const sectionMap: Record<string, { key: keyof SessionSections; type: 'text' | 'list' | 'table' }> = {
    'what we are building': { key: 'whatWeAreBuilding', type: 'text' },
    'what worked': { key: 'whatWorked', type: 'list' },
    'what did not work': { key: 'whatDidNotWork', type: 'list' },
    'what has not been tried yet': { key: 'whatNotTriedYet', type: 'list' },
    'current state of files': { key: 'fileStates', type: 'table' },
    'decisions made': { key: 'decisions', type: 'list' },
    'blockers': { key: 'blockers', type: 'list' },
    'open questions': { key: 'blockers', type: 'list' },
    'exact next step': { key: 'nextStep', type: 'text' },
    'key learnings': { key: 'keyLearnings', type: 'text' },
    // ECC summary format
    'tasks': { key: 'whatWorked', type: 'list' },
    'tools used': { key: 'whatWorked', type: 'text' },
    'notes for next session': { key: 'nextStep', type: 'text' },
  };

  let currentSection: { key: keyof SessionSections; type: string } | null = null;
  let textBuffer = '';
  let listBuffer: string[] = [];
  let fileBuffer: FileState[] = [];

  function flushSection(): void {
    if (!currentSection) return;
    const { key, type } = currentSection;
    if (type === 'text' && textBuffer.trim()) {
      (result.sections as Record<string, unknown>)[key] = textBuffer.trim();
    } else if (type === 'list' && listBuffer.length > 0) {
      const existing = (result.sections as Record<string, unknown>)[key];
      if (Array.isArray(existing)) {
        (result.sections as Record<string, unknown>)[key] = [...existing, ...listBuffer];
      } else {
        (result.sections as Record<string, unknown>)[key] = listBuffer;
      }
    } else if (type === 'table' && fileBuffer.length > 0) {
      (result.sections as Record<string, unknown>)[key] = fileBuffer;
    }
    textBuffer = '';
    listBuffer = [];
    fileBuffer = [];
  }

  for (const line of lines) {
    // Detect section headings (## or ###)
    const headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      flushSection();
      const heading = headingMatch[1].toLowerCase()
        .replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, '').trim();
      const mapped = Object.entries(sectionMap).find(([k]) => heading.includes(k));
      currentSection = mapped ? mapped[1] : null;
      continue;
    }

    if (line.startsWith('---') || line.startsWith('<!--')) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Stats extraction
    const msgMatch = trimmed.match(/Total user messages:\s*(\d+)/);
    if (msgMatch) result.totalMessages = parseInt(msgMatch[1], 10);

    // Tools extraction
    if (currentSection?.key === 'whatWorked' && !trimmed.startsWith('- ') && !trimmed.startsWith('|') && trimmed.includes(',')) {
      result.toolsUsed = trimmed.split(',').map(t => t.trim()).filter(Boolean);
      continue;
    }

    if (!currentSection) continue;

    if (currentSection.type === 'text') {
      textBuffer += trimmed + ' ';
    } else if (currentSection.type === 'list') {
      if (trimmed.startsWith('- ')) {
        const item = trimmed.slice(2).replace(/<[^>]+>/g, '').trim();
        if (item.length > 0 && item.length < 500) listBuffer.push(item);
      }
    } else if (currentSection.type === 'table') {
      // Parse markdown table rows
      if (trimmed.startsWith('|') && !trimmed.includes('---')) {
        const cols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 2 && cols[0].toLowerCase() !== 'file') {
          const statusMap: Record<string, FileState['status']> = {
            'complete': 'complete', 'pass': 'complete', '✅': 'complete',
            'in progress': 'in-progress', '🔄': 'in-progress',
            'broken': 'broken', 'fail': 'broken', '❌': 'broken',
            'not started': 'not-started', '⏳': 'not-started',
          };
          const rawStatus = (cols[1] ?? '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
          const status = Object.entries(statusMap).find(([k]) => rawStatus.includes(k))?.[1] ?? 'in-progress';
          fileBuffer.push({ path: cols[0].replace(/`/g, ''), status, notes: cols[2] ?? '' });
        }
      }
    }
  }

  flushSection();
  return result;
}

async function importSessions(importDir?: string): Promise<number> {
  const dir = importDir ?? DEFAULT_IMPORT_DIR;
  const { manager } = await createManager();

  let files: string[];
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.tmp'));
  } catch {
    console.error(`Cannot read directory: ${dir}`);
    return 0;
  }

  let count = 0;
  for (const file of files) {
    const content = await readFile(join(dir, file), 'utf-8');
    const parsed = parseSessionFile(content);

    // Title: Topic > first sentence of whatWeAreBuilding > project+date
    const title = parsed.topic
      || (parsed.sections.whatWeAreBuilding
        ? parsed.sections.whatWeAreBuilding.split(/[.。!！\n]/)[0].slice(0, 80)
        : '')
      || `${parsed.project || 'Session'} — ${parsed.date || file}`;

    // Summary: whatWeAreBuilding truncated
    const summary = parsed.sections.whatWeAreBuilding?.slice(0, 300) ?? '';

    // Clean tags
    const cleanTags = parsed.toolsUsed
      .filter(t => !t.startsWith('mcp__') && t.length < 30)
      .slice(0, 5);

    await manager.create({
      title,
      topic: parsed.topic,
      project: parsed.worktree || parsed.project,
      tags: ['imported', ...cleanTags],
      summary,
      sections: parsed.sections,
      metadata: {
        source: file,
        branch: parsed.branch,
        totalMessages: parsed.totalMessages,
      },
    });

    count++;
  }

  return count;
}

// -- CLI --

function printHelp(): void {
  console.log(`
sessions - Conversation session manager

Commands:
  list [--tag TAG] [--project PROJECT] [--query QUERY]   List sessions
  show <id>                                               Show session details
  search <query> [--tag TAG] [--project PROJECT]          Search in messages
  create --title TITLE [--project P] [--tags a,b] [--summary S]  Create session
  add-message <id> --role ROLE --content CONTENT          Add message to session
  import [path]                                           Import from session-data
  delete <id>                                             Delete a session
  digest generate <name> [--path /project/path]            Generate digest (filters by project:<name> tag)
  digest show [path]                                      Show project digest
  digest update <name> [--path P] [--session-id ID]       Update digest incrementally

Environment:
  SESSIONS_DATA_DIR    Data directory (default: ./data)
`);
}

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const command = args[0] ?? 'help';
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && i + 1 < args.length) {
      flags[arg.slice(2)] = args[++i];
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  if (command === 'list') {
    const { manager } = await createManager();
    const filter: SessionFilter = {};
    if (flags['tag']) filter.tag = flags['tag'];
    if (flags['project']) filter.project = flags['project'];
    if (flags['query']) filter.query = flags['query'];

    const sessions = await manager.list(filter);
    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }
    for (const s of sessions) {
      const tags = s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : '';
      console.log(`${s.id.slice(0, 8)}  ${s.updatedAt.slice(0, 10)}  ${s.title}${tags}  (${s.messageCount} msgs)`);
    }
    return;
  }

  if (command === 'show') {
    const id = positional[0];
    if (!id) { console.error('Usage: sessions show <id>'); return; }

    const { manager } = await createManager();
    // Support partial ID match
    const sessions = await manager.list();
    const match = sessions.find(s => s.id.startsWith(id));
    if (!match) { console.error(`Session not found: ${id}`); return; }

    const session = await manager.get(match.id);
    if (!session) { console.error('Session file missing'); return; }

    console.log(`# ${session.title}`);
    console.log(`ID: ${session.id}`);
    console.log(`Project: ${session.project}`);
    console.log(`Tags: ${session.tags.join(', ')}`);
    console.log(`Created: ${session.createdAt}`);
    console.log(`Updated: ${session.updatedAt}`);
    if (session.summary) console.log(`Summary: ${session.summary}`);
    console.log(`\n--- Messages (${session.messages.length}) ---\n`);
    for (const msg of session.messages) {
      const prefix = msg.role === 'user' ? '> ' : msg.role === 'assistant' ? '< ' : '# ';
      const content = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
      console.log(`${prefix}[${msg.timestamp.slice(0, 19)}] ${content}`);
    }
    return;
  }

  if (command === 'search') {
    const query = positional[0];
    if (!query) { console.error('Usage: sessions search <query>'); return; }

    const { search } = await createManager();
    const filter: Omit<SessionFilter, 'query'> = {};
    if (flags['tag']) filter.tag = flags['tag'];
    if (flags['project']) filter.project = flags['project'];

    const results = await search.search(query, filter);
    if (results.length === 0) {
      console.log('No matches found.');
      return;
    }
    for (const r of results) {
      console.log(`\n${r.session.id.slice(0, 8)}  ${r.session.title}  (${r.matches.length} matches)`);
      for (const m of r.matches.slice(0, 3)) {
        console.log(`  ${m.role}: ${m.snippet}`);
      }
    }
    return;
  }

  if (command === 'update') {
    const id = positional[0];
    if (!id) { console.error('Usage: sessions update <id> [--title T] [--summary S] [--tags a,b] [--sections JSON]'); return; }

    const { manager } = await createManager();
    const sessions = await manager.list();
    const match = sessions.find(s => s.id.startsWith(id));
    if (!match) { console.error(`Session not found: ${id}`); return; }

    const patch: Record<string, unknown> = {};
    if (flags['title']) patch.title = flags['title'];
    if (flags['summary']) patch.summary = flags['summary'];
    if (flags['tags']) patch.tags = flags['tags'].split(',').map(t => t.trim()).filter(Boolean);
    if (flags['topic']) patch.topic = flags['topic'];
    if (flags['sections']) {
      try {
        patch.sections = JSON.parse(flags['sections']);
      } catch {
        console.error('Invalid JSON for --sections');
        return;
      }
    }

    const updated = await manager.update(match.id, patch);
    if (updated) {
      console.log(JSON.stringify({ id: updated.id, title: updated.title, summary: updated.summary }, null, 2));
    } else {
      console.error('Update failed.');
    }
    return;
  }

  if (command === 'create') {
    const title = flags['title'];
    if (!title) { console.error('Usage: sessions create --title "Title" [--project P] [--tags a,b] [--summary S]'); return; }

    const { manager } = await createManager();
    const opts: Record<string, unknown> = {
      title,
      project: flags['project'],
      tags: flags['tags']?.split(',').map(t => t.trim()).filter(Boolean),
      summary: flags['summary'],
      topic: flags['topic'],
    };
    if (flags['sections']) {
      try {
        opts.sections = JSON.parse(flags['sections']);
      } catch {
        console.error('Invalid JSON for --sections');
        return;
      }
    }
    const session = await manager.create(opts as Parameters<typeof manager.create>[0]);
    console.log(JSON.stringify({ id: session.id, title: session.title }, null, 2));
    return;
  }

  if (command === 'add-message') {
    const id = positional[0];
    const role = flags['role'] as 'user' | 'assistant' | 'system' | undefined;
    const content = flags['content'];
    if (!id || !role || !content) {
      console.error('Usage: sessions add-message <id> --role user|assistant|system --content "..."');
      return;
    }

    const { manager } = await createManager();
    const sessions = await manager.list();
    const match = sessions.find(s => s.id.startsWith(id));
    if (!match) { console.error(`Session not found: ${id}`); return; }

    const updated = await manager.addMessage(match.id, { role, content });
    if (updated) {
      console.log(`Message added. Total: ${updated.messages.length}`);
    } else {
      console.error('Failed to add message.');
    }
    return;
  }

  if (command === 'import') {
    const dir = positional[0];
    const count = await importSessions(dir);
    console.log(`Imported ${count} session(s).`);
    return;
  }

  if (command === 'digest') {
    const subcommand = positional[0];
    const projectName = positional[1] ?? flags['name'];
    const explicitPath = flags['path'] ? resolve(flags['path']) : undefined;

    if (!subcommand) {
      console.error('Usage: sessions digest <generate|show|update> <project-name> [--path /project/path]');
      return;
    }

    // show can work with just a path (reads the file directly)
    if (subcommand === 'show') {
      const showPath = explicitPath ?? (projectName ? resolve(projectName) : resolve('.'));
      const store = new Store(getDataDir());
      const manager = new SessionManager(store);
      await manager.init();
      const digestManager = new DigestManager(manager, store);

      const digest = await digestManager.show(showPath);
      if (!digest) {
        console.error('No digest found. Run: sessions digest generate <project-name>');
        return;
      }
      console.log(`# Project Digest: ${digest.projectName} (${digest.projectPath})`);
      console.log(`Last updated: ${digest.lastUpdated}`);
      console.log(`Sessions: ${digest.sessionCount}\n`);

      console.log('## Architecture');
      console.log(digest.architecture.current || '(none)');

      if (digest.decisions.length > 0) {
        console.log('\n## Active Decisions');
        for (const d of digest.decisions.filter(d => d.status === 'active')) {
          console.log(`- ${d.decision}  (${d.date})`);
        }
      }

      if (digest.hardLessons.length > 0) {
        console.log('\n## Hard Lessons');
        for (const l of digest.hardLessons.slice(0, 10)) {
          console.log(`- [${l.frequency}x] ${l.lesson}`);
        }
      }

      if (digest.keyLearnings.length > 0) {
        console.log('\n## Key Learnings');
        for (const kl of digest.keyLearnings) {
          console.log(`\n### ${kl.category}`);
          for (const item of kl.items) {
            console.log(`- ${item}`);
          }
        }
      }

      if (digest.nextSteps.length > 0) {
        console.log('\n## Next Steps');
        for (const ns of digest.nextSteps) {
          console.log(`- ${ns}`);
        }
      }
      return;
    }

    // generate and update require project name (for tag filtering)
    if (!projectName) {
      console.error('Usage: sessions digest <generate|update> <project-name> [--path /project/path]');
      return;
    }

    const store = new Store(getDataDir());
    const manager = new SessionManager(store);
    await manager.init();
    const digestManager = new DigestManager(manager, store);

    if (subcommand === 'generate') {
      const digest = await digestManager.generate(projectName, explicitPath);
      console.log(`Digest generated: ${digest.sessionCount} sessions aggregated`);
      console.log(`Written to: ${digest.projectPath}/.claude/project-digest.json`);
      return;
    }

    if (subcommand === 'update') {
      const sessionId = flags['session-id'];
      const digest = await digestManager.update(projectName, explicitPath, sessionId);
      console.log(`Digest updated: ${digest.sessionCount} sessions`);
      return;
    }

    console.error('Unknown digest subcommand. Use: generate, show, update');
    return;
  }

  if (command === 'delete') {
    const id = positional[0];
    if (!id) { console.error('Usage: sessions delete <id>'); return; }

    const { manager } = await createManager();
    const sessions = await manager.list();
    const match = sessions.find(s => s.id.startsWith(id));
    if (!match) { console.error(`Session not found: ${id}`); return; }

    const deleted = await manager.delete(match.id);
    console.log(deleted ? `Deleted: ${match.id}` : 'Delete failed.');
    return;
  }

  printHelp();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
