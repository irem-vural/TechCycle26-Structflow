type WorkspaceReadySink = () => void;

let readySink: WorkspaceReadySink | null = null;

export function registerWorkspaceReadySink(sink: WorkspaceReadySink): () => void {
  readySink = sink;
  return () => {
    if (readySink === sink) readySink = null;
  };
}

export function emitWorkspaceReady(): void {
  readySink?.();
}
