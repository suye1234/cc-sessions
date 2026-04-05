import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import type {
  Session,
  SessionSummary,
  SessionFilter,
  CreateSessionOptions,
  Message,
} from './types.js';

export class SessionManager {
  constructor(private readonly store: Store) {}

  async init(): Promise<void> {
    await this.store.init();
  }

  async create(opts: CreateSessionOptions): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      title: opts.title,
      topic: opts.topic ?? '',
      project: opts.project ?? '',
      tags: opts.tags ?? [],
      createdAt: now,
      updatedAt: now,
      summary: opts.summary,
      sections: opts.sections ?? {},
      messages: [],
      metadata: opts.metadata ?? {},
    };

    await this.store.writeSession(session);
    await this.addToIndex(session);
    return session;
  }

  async get(id: string): Promise<Session | null> {
    return this.store.readSession(id);
  }

  async update(id: string, patch: Partial<Pick<Session, 'title' | 'topic' | 'tags' | 'summary' | 'project' | 'metadata' | 'sections'>>): Promise<Session | null> {
    const session = await this.store.readSession(id);
    if (!session) return null;

    // Merge sections instead of replacing
    const mergedSections = patch.sections
      ? { ...session.sections, ...patch.sections }
      : session.sections;

    const updated: Session = {
      ...session,
      ...patch,
      sections: mergedSections,
      updatedAt: new Date().toISOString(),
    };

    await this.store.writeSession(updated);
    await this.updateIndex(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const index = await this.store.readIndex();
    const filtered = index.sessions.filter(s => s.id !== id);
    if (filtered.length === index.sessions.length) return false;

    await this.store.deleteSessionFile(id);
    await this.store.writeIndex({ ...index, sessions: filtered });
    return true;
  }

  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    const index = await this.store.readIndex();
    let results = index.sessions;

    if (filter?.tag) {
      results = results.filter(s => s.tags.includes(filter.tag!));
    }
    if (filter?.project) {
      results = results.filter(s => s.project.includes(filter.project!));
    }
    if (filter?.from) {
      results = results.filter(s => s.createdAt >= filter.from!);
    }
    if (filter?.to) {
      results = results.filter(s => s.createdAt <= filter.to!);
    }
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      results = results.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.summary?.toLowerCase().includes(q)
      );
    }

    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async addMessage(sessionId: string, message: Omit<Message, 'timestamp'>): Promise<Session | null> {
    const session = await this.store.readSession(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();
    const updated: Session = {
      ...session,
      messages: [...session.messages, { ...message, timestamp: now }],
      updatedAt: now,
    };

    await this.store.writeSession(updated);
    await this.updateIndex(updated);
    return updated;
  }

  private async addToIndex(session: Session): Promise<void> {
    const index = await this.store.readIndex();
    const summary = this.store.toSummary(session);
    await this.store.writeIndex({
      ...index,
      sessions: [...index.sessions, summary],
    });
  }

  private async updateIndex(session: Session): Promise<void> {
    const index = await this.store.readIndex();
    const summary = this.store.toSummary(session);
    const sessions = index.sessions.map(s => s.id === session.id ? summary : s);
    await this.store.writeIndex({ ...index, sessions });
  }
}
