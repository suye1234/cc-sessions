import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { SessionManager } from '../src/session.js';
import { DigestManager } from '../src/digest.js';
import { DigestStore } from '../src/digest-store.js';
import { validateSession, computeDigestDiff } from '../src/types.js';
import type { Session, ProjectDigest } from '../src/types.js';

const PROJECT_NAME = 'testproj';
const PROJECT_TAG = `project:${PROJECT_NAME}`;

describe('DigestStore', () => {
  let projectDir: string;
  let digestStore: DigestStore;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'digest-project-'));
    digestStore = new DigestStore();
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns null when no digest exists', async () => {
    expect(await digestStore.read(projectDir)).toBeNull();
  });

  it('writes and reads digest', async () => {
    const digest: ProjectDigest = {
      version: 1,
      projectName: PROJECT_NAME,
      projectPath: projectDir,
      lastUpdated: '2026-04-01T00:00:00Z',
      sessionCount: 1,
      digestedSessionIds: ['abc'],
      architecture: { current: 'test', evolution: [] },
      decisions: [],
      hardLessons: [],
      keyLearnings: [],
      blockers: [],
      nextSteps: [],
    };

    await digestStore.write(projectDir, digest);
    const read = await digestStore.read(projectDir);
    expect(read).toEqual(digest);
  });

  it('creates .claude directory if missing', async () => {
    const digest: ProjectDigest = {
      version: 1,
      projectName: PROJECT_NAME,
      projectPath: projectDir,
      lastUpdated: '2026-04-01T00:00:00Z',
      sessionCount: 0,
      digestedSessionIds: [],
      architecture: { current: '', evolution: [] },
      decisions: [],
      hardLessons: [],
      keyLearnings: [],
      blockers: [],
      nextSteps: [],
    };

    await digestStore.write(projectDir, digest);
    const raw = await readFile(join(projectDir, '.claude', 'project-digest.json'), 'utf-8');
    expect(JSON.parse(raw).version).toBe(1);
  });
});

describe('DigestManager', () => {
  let dataDir: string;
  let projectDir: string;
  let store: Store;
  let manager: SessionManager;
  let digestManager: DigestManager;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'sessions-data-'));
    projectDir = await mkdtemp(join(tmpdir(), 'digest-project-'));
    store = new Store(dataDir);
    manager = new SessionManager(store);
    await manager.init();
    digestManager = new DigestManager(manager, store);
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  });

  describe('generate', () => {
    it('creates digest from sessions with project:<name> tag', async () => {
      await manager.create({
        title: 'Session A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatWeAreBuilding: 'Building X', decisions: ['Use TypeScript'] },
      });
      await manager.create({
        title: 'Session B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatWeAreBuilding: 'Building X v2', decisions: ['Use Vitest'] },
      });
      await manager.create({
        title: 'Other project',
        project: '/tmp/other',
        tags: ['project:other'],
        sections: { decisions: ['Use Python'] },
      });

      const { digest, diff } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.sessionCount).toBe(2);
      expect(digest.projectName).toBe(PROJECT_NAME);
      expect(digest.architecture.current).toBe('Building X v2');
      expect(digest.decisions).toHaveLength(2);
      expect(digest.decisions.map(d => d.decision)).toContain('Use TypeScript');
      expect(digest.decisions.map(d => d.decision)).not.toContain('Use Python');
      expect(diff.newDecisions).toBe(2);
      expect(diff.newSessions).toBe(2);
    });

    it('infers project path from sessions', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['X'] },
      });

      // No explicit path — should infer from session's project field
      const { digest } = await digestManager.generate(PROJECT_NAME);
      expect(digest.projectPath).toBe(projectDir);
    });

    it('builds architecture timeline', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatWeAreBuilding: 'v1 design' },
      });
      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatWeAreBuilding: 'v2 redesign' },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.architecture.evolution).toHaveLength(2);
      expect(digest.architecture.evolution[0].description).toBe('v1 design');
      expect(digest.architecture.evolution[1].description).toBe('v2 redesign');
      expect(digest.architecture.current).toBe('v2 redesign');
    });

    it('deduplicates exact decisions', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON', 'Use JSON'] },
      });
      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON', 'Zero deps'] },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.decisions).toHaveLength(2);
    });

    it('counts hard lesson frequency', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatDidNotWork: ['tsx -e fails', 'Bad import'] },
      });
      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { whatDidNotWork: ['tsx -e fails'] },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      const tsxLesson = digest.hardLessons.find(l => l.lesson === 'tsx -e fails');
      expect(tsxLesson?.frequency).toBe(2);
      expect(tsxLesson?.sessionIds).toHaveLength(2);

      const badImport = digest.hardLessons.find(l => l.lesson === 'Bad import');
      expect(badImport?.frequency).toBe(1);
    });

    it('handles string keyLearnings', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { keyLearnings: 'Important lesson here' },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.keyLearnings).toHaveLength(1);
      expect(digest.keyLearnings[0].category).toBe('general');
      expect(digest.keyLearnings[0].items).toContain('Important lesson here');
    });

    it('handles Record keyLearnings and merges by category', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: {
          keyLearnings: {
            'TypeScript': ['Use strict mode', 'Avoid any'],
            'Testing': ['Use vitest'],
          },
        },
      });
      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: {
          keyLearnings: {
            'TypeScript': ['Avoid any', 'Use generics'],
            'Design': ['Keep it simple'],
          },
        },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      const ts = digest.keyLearnings.find(l => l.category === 'TypeScript');
      expect(ts?.items).toHaveLength(3);
      expect(ts?.items).toContain('Use strict mode');
      expect(ts?.items).toContain('Avoid any');
      expect(ts?.items).toContain('Use generics');

      const design = digest.keyLearnings.find(l => l.category === 'Design');
      expect(design?.items).toContain('Keep it simple');
    });

    it('returns empty digest when no sessions match', async () => {
      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.sessionCount).toBe(0);
      expect(digest.decisions).toEqual([]);
      expect(digest.architecture.current).toBe('');
    });

    it('captures blockers and nextStep from latest session', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { blockers: ['old blocker'], nextStep: 'old step' },
      });
      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { blockers: ['new blocker'], nextStep: 'new step' },
      });

      const { digest } = await digestManager.generate(PROJECT_NAME, projectDir);
      expect(digest.blockers).toEqual(['new blocker']);
      expect(digest.nextSteps).toEqual(['new step']);
    });
  });

  describe('update', () => {
    it('falls back to generate when no existing digest', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'] },
      });

      const { digest } = await digestManager.update(PROJECT_NAME, projectDir);
      expect(digest.sessionCount).toBe(1);
      expect(digest.decisions[0].decision).toBe('Use JSON');
    });

    it('incrementally updates with new session', async () => {
      const s1 = await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'] },
      });

      await digestManager.generate(PROJECT_NAME, projectDir);

      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Add tests'], whatDidNotWork: ['tsx -e fails'] },
      });

      const { digest } = await digestManager.update(PROJECT_NAME, projectDir);
      expect(digest.sessionCount).toBe(2);
      expect(digest.decisions).toHaveLength(2);
      expect(digest.hardLessons).toHaveLength(1);
      expect(digest.digestedSessionIds).toContain(s1.id);
    });

    it('skips already-digested sessions', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'] },
      });

      const { digest: d1 } = await digestManager.generate(PROJECT_NAME, projectDir);
      const { digest: d2 } = await digestManager.update(PROJECT_NAME, projectDir);
      expect(d2.sessionCount).toBe(d1.sessionCount);
    });

    it('updates specific session when session-id provided', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Old'] },
      });

      await digestManager.generate(PROJECT_NAME, projectDir);

      const s2 = await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['New'] },
      });

      const { digest } = await digestManager.update(PROJECT_NAME, projectDir, s2.id);
      expect(digest.decisions.map(d => d.decision)).toContain('New');
    });
  });

  describe('show', () => {
    it('returns null when no digest exists', async () => {
      expect(await digestManager.show(projectDir)).toBeNull();
    });

    it('returns existing digest', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'] },
      });

      await digestManager.generate(PROJECT_NAME, projectDir);
      const digest = await digestManager.show(projectDir);
      expect(digest?.sessionCount).toBe(1);
    });
  });

  describe('diff', () => {
    it('reports changes after incremental update', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'], whatDidNotWork: ['Bad approach'] },
      });

      await digestManager.generate(PROJECT_NAME, projectDir);

      await manager.create({
        title: 'B',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: {
          decisions: ['Add tests', 'Use vitest'],
          whatDidNotWork: ['tsx -e fails'],
          keyLearnings: { 'Testing': ['Write tests first'] },
        },
      });

      const { diff } = await digestManager.update(PROJECT_NAME, projectDir);
      expect(diff.newSessions).toBe(1);
      expect(diff.newDecisions).toBe(2);
      expect(diff.newLessons).toBe(1);
      expect(diff.newLearningItems).toBeGreaterThan(0);
    });

    it('reports no changes when nothing new', async () => {
      await manager.create({
        title: 'A',
        project: projectDir,
        tags: [PROJECT_TAG],
        sections: { decisions: ['Use JSON'] },
      });

      await digestManager.generate(PROJECT_NAME, projectDir);
      const { diff } = await digestManager.update(PROJECT_NAME, projectDir);
      expect(diff.newSessions).toBe(0);
      expect(diff.newDecisions).toBe(0);
    });
  });
});

describe('validateSession', () => {
  it('returns no warnings for complete session', () => {
    const warnings = validateSession({
      title: 'Good title here',
      sections: {
        whatWeAreBuilding: 'Building something',
        whatWorked: ['Item 1'],
        decisions: ['Decision 1'],
        nextStep: 'Do next thing',
        keyLearnings: 'Learned something',
      },
    });
    expect(warnings).toEqual([]);
  });

  it('returns error for short title', () => {
    const warnings = validateSession({ title: 'Hi' });
    expect(warnings.some(w => w.field === 'title' && w.severity === 'error')).toBe(true);
  });

  it('warns on missing sections', () => {
    const warnings = validateSession({ title: 'Valid title here' });
    expect(warnings.some(w => w.field === 'sections')).toBe(true);
  });

  it('warns on missing whatWeAreBuilding', () => {
    const warnings = validateSession({
      title: 'Valid title here',
      sections: { whatWorked: ['Item'], decisions: ['D'], nextStep: 'Next', keyLearnings: 'L' },
    });
    expect(warnings.some(w => w.field === 'whatWeAreBuilding')).toBe(true);
  });

  it('warns on missing nextStep', () => {
    const warnings = validateSession({
      title: 'Valid title here',
      sections: { whatWeAreBuilding: 'X', whatWorked: ['Y'], decisions: ['D'], keyLearnings: 'L' },
    });
    expect(warnings.some(w => w.field === 'nextStep')).toBe(true);
  });

  it('warns when no outcomes recorded', () => {
    const warnings = validateSession({
      title: 'Valid title here',
      sections: { whatWeAreBuilding: 'X', decisions: ['D'], nextStep: 'N', keyLearnings: 'L' },
    });
    expect(warnings.some(w => w.field === 'whatWorked/whatDidNotWork')).toBe(true);
  });
});
