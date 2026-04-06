export interface SessionSections {
  whatWeAreBuilding?: string;
  whatWorked?: string[];
  whatDidNotWork?: string[];
  whatNotTriedYet?: string[];
  fileStates?: FileState[];
  decisions?: string[];
  blockers?: string[];
  nextStep?: string;
  keyLearnings?: string | Record<string, string[]>;
}

export interface FileState {
  path: string;
  status: 'complete' | 'in-progress' | 'broken' | 'not-started';
  notes: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: string[];
}

export interface Session {
  id: string;
  title: string;
  topic: string;
  project: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
  sections: SessionSections;
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface SessionSummary {
  id: string;
  title: string;
  topic: string;
  project: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary?: string;
  hasSections: boolean;
}

export interface SessionIndex {
  version: number;
  sessions: SessionSummary[];
}

export interface SessionFilter {
  tag?: string;
  project?: string;
  from?: string;
  to?: string;
  query?: string;
}

export interface SearchResult {
  session: SessionSummary;
  matches: SearchMatch[];
}

export interface SearchMatch {
  messageIndex: number;
  role: Message['role'];
  snippet: string;
}

export interface CreateSessionOptions {
  title: string;
  topic?: string;
  project?: string;
  tags?: string[];
  summary?: string;
  sections?: SessionSections;
  metadata?: Record<string, unknown>;
}

// Session quality validation

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateSession(opts: { title?: string; sections?: SessionSections }): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const sec = opts.sections;

  if (!opts.title || opts.title.trim().length < 5) {
    warnings.push({ field: 'title', message: 'Title too short (min 5 chars)', severity: 'error' });
  }

  if (!sec) {
    warnings.push({ field: 'sections', message: 'No sections provided — session has no structured content', severity: 'warning' });
    return warnings;
  }

  if (!sec.whatWeAreBuilding?.trim()) {
    warnings.push({ field: 'whatWeAreBuilding', message: 'Missing — what was this session about?', severity: 'warning' });
  }

  if (!sec.whatWorked?.length && !sec.whatDidNotWork?.length) {
    warnings.push({ field: 'whatWorked/whatDidNotWork', message: 'No outcomes recorded — add what worked or what failed', severity: 'warning' });
  }

  if (!sec.nextStep?.trim()) {
    warnings.push({ field: 'nextStep', message: 'Missing — what should happen next?', severity: 'warning' });
  }

  if (!sec.decisions?.length) {
    warnings.push({ field: 'decisions', message: 'No decisions recorded', severity: 'warning' });
  }

  if (!sec.keyLearnings) {
    warnings.push({ field: 'keyLearnings', message: 'No key learnings recorded', severity: 'warning' });
  }

  return warnings;
}

// Project Digest types

export interface DigestArchitectureEntry {
  date: string;
  sessionId: string;
  description: string;
}

export interface DigestDecision {
  decision: string;
  sessionId: string;
  date: string;
  status: 'active' | 'reversed' | 'superseded';
}

export interface DigestLesson {
  lesson: string;
  frequency: number;
  sessionIds: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface DigestLearning {
  category: string;
  items: string[];
  sessionIds: string[];
}

export interface ProjectDigest {
  version: 1;
  projectName: string;
  projectPath: string;
  lastUpdated: string;
  sessionCount: number;
  digestedSessionIds: string[];

  architecture: {
    current: string;
    evolution: DigestArchitectureEntry[];
  };

  decisions: DigestDecision[];
  hardLessons: DigestLesson[];
  keyLearnings: DigestLearning[];
  blockers: string[];
  nextSteps: string[];
}

export interface DigestDiff {
  newDecisions: number;
  newLessons: number;
  newLearningCategories: number;
  newLearningItems: number;
  architectureUpdated: boolean;
  newSessions: number;
}

export function computeDigestDiff(before: ProjectDigest | null, after: ProjectDigest): DigestDiff {
  if (!before) {
    return {
      newDecisions: after.decisions.length,
      newLessons: after.hardLessons.length,
      newLearningCategories: after.keyLearnings.length,
      newLearningItems: after.keyLearnings.reduce((sum, l) => sum + l.items.length, 0),
      architectureUpdated: !!after.architecture.current,
      newSessions: after.sessionCount,
    };
  }

  const beforeLearningItems = before.keyLearnings.reduce((sum, l) => sum + l.items.length, 0);
  const afterLearningItems = after.keyLearnings.reduce((sum, l) => sum + l.items.length, 0);

  return {
    newDecisions: after.decisions.length - before.decisions.length,
    newLessons: after.hardLessons.length - before.hardLessons.length,
    newLearningCategories: after.keyLearnings.length - before.keyLearnings.length,
    newLearningItems: afterLearningItems - beforeLearningItems,
    architectureUpdated: after.architecture.current !== before.architecture.current,
    newSessions: after.sessionCount - before.sessionCount,
  };
}
