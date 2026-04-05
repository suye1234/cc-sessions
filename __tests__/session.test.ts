import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { SessionManager } from '../src/session.js';

describe('SessionManager', () => {
  let dir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sessions-test-'));
    const store = new Store(dir);
    manager = new SessionManager(store);
    await manager.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates a session', async () => {
    const session = await manager.create({ title: 'Test' });
    expect(session.id).toBeTruthy();
    expect(session.title).toBe('Test');
    expect(session.messages).toEqual([]);
  });

  it('gets a session by id', async () => {
    const created = await manager.create({ title: 'Test' });
    const got = await manager.get(created.id);
    expect(got).toEqual(created);
  });

  it('returns null for missing session', async () => {
    expect(await manager.get('nonexistent')).toBeNull();
  });

  it('updates a session', async () => {
    const created = await manager.create({ title: 'Old' });
    const updated = await manager.update(created.id, { title: 'New', tags: ['updated'] });
    expect(updated?.title).toBe('New');
    expect(updated?.tags).toEqual(['updated']);
  });

  it('deletes a session', async () => {
    const created = await manager.create({ title: 'Delete me' });
    expect(await manager.delete(created.id)).toBe(true);
    expect(await manager.get(created.id)).toBeNull();
    expect(await manager.delete(created.id)).toBe(false);
  });

  it('lists sessions', async () => {
    await manager.create({ title: 'A', tags: ['foo'] });
    await manager.create({ title: 'B', tags: ['bar'] });
    const all = await manager.list();
    expect(all).toHaveLength(2);
  });

  it('filters by tag', async () => {
    await manager.create({ title: 'A', tags: ['foo'] });
    await manager.create({ title: 'B', tags: ['bar'] });
    const filtered = await manager.list({ tag: 'foo' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('A');
  });

  it('filters by project', async () => {
    await manager.create({ title: 'A', project: '/proj/alpha' });
    await manager.create({ title: 'B', project: '/proj/beta' });
    const filtered = await manager.list({ project: 'alpha' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('A');
  });

  it('filters by query in title', async () => {
    await manager.create({ title: 'Auth refactor' });
    await manager.create({ title: 'Bug fix' });
    const filtered = await manager.list({ query: 'auth' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Auth refactor');
  });

  it('adds a message', async () => {
    const session = await manager.create({ title: 'Chat' });
    const updated = await manager.addMessage(session.id, { role: 'user', content: 'hello' });
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0].content).toBe('hello');
    expect(updated?.messages[0].timestamp).toBeTruthy();
  });

  it('returns null when adding message to missing session', async () => {
    expect(await manager.addMessage('nonexistent', { role: 'user', content: 'hi' })).toBeNull();
  });

  it('updates index on changes', async () => {
    const session = await manager.create({ title: 'Indexed' });
    await manager.addMessage(session.id, { role: 'user', content: 'msg' });
    const list = await manager.list();
    expect(list[0].messageCount).toBe(1);
  });
});
