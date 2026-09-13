type WarningSink = (message: string) => void;

let warningSink: WarningSink | null = null;

/**
 * Store/domain adapters cannot depend on React or a workspace component. The
 * shell registers the active workspace sink for validation feedback and gets
 * an idempotent cleanup function on unmount.
 */
export function registerWorkspaceWarningSink(sink: WarningSink): () => void {
  warningSink = sink;
  return () => {
    if (warningSink === sink) warningSink = null;
  };
}

export function emitWorkspaceWarning(message: string): void {
  warningSink?.(message);
}
