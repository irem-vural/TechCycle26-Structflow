import { promises as fs } from 'fs';
import * as path from 'path';
import type { ProjectType, RecentProjectDescriptor } from '../../src/core/desktop/desktopContracts';

type StoredRecentProject = RecentProjectDescriptor;

export class RecentProjectStore {
  private loaded = false;
  private readonly entries = new Map<string, StoredRecentProject>();

  constructor(
    private readonly storagePath: string,
    private readonly idFactory: () => string,
    private readonly maxEntries = 20,
  ) {}

  async list(): Promise<RecentProjectDescriptor[]> {
    await this.ensureLoaded();
    return [...this.entries.values()].sort((a, b) => b.at.localeCompare(a.at));
  }

  async remember(filePath: string, name: string, at: string, projectType?: ProjectType): Promise<RecentProjectDescriptor> {
    await this.ensureLoaded();
    const existing = [...this.entries.values()].find((entry) => path.resolve(entry.filePath) === path.resolve(filePath));
    const entry: StoredRecentProject = {
      id: existing?.id ?? this.idFactory(),
      name,
      filePath,
      at,
      projectType,
    };
    this.entries.set(entry.id, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = [...this.entries.values()].sort((a, b) => a.at.localeCompare(b.at))[0];
      if (!oldest) break;
      this.entries.delete(oldest.id);
    }
    await this.persist();
    return entry;
  }

  async get(id: string): Promise<RecentProjectDescriptor | null> {
    await this.ensureLoaded();
    return this.entries.get(id) ?? null;
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded();
    this.entries.delete(id);
    await this.persist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(await fs.readFile(this.storagePath, 'utf8')) as unknown;
      if (!Array.isArray(raw)) return;
      for (const value of raw) {
        if (!isRecentProject(value)) continue;
        this.entries.set(value.id, value);
      }
    } catch {
      // Missing or corrupt recents must not prevent the application from opening.
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    await fs.writeFile(this.storagePath, JSON.stringify([...this.entries.values()], null, 2), 'utf8');
  }
}

function isRecentProject(value: unknown): value is RecentProjectDescriptor {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RecentProjectDescriptor>;
  return typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.filePath === 'string' &&
    typeof candidate.at === 'string';
}
