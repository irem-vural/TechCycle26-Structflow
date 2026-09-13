import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NATIVE_WINDOW_THEME,
  STRUCTFLOW_DARK_THEME,
  STRUCTFLOW_LIGHT_THEME,
  THEME_PREFERENCE_KEY,
  themeRuntime,
} from '../structflowTheme';

function installBrowserStubs(initialTheme?: string) {
  const store = new Map<string, string>();
  if (initialTheme) store.set(THEME_PREFERENCE_KEY, initialTheme);
  const setWindowTheme = vi.fn();

  vi.stubGlobal('document', { documentElement: { dataset: {} } });
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    electronAPI: { setWindowTheme },
  });

  return { store, setWindowTheme };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StructFlow theme runtime', () => {
  it('activates the stored light scheme on the document', () => {
    installBrowserStubs(STRUCTFLOW_LIGHT_THEME);

    const snapshot = themeRuntime.activateFromDocument();

    expect(snapshot.id).toBe(STRUCTFLOW_LIGHT_THEME);
    expect(document.documentElement.dataset.theme).toBe(STRUCTFLOW_LIGHT_THEME);
  });

  it('persists a scheme and keeps the Electron title bar in sync', () => {
    const { store, setWindowTheme } = installBrowserStubs(STRUCTFLOW_DARK_THEME);

    const snapshot = themeRuntime.setPreference(STRUCTFLOW_LIGHT_THEME);

    expect(snapshot.id).toBe(STRUCTFLOW_LIGHT_THEME);
    expect(store.get(THEME_PREFERENCE_KEY)).toBe(STRUCTFLOW_LIGHT_THEME);
    expect(document.documentElement.dataset.theme).toBe(STRUCTFLOW_LIGHT_THEME);
    expect(setWindowTheme).toHaveBeenLastCalledWith(NATIVE_WINDOW_THEME[STRUCTFLOW_LIGHT_THEME]);
  });
});
