export { Store } from './store.js';
export { SessionManager } from './session.js';
export { SearchEngine } from './search.js';
export { DigestManager } from './digest.js';
export { DigestStore } from './digest-store.js';
export type {
  Session,
  Message,
  SessionSummary,
  SessionIndex,
  SessionFilter,
  SearchResult,
  SearchMatch,
  CreateSessionOptions,
  ProjectDigest,
  DigestDecision,
  DigestLesson,
  DigestArchitectureEntry,
  DigestLearning,
  DigestDiff,
  ValidationWarning,
  validateSession,
  computeDigestDiff,
} from './types.js';
export type { DigestUpdateResult } from './digest.js';
