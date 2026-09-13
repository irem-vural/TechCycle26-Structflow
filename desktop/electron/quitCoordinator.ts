export type QuitCoordinatorState = 'idle' | 'awaiting-confirmation' | 'confirmed' | 'exiting';

export type QuitCoordinatorOptions = {
  requestRendererDecision: () => void;
  quit: () => void;
  forceExit: () => void;
  forceQuitAfterMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

/** Coordinates Electron close events with the renderer's unsaved-work dialog. */
export class QuitCoordinator {
  private state: QuitCoordinatorState = 'idle';
  private forceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly forceQuitAfterMs: number;
  private readonly setTimer: NonNullable<QuitCoordinatorOptions['setTimer']>;
  private readonly clearTimer: NonNullable<QuitCoordinatorOptions['clearTimer']>;

  constructor(private readonly options: QuitCoordinatorOptions) {
    this.forceQuitAfterMs = options.forceQuitAfterMs ?? 1000;
    this.setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  getState(): QuitCoordinatorState {
    return this.state;
  }

  /** Returns true when the close event may continue without prompting. */
  handleWindowClose(): boolean {
    if (this.state === 'confirmed' || this.state === 'exiting') return true;
    if (this.state === 'awaiting-confirmation') return false;
    this.state = 'awaiting-confirmation';
    this.options.requestRendererDecision();
    return false;
  }

  /** Called by the renderer after all dirty tabs have been handled. */
  confirm(): void {
    if (this.state !== 'awaiting-confirmation' && this.state !== 'idle') return;
    this.state = 'confirmed';
    this.options.quit();
    this.forceTimer = this.setTimer(() => {
      if (this.state === 'confirmed' || this.state === 'exiting') {
        this.state = 'exiting';
        this.options.forceExit();
      }
    }, this.forceQuitAfterMs);
  }

  cancel(): void {
    if (this.state !== 'awaiting-confirmation') return;
    this.state = 'idle';
  }

  /** Electron's before-quit hook must not bypass the renderer decision. */
  handleBeforeQuit(event: { preventDefault: () => void }): void {
    if (this.state === 'confirmed' || this.state === 'exiting') {
      this.state = 'exiting';
      return;
    }
    event.preventDefault();
    this.handleWindowClose();
  }

  dispose(): void {
    if (this.forceTimer) this.clearTimer(this.forceTimer);
    this.forceTimer = null;
  }
}
