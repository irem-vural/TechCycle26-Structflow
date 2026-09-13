// ============================================================
// StructFlow — .sfl native project format (v3)
//
// Zip container with:
//   /project.json   → ProjectPayload (schemaVersion: 3)
//   /metadata.json  → SflowMetadata
//   /assets/...     → reserved for future use
//
// Backward compatible: readSflow accepts legacy plain JSON v2 files too
// (auto-detected by leading '{' byte) and migrates them in-memory.
// ============================================================

import { zipSync, Unzip, UnzipInflate, UnzipPassThrough, strToU8 } from 'fflate';
import {
  CURRENT_SCHEMA_VERSION,
  SFL_EXTENSION,
  SFL_MIME,
  type ProjectPayload,
  type SflowMetadata,
} from './projectTypes';
import { normalizeProjectPayload, sanitizeProjectPayloadForWrite } from './projectPersistence';
import { ProjectDecodeError, isProjectDecodeError } from './projectDecodeError';
import {
  assertSflowSize,
  isSafeSflowEntryName,
  SFLOW_LIMITS,
  type SflowLimits,
} from './sflowLimits';

const APP_VERSION = '0.1.0';

/** Serialize a ProjectPayload as a `.sfl` Uint8Array (zip container). */
export function writeSflow(payload: ProjectPayload): Uint8Array {
  const now = new Date().toISOString();
  const normalized = normalizeProjectPayload(payload);
  const sanitized = sanitizeProjectPayloadForWrite(normalized);
  const versioned: ProjectPayload = {
    ...sanitized,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: now,
  } as ProjectPayload;

  const metadata: SflowMetadata = {
    version: 3,
    units: 'm',
    appVersion: APP_VERSION,
    createdAt: normalized.updatedAt ?? now,
    updatedAt: now,
  };

  const files: Record<string, Uint8Array> = {
    'project.json': strToU8(JSON.stringify(versioned, null, 2)),
    'metadata.json': strToU8(JSON.stringify(metadata, null, 2)),
  };

  return zipSync(files, { level: 6 });
}

/**
 * Parse a `.sfl` Uint8Array. Falls back to legacy JSON v2 if the input
 * starts with `{` (auto-detect). Throws on malformed input.
 */
export function readSflow(
  buffer: Uint8Array | ArrayBuffer,
  /** @internal Injectable limits keep boundary tests small. */
  limits: SflowLimits = SFLOW_LIMITS,
): ProjectPayload {
  const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (view.length === 0) {
    throw new ProjectDecodeError('INVALID_PROJECT', { message: 'Boş dosya.' });
  }
  assertBoundedSize(view.byteLength, limits.maxInputBytes, '.sfl dosyası');
  // Auto-detect plain JSON: starts with '{' or '[' (whitespace-tolerant).
  for (let i = 0; i < Math.min(8, view.length); i++) {
    const b = view[i];
    if (b === 0x09 || b === 0x0a || b === 0x0d || b === 0x20) continue;
    if (b === 0x7b /* '{' */ || b === 0x5b /* '[' */) {
      assertBoundedSize(view.byteLength, limits.maxProjectJsonBytes, 'JSON proje dosyası');
      return decodeProjectJson(view);
    }
    break;
  }

  // Otherwise assume zip container.
  const projectBytes = unzipProjectBounded(view, limits);
  if (!projectBytes) {
    throw new ProjectDecodeError('INVALID_ARCHIVE', {
      path: 'project.json',
      message: 'Geçersiz .sfl dosyası: project.json bulunamadı.',
    });
  }
  assertBoundedSize(projectBytes.byteLength, limits.maxProjectJsonBytes, 'project.json');
  return decodeProjectJson(projectBytes);
}

function decodeProjectJson(bytes: Uint8Array): ProjectPayload {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new ProjectDecodeError('INVALID_UTF8', {
      message: 'Proje metni geçerli UTF-8 değil.',
      cause: error,
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ProjectDecodeError('INVALID_JSON', {
      message: 'Proje JSON verisi geçersiz.',
      cause: error,
    });
  }
  return normalizeProjectPayload(raw);
}

function assertBoundedSize(sizeBytes: number, limitBytes: number, label: string): void {
  try {
    assertSflowSize(sizeBytes, limitBytes, label);
  } catch (error) {
    throw new ProjectDecodeError('TOO_LARGE', {
      path: label,
      message: error instanceof Error ? error.message : `${label} izin verilen boyutu aşıyor.`,
      cause: error,
    });
  }
}

function archiveError(message: string, path = '', cause?: unknown): ProjectDecodeError {
  return new ProjectDecodeError('INVALID_ARCHIVE', { path, message, cause });
}

function unzipProjectBounded(view: Uint8Array, limits: SflowLimits): Uint8Array | undefined {
  const names = new Set<string>();
  let entryCount = 0;
  let expandedBytes = 0;
  let projectBytes: Uint8Array | undefined;
  let extractionError: ProjectDecodeError | null = null;
  const unzip = new Unzip((file) => {
    entryCount += 1;
    if (entryCount > limits.maxEntries) {
      throw archiveError('.sfl arşivi çok fazla dosya içeriyor.');
    }
    if (!isSafeSflowEntryName(file.name)) {
      throw archiveError(`Güvensiz .sfl arşiv yolu: ${file.name}`, file.name);
    }
    if (names.has(file.name)) {
      throw archiveError(`Yinelenen .sfl arşiv girdisi: ${file.name}`, file.name);
    }
    names.add(file.name);
    const entryLimit = file.name === 'project.json'
      ? limits.maxProjectJsonBytes
      : limits.maxEntryBytes;
    if (file.originalSize !== undefined) {
      assertBoundedSize(file.originalSize, entryLimit, file.name);
    }

    const retainEntry = file.name === 'project.json';
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, data, final) => {
      if (error) {
        extractionError = archiveError(`.sfl arşivi açılamadı: ${error.message}`, file.name, error);
        return;
      }
      try {
        size += data.byteLength;
        assertBoundedSize(size, entryLimit, file.name);
        expandedBytes += data.byteLength;
        assertBoundedSize(expandedBytes, limits.maxExpandedBytes, '.sfl açılmış veri');
      } catch (boundaryError) {
        extractionError = isProjectDecodeError(boundaryError)
          ? boundaryError
          : archiveError('.sfl arşivi açılamadı.', file.name, boundaryError);
        throw extractionError;
      }
      if (retainEntry) chunks.push(data);
      if (final && retainEntry) {
        const output = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.byteLength;
        }
        projectBytes = output;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  try {
    unzip.push(view, true);
  } catch (error) {
    if (isProjectDecodeError(error)) throw error;
    throw archiveError('.sfl arşivi açılamadı.', '', error);
  }
  if (extractionError) throw extractionError;
  return projectBytes;
}

/** Convenience: produce a Blob suitable for download in the browser. */
export function sflowBlob(payload: ProjectPayload): Blob {
  const bytes = writeSflow(payload);
  // Wrap in fresh ArrayBuffer for type compatibility (avoid SharedArrayBuffer narrowing).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: SFL_MIME });
}

export { SFL_EXTENSION };
