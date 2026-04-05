import { Store } from './store.js';
import type { SearchResult, SearchMatch, SessionFilter } from './types.js';

export class SearchEngine {
  constructor(private readonly store: Store) {}

  async search(query: string, filter?: Omit<SessionFilter, 'query'>): Promise<SearchResult[]> {
    const index = await this.store.readIndex();
    let candidates = index.sessions;

    if (filter?.tag) {
      candidates = candidates.filter(s => s.tags.includes(filter.tag!));
    }
    if (filter?.project) {
      candidates = candidates.filter(s => s.project.includes(filter.project!));
    }
    if (filter?.from) {
      candidates = candidates.filter(s => s.createdAt >= filter.from!);
    }
    if (filter?.to) {
      candidates = candidates.filter(s => s.createdAt <= filter.to!);
    }

    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const summary of candidates) {
      const session = await this.store.readSession(summary.id);
      if (!session) continue;

      const matches: SearchMatch[] = [];

      // Search in title
      if (session.title.toLowerCase().includes(q)) {
        matches.push({
          messageIndex: -1,
          role: 'system',
          snippet: highlightSnippet(session.title, q),
        });
      }

      // Search in summary
      if (session.summary?.toLowerCase().includes(q)) {
        matches.push({
          messageIndex: -1,
          role: 'system',
          snippet: highlightSnippet(session.summary, q),
        });
      }

      // Search in messages
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        if (msg.content.toLowerCase().includes(q)) {
          matches.push({
            messageIndex: i,
            role: msg.role,
            snippet: highlightSnippet(msg.content, q),
          });
        }
      }

      if (matches.length > 0) {
        results.push({ session: summary, matches });
      }
    }

    return results.sort((a, b) => b.matches.length - a.matches.length);
  }
}

function highlightSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return text.slice(0, contextChars * 2);

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let snippet = text.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}
