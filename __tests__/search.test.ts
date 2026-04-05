import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { SessionManager } from '../src/session.js';
import { SearchEngine } from '../src/search.js';

describe('SearchEngine', () => {
  let dir: string;
  let manager: SessionManager;
  let search: SearchEngine;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sessions-test-'));
    const store = new Store(dir);
    manager = new SessionManager(store);
    search = new SearchEngine(store);
    await manager.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('finds matches in message content', async () => {
    const session = await manager.create({ title: 'Chat' });
    await manager.addMessage(session.id, { role: 'user', content: 'How to use TypeScript generics?' });
    await manager.addMessage(session.id, { role: 'assistant', content: 'Generics allow type parameters' });

    const results = await search.search('generics');
    expect(results).toHaveLength(1);
    expect(results[0].matches.length).toBeGreaterThanOrEqual(2);
  });

  it('finds matches in title', async () => {
    await manager.create({ title: 'TypeScript Debugging Session' });
    const results = await search.search('debugging');
    expect(results).toHaveLength(1);
    expect(results[0].matches[0].role).toBe('system');
  });

  it('finds matches in summary', async () => {
    const session = await manager.create({ title: 'Chat' });
    await manager.update(session.id, { summary: 'Discussed authentication patterns' });
    const results = await search.search('authentication');
    expect(results).toHaveLength(1);
  });

  it('returns empty for no matches', async () => {
    await manager.create({ title: 'Unrelated' });
    const results = await search.search('nonexistent-term-xyz');
    expect(results).toEqual([]);
  });

  it('filters by tag while searching', async () => {
    const s1 = await manager.create({ title: 'A', tags: ['python'] });
    const s2 = await manager.create({ title: 'B', tags: ['rust'] });
    await manager.addMessage(s1.id, { role: 'user', content: 'error handling' });
    await manager.addMessage(s2.id, { role: 'user', content: 'error handling' });

    const results = await search.search('error', { tag: 'python' });
    expect(results).toHaveLength(1);
    expect(results[0].session.tags).toContain('python');
  });

  it('is case insensitive', async () => {
    const session = await manager.create({ title: 'Chat' });
    await manager.addMessage(session.id, { role: 'user', content: 'React Hooks' });
    const results = await search.search('react hooks');
    expect(results).toHaveLength(1);
  });

  it('sorts by match count descending', async () => {
    const s1 = await manager.create({ title: 'One match' });
    const s2 = await manager.create({ title: 'Many matches about test' });
    await manager.addMessage(s1.id, { role: 'user', content: 'test' });
    await manager.addMessage(s2.id, { role: 'user', content: 'test one' });
    await manager.addMessage(s2.id, { role: 'assistant', content: 'test two' });

    const results = await search.search('test');
    expect(results[0].session.id).toBe(s2.id);
    expect(results[0].matches.length).toBeGreaterThan(results[1].matches.length);
  });
});
