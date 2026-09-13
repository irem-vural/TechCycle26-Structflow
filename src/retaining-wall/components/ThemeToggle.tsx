'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  STRUCTFLOW_DARK_THEME,
  STRUCTFLOW_LIGHT_THEME,
  themeRuntime,
  type ThemeId,
} from '@/core/theme/structflowTheme';

export type StructFlowColorScheme = ThemeId;

export default function ThemeToggle() {
  const scheme = useSyncExternalStore(
    themeRuntime.subscribe,
    () => themeRuntime.getSnapshot().id,
    () => STRUCTFLOW_DARK_THEME,
  );

  const isLight = scheme === STRUCTFLOW_LIGHT_THEME;
  return (
    <button
      type="button"
      aria-label={isLight ? 'Koyu temaya geç' : 'Açık temaya geç'}
      title={isLight ? 'Koyu tema' : 'Açık tema'}
      onClick={() => {
        const next: StructFlowColorScheme = isLight ? STRUCTFLOW_DARK_THEME : STRUCTFLOW_LIGHT_THEME;
        themeRuntime.setPreference(next);
      }}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-secondary)] transition-colors hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
    >
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
