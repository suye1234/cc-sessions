export interface SessionSections {
  whatWeAreBuilding?: string;
  whatWorked?: string[];
  whatDidNotWork?: string[];
  whatNotTriedYet?: string[];
  fileStates?: FileState[];
  decisions?: string[];
  blockers?: string[];
  nextStep?: string;
  keyLearnings?: string;
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
