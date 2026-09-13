export const STRUCTFLOW_DARK_THEME = 'structflow-dark' as const;
export const STRUCTFLOW_LIGHT_THEME = 'structflow-light' as const;
export type ThemeId = typeof STRUCTFLOW_DARK_THEME | typeof STRUCTFLOW_LIGHT_THEME;

/** Canonical user-facing color-scheme preference. */
export const THEME_PREFERENCE_KEY = 'structflow:color-scheme';
const LEGACY_THEME_PREFERENCE_KEY = 'structflow:ui-preferences';

export const NATIVE_WINDOW_THEME = Object.freeze({
  [STRUCTFLOW_DARK_THEME]: Object.freeze({ titlebar: '#18191c', symbol: '#c8cbd0' }),
  [STRUCTFLOW_LIGHT_THEME]: Object.freeze({ titlebar: '#ffffff', symbol: '#4d535c' }),
});

export interface ThemeSnapshot {
  id: ThemeId;
  revision: number;
}

let snapshot: ThemeSnapshot = Object.freeze({ id: STRUCTFLOW_DARK_THEME, revision: 0 });
const subscribers = new Set<() => void>();

export const themeRuntime = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  },
  activateFromDocument() {
    if (typeof document === 'undefined') return snapshot;
    const preference = readThemePreference();
    document.documentElement.dataset.theme = preference;
    snapshot = Object.freeze({ id: preference, revision: snapshot.revision + 1 });
    subscribers.forEach((listener) => listener());
    return snapshot;
  },
  setPreference(id: ThemeId) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_PREFERENCE_KEY, id);
      } catch {
        // Sandboxed/private runtimes may reject storage; the active document
        // should still switch themes for the current session.
      }
    }
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = id;
    snapshot = Object.freeze({ id, revision: snapshot.revision + 1 });
    subscribers.forEach((listener) => listener());
    syncNativeWindowTheme(id);
    return snapshot;
  },
};

function readThemePreference(): ThemeId {
  if (typeof window === 'undefined') return STRUCTFLOW_DARK_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    if (raw === STRUCTFLOW_LIGHT_THEME) return STRUCTFLOW_LIGHT_THEME;
    if (raw === STRUCTFLOW_DARK_THEME) return STRUCTFLOW_DARK_THEME;

    // Read the previous dark-only preference format once so existing installs
    // do not receive a surprising theme reset during the design-system upgrade.
    const legacyRaw = window.localStorage.getItem(LEGACY_THEME_PREFERENCE_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) as { version?: unknown; themeId?: unknown } : null;
    if (legacy?.version === 1 && legacy.themeId === STRUCTFLOW_DARK_THEME) return STRUCTFLOW_DARK_THEME;
  } catch {
    // Corrupt UI-only preferences are ignored; project data is never involved.
  }
  return STRUCTFLOW_DARK_THEME;
}

export function syncNativeWindowTheme(id: ThemeId) {
  if (typeof window === 'undefined') return;
  window.electronAPI?.setWindowTheme?.(NATIVE_WINDOW_THEME[id]);
}
