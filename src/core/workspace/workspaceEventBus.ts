export type WorkspaceFocusDetail = {
  elementIds?: string[];
  geometry?: {
    point?: { x: number; y: number };
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    points?: Array<{ x: number; y: number }>;
    bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  };
  location?: { x: number; y: number };
};

export type WorkspaceEventMap = {
  'workspace-ready': void;
  'canvas-warning': string;
  'focus-elements': WorkspaceFocusDetail;
};

export type WorkspaceEventBus = {
  emit<K extends keyof WorkspaceEventMap>(
    type: K,
    ...detail: WorkspaceEventMap[K] extends void ? [] : [detail: WorkspaceEventMap[K]]
  ): void;
  on<K extends keyof WorkspaceEventMap>(type: K, listener: (detail: WorkspaceEventMap[K]) => void): () => void;
  dispose(): void;
};

export function createWorkspaceEventBus(): WorkspaceEventBus {
  const listeners = new Map<keyof WorkspaceEventMap, Set<(detail: never) => void>>();
  return {
    emit(type, ...args) {
      const detail = args[0] as never;
      for (const listener of listeners.get(type) ?? []) listener(detail);
    },
    on(type, listener) {
      const entries = listeners.get(type) ?? new Set<(detail: never) => void>();
      entries.add(listener as (detail: never) => void);
      listeners.set(type, entries);
      return () => {
        entries.delete(listener as (detail: never) => void);
        if (entries.size === 0) listeners.delete(type);
      };
    },
    dispose() {
      listeners.clear();
    },
  };
}
