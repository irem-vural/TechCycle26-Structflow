import type { WorkspaceFocusDetail } from './workspaceEventBus';

type WorkspaceFocusSink = (detail: WorkspaceFocusDetail & { floorId?: string }) => void;

let focusSink: WorkspaceFocusSink | null = null;

export function registerWorkspaceFocusSink(sink: WorkspaceFocusSink): () => void {
  focusSink = sink;
  return () => {
    if (focusSink === sink) focusSink = null;
  };
}

export function emitWorkspaceFocus(detail: WorkspaceFocusDetail & { floorId?: string }): void {
  focusSink?.(detail);
}
