import * as path from 'path';
import { promises as fs } from 'fs';
import type { ProjectSaveToken } from '../../src/core/desktop/desktopContracts';

export type AtomicWriteResult =
  | { written: true; path: string; token?: ProjectSaveToken }
  | {
      written: false;
      reason: 'stale-save-token' | 'retired-save-session';
      path: string;
      token: ProjectSaveToken;
    };

type FileHandleLike = { sync: () => Promise<void>; close: () => Promise<void> };

export type AtomicFileSystem = {
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
  open: (filePath: string, flags: string) => Promise<FileHandleLike>;
  rename: typeof fs.rename;
  unlink: typeof fs.unlink;
};

const defaultFileSystem: AtomicFileSystem = {
  mkdir: fs.mkdir,
  writeFile: fs.writeFile,
  open: async (filePath, flags) => fs.open(filePath, flags),
  rename: fs.rename,
  unlink: fs.unlink,
};

type PathSaveOwnership = {
  activeDocumentSessionId: string;
  latestRequestSequence: number;
  retiredDocumentSessionIds: Set<string>;
};

type SaveOwnershipEvaluation =
  | { accepted: true; nextOwnership: PathSaveOwnership }
  | {
      accepted: false;
      result: Extract<AtomicWriteResult, { written: false }>;
    };

/**
 * Serialises writes per destination and replaces files through a temporary
 * sibling. This keeps a crash or a failed write from leaving a half-written
 * project behind. Save request sequences are monotonic within the active
 * document session. A newly opened document session can take path ownership,
 * while retired sessions can never reclaim it with a delayed write.
 */
export class AtomicFileWriter {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly saveOwnership = new Map<string, PathSaveOwnership>();

  constructor(
    private readonly fileSystem: AtomicFileSystem = defaultFileSystem,
    private readonly tempIdFactory: () => string = () => `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  ) {}

  write(
    filePath: string,
    bytes: Uint8Array,
    token?: ProjectSaveToken,
  ): Promise<AtomicWriteResult> {
    const targetPath = path.resolve(filePath);
    const previous = this.queues.get(targetPath) ?? Promise.resolve();
    const operation = previous.then(() => this.writeQueued(targetPath, bytes, token));
    const queued = operation.catch(() => undefined);
    this.queues.set(targetPath, queued);
    return operation.finally(() => {
      if (this.queues.get(targetPath) === queued) this.queues.delete(targetPath);
    });
  }

  private async writeQueued(
    targetPath: string,
    bytes: Uint8Array,
    token?: ProjectSaveToken,
  ): Promise<AtomicWriteResult> {
    const ownershipEvaluation = token
      ? this.evaluateSaveRequest(targetPath, token)
      : null;
    if (ownershipEvaluation && !ownershipEvaluation.accepted) {
      return ownershipEvaluation.result;
    }

    const directory = path.dirname(targetPath);
    const temporaryPath = path.join(directory, `.${path.basename(targetPath)}.${this.tempIdFactory()}.tmp`);
    const backupPath = path.join(directory, `.${path.basename(targetPath)}.${this.tempIdFactory()}.bak`);
    let backupCreated = false;
    let handle: FileHandleLike | null = null;

    try {
      await this.fileSystem.mkdir(directory, { recursive: true });
      await this.fileSystem.writeFile(temporaryPath, bytes);
      handle = await this.fileSystem.open(temporaryPath, 'r+');
      await handle.sync();
      await handle.close();
      handle = null;

      try {
        await this.fileSystem.rename(targetPath, backupPath);
        backupCreated = true;
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }

      try {
        await this.fileSystem.rename(temporaryPath, targetPath);
      } catch (error) {
        if (backupCreated) {
          await this.fileSystem.rename(backupPath, targetPath).catch(() => undefined);
        }
        throw error;
      }

      if (ownershipEvaluation?.accepted) {
        this.saveOwnership.set(targetPath, ownershipEvaluation.nextOwnership);
      }
      if (backupCreated) await this.fileSystem.unlink(backupPath).catch(() => undefined);
      return { written: true, path: targetPath, ...(token ? { token } : {}) };
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await this.fileSystem.unlink(temporaryPath).catch(() => undefined);
    }
  }

  private evaluateSaveRequest(
    targetPath: string,
    token: ProjectSaveToken,
  ): SaveOwnershipEvaluation {
    const ownership = this.saveOwnership.get(targetPath);
    if (!ownership) {
      return {
        accepted: true,
        nextOwnership: {
          activeDocumentSessionId: token.documentSessionId,
          latestRequestSequence: token.requestSequence,
          retiredDocumentSessionIds: new Set(),
        },
      };
    }

    if (ownership.activeDocumentSessionId === token.documentSessionId) {
      if (token.requestSequence <= ownership.latestRequestSequence) {
        return {
          accepted: false,
          result: {
            written: false,
            reason: 'stale-save-token',
            path: targetPath,
            token,
          },
        };
      }
      return {
        accepted: true,
        nextOwnership: {
          ...ownership,
          latestRequestSequence: token.requestSequence,
          retiredDocumentSessionIds: new Set(ownership.retiredDocumentSessionIds),
        },
      };
    }

    if (ownership.retiredDocumentSessionIds.has(token.documentSessionId)) {
      return {
        accepted: false,
        result: {
          written: false,
          reason: 'retired-save-session',
          path: targetPath,
          token,
        },
      };
    }

    return {
      accepted: true,
      nextOwnership: {
        activeDocumentSessionId: token.documentSessionId,
        latestRequestSequence: token.requestSequence,
        retiredDocumentSessionIds: new Set([
          ...ownership.retiredDocumentSessionIds,
          ownership.activeDocumentSessionId,
        ]),
      },
    };
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT';
}
