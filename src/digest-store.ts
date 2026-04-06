import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ProjectDigest } from './types.js';

const DIGEST_FILE = 'project-digest.json';
const CLAUDE_DIR = '.claude';

export class DigestStore {
  private digestPath(projectPath: string): string {
    return join(projectPath, CLAUDE_DIR, DIGEST_FILE);
  }

  async ensureDir(projectPath: string): Promise<void> {
    await mkdir(join(projectPath, CLAUDE_DIR), { recursive: true });
  }

  async read(projectPath: string): Promise<ProjectDigest | null> {
    try {
      const raw = await readFile(this.digestPath(projectPath), 'utf-8');
      return JSON.parse(raw) as ProjectDigest;
    } catch {
      return null;
    }
  }

  async write(projectPath: string, digest: ProjectDigest): Promise<void> {
    await this.ensureDir(projectPath);
    const target = this.digestPath(projectPath);
    const tmpPath = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmpPath, JSON.stringify(digest, null, 2), 'utf-8');
    await rename(tmpPath, target);
  }
}
