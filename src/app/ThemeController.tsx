'use client';

import { useEffect } from 'react';
import { syncNativeWindowTheme, THEME_PREFERENCE_KEY, themeRuntime } from '@/core/theme/structflowTheme';

function activateTheme() {
  const snapshot = themeRuntime.activateFromDocument();
  syncNativeWindowTheme(snapshot.id);
}

export default function ThemeController() {
  useEffect(() => {
    activateTheme();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_PREFERENCE_KEY) activateTheme();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
