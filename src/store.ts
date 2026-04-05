import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Session, SessionIndex, SessionSummary } from './types.js';

export class Store {
  private readonly dataDir: string;
  private readonly sessionsDir: string;
  private readonly indexPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.sessionsDir = join(dataDir, 'sessions');
    this.indexPath = join(dataDir, 'index.json');
  }

  async init(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    try {
      await readFile(this.indexPath, 'utf-8');
    } catch {
      await this.writeIndex({ version: 1, sessions: [] });
    }
  }

  async readIndex(): Promise<SessionIndex> {
    const raw = await readFile(this.indexPath, 'utf-8');
    return JSON.parse(raw) as SessionIndex;
  }

  async writeIndex(index: SessionIndex): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  async readSession(id: string): Promise<Session | null> {
    try {
      const raw = await readFile(this.sessionPath(id), 'utf-8');
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async writeSession(session: Session): Promise<void> {
    await writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  async deleteSessionFile(id: string): Promise<void> {
    try {
      await unlink(this.sessionPath(id));
    } catch {
      // file may not exist
    }
  }

  async listSessionFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.sessionsDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  toSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      title: session.title,
      topic: session.topic,
      project: session.project,
      tags: session.tags,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      summary: session.summary,
      hasSections: Object.keys(session.sections).length > 0,
    };
  }

  private sessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`);
  }
}
