import { ProjectDecodeError, isProjectDecodeError } from './projectDecodeError';
import type { ProjectDecodeWorkerRequest, ProjectDecodeWorkerResponse } from './projectDecodeProtocol';
import type { ProjectPayload } from './projectTypes';

const MAX_PREVIEW_CONCURRENCY = 4;

export type ProjectDecodePriority = 'open' | 'preview';

export type DecodeProjectOptions = {
  signal?: AbortSignal;
  priority?: ProjectDecodePriority;
};

export type ProjectDecodeWorkerLike = {
  onmessage: ((event: MessageEvent<ProjectDecodeWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ProjectDecodeWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
};

export type ProjectDecodeWorkerFactory = () => ProjectDecodeWorkerLike;

type DecodeTask = {
  id: number;
  buffer: ArrayBuffer;
  priority: ProjectDecodePriority;
  signal?: AbortSignal;
  onAbort?: () => void;
  resolve: (payload: ProjectPayload) => void;
  reject: (error: ProjectDecodeError) => void;
};

type WorkerSlot = {
  worker: ProjectDecodeWorkerLike;
  task: DecodeTask | null;
};

function defaultWorkerFactory(): ProjectDecodeWorkerLike {
  return new Worker(new URL('./projectDecode.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function cancelledError(): ProjectDecodeError {
  return new ProjectDecodeError('CANCELLED');
}

function transferableBuffer(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (
    bytes.buffer instanceof ArrayBuffer
    && bytes.byteOffset === 0
    && bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  return bytes.slice().buffer as ArrayBuffer;
}

export class ProjectDecodeClient {
  private readonly workerFactory: ProjectDecodeWorkerFactory;
  private readonly maxConcurrency: number;
  private readonly pending: DecodeTask[] = [];
  private readonly slots: WorkerSlot[] = [];
  private nextTaskId = 1;
  private disposed = false;

  constructor(options: {
    workerFactory?: ProjectDecodeWorkerFactory;
    maxConcurrency?: number;
  } = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.maxConcurrency = Math.max(
      1,
      Math.min(MAX_PREVIEW_CONCURRENCY, Math.floor(options.maxConcurrency ?? MAX_PREVIEW_CONCURRENCY)),
    );
  }

  decodeProject(
    bytes: Uint8Array | ArrayBuffer,
    options: DecodeProjectOptions = {},
  ): Promise<ProjectPayload> {
    if (this.disposed || options.signal?.aborted) {
      return Promise.reject(cancelledError());
    }

    const taskId = this.nextTaskId;
    this.nextTaskId += 1;
    return new Promise<ProjectPayload>((resolve, reject) => {
      const task: DecodeTask = {
        id: taskId,
        buffer: transferableBuffer(bytes),
        priority: options.priority ?? 'open',
        signal: options.signal,
        resolve,
        reject,
      };
      if (task.signal) {
        task.onAbort = () => this.cancelTask(task);
        task.signal.addEventListener('abort', task.onAbort, { once: true });
      }
      this.pending.push(task);
      if (task.priority === 'open') this.preemptPreviewForOpen();
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const task of this.pending.splice(0)) {
      this.finishTask(task, cancelledError());
    }
    for (const slot of [...this.slots]) {
      if (slot.task) this.finishTask(slot.task, cancelledError());
      this.destroySlot(slot);
    }
  }

  private preemptPreviewForOpen(): void {
    const hasCapacity = this.slots.some((slot) => slot.task === null)
      || this.slots.length < this.maxConcurrency;
    if (hasCapacity) return;
    const previewSlot = [...this.slots]
      .reverse()
      .find((slot) => slot.task?.priority === 'preview');
    if (!previewSlot?.task) return;
    const previewTask = previewSlot.task;
    previewSlot.task = null;
    this.finishTask(previewTask, cancelledError());
    this.destroySlot(previewSlot);
  }

  private cancelTask(task: DecodeTask): void {
    const pendingIndex = this.pending.indexOf(task);
    if (pendingIndex >= 0) {
      this.pending.splice(pendingIndex, 1);
      this.finishTask(task, cancelledError());
      return;
    }
    const slot = this.slots.find((candidate) => candidate.task === task);
    if (!slot) return;
    slot.task = null;
    this.finishTask(task, cancelledError());
    this.destroySlot(slot);
    this.pump();
  }

  private pump(): void {
    if (this.disposed) return;
    while (this.pending.length > 0) {
      const task = this.takeNextTask();
      if (!task) return;
      let slot = this.slots.find((candidate) => candidate.task === null);
      if (!slot && this.slots.length < this.maxConcurrency) {
        try {
          slot = this.createSlot();
        } catch (error) {
          this.finishTask(task, new ProjectDecodeError('INVALID_PROJECT', {
            message: error instanceof Error ? error.message : 'Proje çözümleme worker’ı başlatılamadı.',
            cause: error,
          }));
          continue;
        }
      }
      if (!slot) {
        this.pending.push(task);
        return;
      }
      if (task.signal?.aborted) {
        this.finishTask(task, cancelledError());
        continue;
      }
      slot.task = task;
      try {
        slot.worker.postMessage(
          { id: task.id, buffer: task.buffer },
          [task.buffer],
        );
      } catch (error) {
        slot.task = null;
        this.finishTask(task, new ProjectDecodeError('INVALID_PROJECT', {
          message: 'Proje dosyası worker’a aktarılamadı.',
          cause: error,
        }));
        this.destroySlot(slot);
      }
    }
  }

  private takeNextTask(): DecodeTask | undefined {
    const openIndex = this.pending.findIndex((task) => task.priority === 'open');
    const index = openIndex >= 0 ? openIndex : 0;
    return this.pending.splice(index, 1)[0];
  }

  private createSlot(): WorkerSlot {
    const worker = this.workerFactory();
    const slot: WorkerSlot = { worker, task: null };
    worker.onmessage = (event) => this.handleWorkerMessage(slot, event.data);
    worker.onerror = (event) => this.handleWorkerError(slot, event.message);
    this.slots.push(slot);
    return slot;
  }

  private handleWorkerMessage(slot: WorkerSlot, response: ProjectDecodeWorkerResponse): void {
    const task = slot.task;
    if (!task || response.id !== task.id) return;
    slot.task = null;
    if (response.ok) {
      this.finishTask(task, undefined, response.payload);
    } else {
      this.finishTask(task, new ProjectDecodeError(response.error.code, {
        path: response.error.path,
        message: response.error.message,
      }));
    }
    this.pump();
  }

  private handleWorkerError(slot: WorkerSlot, message?: string): void {
    const task = slot.task;
    slot.task = null;
    if (task) {
      this.finishTask(task, new ProjectDecodeError('INVALID_PROJECT', {
        message: message || 'Proje çözümleme worker’ı beklenmeyen bir hata verdi.',
      }));
    }
    this.destroySlot(slot);
    this.pump();
  }

  private finishTask(
    task: DecodeTask,
    error?: ProjectDecodeError,
    payload?: ProjectPayload,
  ): void {
    if (task.signal && task.onAbort) {
      task.signal.removeEventListener('abort', task.onAbort);
    }
    if (error) {
      task.reject(error);
    } else if (payload) {
      task.resolve(payload);
    }
  }

  private destroySlot(slot: WorkerSlot): void {
    const index = this.slots.indexOf(slot);
    if (index >= 0) this.slots.splice(index, 1);
    slot.worker.onmessage = null;
    slot.worker.onerror = null;
    slot.worker.terminate();
  }
}

export function projectDecodeUserMessage(error: unknown): string | null {
  if (!isProjectDecodeError(error)) return 'Proje dosyası çözümlenemedi.';
  switch (error.code) {
    case 'CANCELLED':
      return null;
    case 'UNSUPPORTED_VERSION':
      return 'Bu proje daha yeni bir StructFlow sürümü gerektiriyor.';
    case 'TOO_LARGE':
      return 'Proje dosyası izin verilen boyutu aşıyor.';
    case 'INVALID_ARCHIVE':
    case 'INVALID_UTF8':
    case 'INVALID_JSON':
    case 'INVALID_PROJECT':
      return `Proje dosyası bozuk veya geçersiz${error.path ? ` (${error.path})` : ''}.`;
  }
}
