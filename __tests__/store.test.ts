import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import type { Session } from '../src/types.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-001',
    title: 'Test Session',
    topic: '',
    project: '/tmp/project',
    tags: ['test'],
    createdAt: '2026-04-05T00:00:00Z',
    updatedAt: '2026-04-05T01:00:00Z',
    messages: [{ role: 'user', content: 'hello', timestamp: '2026-04-05T00:00:00Z' }],
    sections: {},
    metadata: {},
    ...overrides,
  };
}

describe('Store', () => {
  let dir: string;
  let store: Store;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sessions-test-'));
    store = new Store(dir);
    await store.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('initializes with empty index', async () => {
    const index = await store.readIndex();
    expect(index.version).toBe(1);
    expect(index.sessions).toEqual([]);
  });

  it('writes and reads a session', async () => {
    const session = makeSession();
    await store.writeSession(session);
    const read = await store.readSession('test-001');
    expect(read).toEqual(session);
  });

  it('returns null for missing session', async () => {
    const read = await store.readSession('nonexistent');
    expect(read).toBeNull();
  });

  it('deletes a session file', async () => {
    const session = makeSession();
    await store.writeSession(session);
    await store.deleteSessionFile('test-001');
    const read = await store.readSession('test-001');
    expect(read).toBeNull();
  });

  it('lists session files', async () => {
    await store.writeSession(makeSession({ id: 'a' }));
    await store.writeSession(makeSession({ id: 'b' }));
    const ids = await store.listSessionFiles();
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('converts session to summary', () => {
    const session = makeSession({ messages: [
      { role: 'user', content: 'hi', timestamp: '2026-04-05T00:00:00Z' },
      { role: 'assistant', content: 'hello', timestamp: '2026-04-05T00:01:00Z' },
    ]});
    const summary = store.toSummary(session);
    expect(summary.messageCount).toBe(2);
    expect(summary).not.toHaveProperty('messages');
  });

  it('writes and reads index', async () => {
    const summary = store.toSummary(makeSession());
    await store.writeIndex({ version: 1, sessions: [summary] });
    const index = await store.readIndex();
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0].id).toBe('test-001');
  });
});
