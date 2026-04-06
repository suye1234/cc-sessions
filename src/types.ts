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
