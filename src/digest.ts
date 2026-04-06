import { Store } from './store.js';
import { SessionManager } from './session.js';
import { DigestStore } from './digest-store.js';
import type {
  Session,
  ProjectDigest,
  DigestDecision,
  DigestLesson,
  DigestLearning,
  DigestArchitectureEntry,
} from './types.js';

const MAX_EVOLUTION = 30;
const MAX_LESSONS = 50;
const MAX_DECISIONS = 100;
const PROJECT_TAG_PREFIX = 'project:';

export class DigestManager {
  private readonly digestStore = new DigestStore();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly store: Store,
  ) {}

  /**
   * Find sessions that have the `project:<name>` tag.
   */
  private async findSessionsByProjectTag(projectName: string): Promise<Session[]> {
    const tag = `${PROJECT_TAG_PREFIX}${projectName}`;
    const summaries = await this.sessionManager.list({ tag });
    const sessions: Session[] = [];
    for (const s of summaries) {
      const full = await this.store.readSession(s.id);
      if (full) sessions.push(full);
    }
    sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return sessions;
  }

  /**
   * Infer project path from sessions — pick the most common `project` field.
   */
  private inferProjectPath(sessions: Session[]): string {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.project) {
        counts.set(s.project, (counts.get(s.project) ?? 0) + 1);
      }
    }
    let best = '';
    let bestCount = 0;
    for (const [path, count] of counts) {
      if (count > bestCount) {
        best = path;
        bestCount = count;
      }
    }
    return best;
  }

  async generate(projectName: string, projectPath?: string): Promise<ProjectDigest> {
    const sessions = await this.findSessionsByProjectTag(projectName);
    const resolvedPath = projectPath ?? this.inferProjectPath(sessions);

    if (!resolvedPath) {
      throw new Error(`No project path found for project:${projectName}. Use --path to specify.`);
    }

    const digest = this.buildDigest(projectName, resolvedPath, sessions);
    await this.digestStore.write(resolvedPath, digest);
    return digest;
  }

  async update(projectName: string, projectPath?: string, sessionId?: string): Promise<ProjectDigest> {
    // Need path to read existing digest — try explicit, then infer
    const sessions = await this.findSessionsByProjectTag(projectName);
    const resolvedPath = projectPath ?? this.inferProjectPath(sessions);

    if (!resolvedPath) {
      throw new Error(`No project path found for project:${projectName}. Use --path to specify.`);
    }

    const existing = await this.digestStore.read(resolvedPath);
    if (!existing) return this.generate(projectName, resolvedPath);

    let newSessions: Session[];

    if (sessionId) {
      const session = await this.store.readSession(sessionId);
      newSessions = session ? [session] : [];
    } else {
      const digested = new Set(existing.digestedSessionIds);
      newSessions = sessions.filter(s => !digested.has(s.id));
    }

    if (newSessions.length === 0) return existing;

    let digest = existing;
    for (const session of newSessions) {
      digest = this.mergeSession(digest, session);
    }

    await this.digestStore.write(resolvedPath, digest);
    return digest;
  }

  async show(projectPath: string): Promise<ProjectDigest | null> {
    return this.digestStore.read(projectPath);
  }

  private buildDigest(projectName: string, projectPath: string, sessions: Session[]): ProjectDigest {
    const ids = sessions.map(s => s.id);
    const evolution = this.buildEvolution(sessions);
    const lastSession = sessions[sessions.length - 1];

    return {
      version: 1,
      projectName,
      projectPath,
      lastUpdated: new Date().toISOString(),
      sessionCount: sessions.length,
      digestedSessionIds: ids,
      architecture: {
        current: lastSession?.sections.whatWeAreBuilding ?? '',
        evolution: evolution.slice(-MAX_EVOLUTION),
      },
      decisions: this.aggregateDecisions(sessions).slice(0, MAX_DECISIONS),
      hardLessons: this.aggregateLessons(sessions).slice(0, MAX_LESSONS),
      keyLearnings: this.aggregateLearnings(sessions),
      blockers: lastSession?.sections.blockers ?? [],
      nextSteps: lastSession?.sections.nextStep ? [lastSession.sections.nextStep] : [],
    };
  }

  private mergeSession(digest: ProjectDigest, session: Session): ProjectDigest {
    const sessionId = session.id.slice(0, 8);
    const date = session.createdAt.slice(0, 10);

    const evolution = [...digest.architecture.evolution];
    if (session.sections.whatWeAreBuilding) {
      evolution.push({ date, sessionId, description: session.sections.whatWeAreBuilding });
    }

    const decisions = [...digest.decisions];
    for (const d of session.sections.decisions ?? []) {
      if (!decisions.some(existing => existing.decision === d)) {
        decisions.push({ decision: d, sessionId, date, status: 'active' });
      }
    }

    const lessons = [...digest.hardLessons];
    for (const item of session.sections.whatDidNotWork ?? []) {
      const existing = lessons.find(l => l.lesson === item);
      if (existing) {
        existing.frequency++;
        existing.lastSeen = date;
        if (!existing.sessionIds.includes(sessionId)) {
          existing.sessionIds.push(sessionId);
        }
      } else {
        lessons.push({
          lesson: item,
          frequency: 1,
          sessionIds: [sessionId],
          firstSeen: date,
          lastSeen: date,
        });
      }
    }

    const learnings = this.mergeLearnings(digest.keyLearnings, session, sessionId);

    return {
      ...digest,
      lastUpdated: new Date().toISOString(),
      sessionCount: digest.sessionCount + 1,
      digestedSessionIds: [...digest.digestedSessionIds, session.id],
      architecture: {
        current: session.sections.whatWeAreBuilding ?? digest.architecture.current,
        evolution: evolution.slice(-MAX_EVOLUTION),
      },
      decisions: decisions.slice(0, MAX_DECISIONS),
      hardLessons: lessons
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, MAX_LESSONS),
      keyLearnings: learnings,
      blockers: session.sections.blockers ?? digest.blockers,
      nextSteps: session.sections.nextStep ? [session.sections.nextStep] : digest.nextSteps,
    };
  }

  private buildEvolution(sessions: Session[]): DigestArchitectureEntry[] {
    const entries: DigestArchitectureEntry[] = [];
    for (const s of sessions) {
      if (s.sections.whatWeAreBuilding) {
        entries.push({
          date: s.createdAt.slice(0, 10),
          sessionId: s.id.slice(0, 8),
          description: s.sections.whatWeAreBuilding,
        });
      }
    }
    return entries;
  }

  private aggregateDecisions(sessions: Session[]): DigestDecision[] {
    const seen = new Map<string, DigestDecision>();
    for (const s of sessions) {
      for (const d of s.sections.decisions ?? []) {
        if (!seen.has(d)) {
          seen.set(d, {
            decision: d,
            sessionId: s.id.slice(0, 8),
            date: s.createdAt.slice(0, 10),
            status: 'active',
          });
        }
      }
    }
    return Array.from(seen.values());
  }

  private aggregateLessons(sessions: Session[]): DigestLesson[] {
    const map = new Map<string, DigestLesson>();
    for (const s of sessions) {
      const sessionId = s.id.slice(0, 8);
      const date = s.createdAt.slice(0, 10);
      for (const item of s.sections.whatDidNotWork ?? []) {
        const existing = map.get(item);
        if (existing) {
          existing.frequency++;
          existing.lastSeen = date;
          if (!existing.sessionIds.includes(sessionId)) {
            existing.sessionIds.push(sessionId);
          }
        } else {
          map.set(item, {
            lesson: item,
            frequency: 1,
            sessionIds: [sessionId],
            firstSeen: date,
            lastSeen: date,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.frequency - a.frequency);
  }

  private aggregateLearnings(sessions: Session[]): DigestLearning[] {
    const map = new Map<string, { items: Set<string>; sessionIds: Set<string> }>();

    for (const s of sessions) {
      const kl = s.sections.keyLearnings;
      if (!kl) continue;
      const sessionId = s.id.slice(0, 8);

      if (typeof kl === 'string') {
        const entry = map.get('general') ?? { items: new Set(), sessionIds: new Set() };
        entry.items.add(kl);
        entry.sessionIds.add(sessionId);
        map.set('general', entry);
      } else {
        for (const [category, items] of Object.entries(kl)) {
          const entry = map.get(category) ?? { items: new Set(), sessionIds: new Set() };
          for (const item of items) {
            entry.items.add(item);
          }
          entry.sessionIds.add(sessionId);
          map.set(category, entry);
        }
      }
    }

    return Array.from(map.entries()).map(([category, { items, sessionIds }]) => ({
      category,
      items: Array.from(items),
      sessionIds: Array.from(sessionIds),
    }));
  }

  private mergeLearnings(
    existing: DigestLearning[],
    session: Session,
    sessionId: string,
  ): DigestLearning[] {
    const map = new Map<string, { items: Set<string>; sessionIds: Set<string> }>();

    for (const l of existing) {
      map.set(l.category, {
        items: new Set(l.items),
        sessionIds: new Set(l.sessionIds),
      });
    }

    const kl = session.sections.keyLearnings;
    if (kl) {
      if (typeof kl === 'string') {
        const entry = map.get('general') ?? { items: new Set(), sessionIds: new Set() };
        entry.items.add(kl);
        entry.sessionIds.add(sessionId);
        map.set('general', entry);
      } else {
        for (const [category, items] of Object.entries(kl)) {
          const entry = map.get(category) ?? { items: new Set(), sessionIds: new Set() };
          for (const item of items) {
            entry.items.add(item);
          }
          entry.sessionIds.add(sessionId);
          map.set(category, entry);
        }
      }
    }

    return Array.from(map.entries()).map(([category, { items, sessionIds }]) => ({
      category,
      items: Array.from(items),
      sessionIds: Array.from(sessionIds),
    }));
  }
}
