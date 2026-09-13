/** Limits applied before parsing or expanding untrusted project archives. */
export type SflowLimits = {
  readonly maxInputBytes: number;
  readonly maxProjectJsonBytes: number;
  readonly maxEntryBytes: number;
  readonly maxExpandedBytes: number;
  readonly maxEntries: number;
};

export const SFLOW_LIMITS: SflowLimits = {
  maxInputBytes: 128 * 1024 * 1024,
  maxProjectJsonBytes: 64 * 1024 * 1024,
  maxEntryBytes: 256 * 1024 * 1024,
  maxExpandedBytes: 256 * 1024 * 1024,
  maxEntries: 32,
};

export function assertSflowSize(sizeBytes: number, limitBytes: number, label: string): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error(`${label} boyutu geçersiz.`);
  }
  if (sizeBytes > limitBytes) {
    throw new Error(`${label} izin verilen boyutu aşıyor.`);
  }
}

export function isSafeSflowEntryName(name: string): boolean {
  if (!name || name.includes('\0') || name.includes('\\')) return false;
  if (name.startsWith('/') || /^[A-Za-z]:\//.test(name)) return false;
  const segments = name.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
  return true;
}
