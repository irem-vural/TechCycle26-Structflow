'use client';

import { useEffect } from 'react';
import { syncNativeWindowTheme, themeRuntime } from './structflowTheme';

/** Activates the CSS-backed immutable snapshot once per document load. */
export function ThemeActivation() {
  useEffect(() => {
    const snapshot = themeRuntime.activateFromDocument();
    syncNativeWindowTheme(snapshot.id);
  }, []);
  return null;
}
