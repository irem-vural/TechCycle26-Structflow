import * as path from 'path';
import { randomUUID } from 'crypto';

export const FILE_LIMITS = {
  maxProjectInputBytes: 128 * 1024 * 1024,
  maxProjectJsonBytes: 64 * 1024 * 1024,
  maxExpandedProjectBytes: 256 * 1024 * 1024,
  maxProjectArchiveEntries: 32,
  capabilityTtlMs: 30 * 60 * 1000,
} as const;

export type CapabilityKind = 'project';

export type FileCapability = {
  id: string;
  kind: CapabilityKind;
  filePath: string;
  fileName: string;
  grantedAt: number;
  expiresAt: number;
};

export function projectExtension(filePath: string): 'srw' | 'sfl' | 'sflow' | 'json' | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.srw') return 'srw';
  if (extension === '.sfl') return 'sfl';
  if (extension === '.sflow') return 'sflow';
  return extension === '.json' ? 'json' : null;
}

export function assertBoundedSize(sizeBytes: number, limitBytes: number, label: string): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) throw new Error(`${label} boyutu geçersiz.`);
  if (sizeBytes > limitBytes) throw new Error(`${label} izin verilen boyutu aşıyor.`);
}

export class FileCapabilityStore {
  private readonly capabilities = new Map<string, FileCapability>();

  constructor(
    private readonly idFactory: () => string = randomUUID,
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = FILE_LIMITS.capabilityTtlMs,
  ) {}

  grant(filePath: string, kind: CapabilityKind): FileCapability {
    const fileName = path.basename(filePath);
    const grantedAt = this.now();
    const capability: FileCapability = {
      id: this.idFactory(),
      kind,
      filePath: path.resolve(filePath),
      fileName,
      grantedAt,
      expiresAt: grantedAt + this.ttlMs,
    };
    this.capabilities.set(capability.id, capability);
    return capability;
  }

  resolve(id: string, kind: CapabilityKind): FileCapability | null {
    const capability = this.capabilities.get(id);
    if (!capability || capability.kind !== kind) return null;
    if (capability.expiresAt <= this.now()) {
      this.capabilities.delete(id);
      return null;
    }
    return capability;
  }

  revoke(id: string): void {
    this.capabilities.delete(id);
  }

  clearExpired(): void {
    const now = this.now();
    for (const [id, capability] of this.capabilities) {
      if (capability.expiresAt <= now) this.capabilities.delete(id);
    }
  }
}
