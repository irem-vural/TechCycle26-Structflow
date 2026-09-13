import type { GeometryFieldKey } from '@/retaining-wall/types';
import {
  STRUCTFLOW_DARK_THEME,
  STRUCTFLOW_LIGHT_THEME,
  type ThemeId,
} from '@/core/theme/structflowTheme';

const GEOMETRY_FIELD_COLORS_BY_THEME: Record<ThemeId, Record<GeometryFieldKey, string>> = {
  [STRUCTFLOW_DARK_THEME]: {
    H: '#7eaf90',
    x1: '#d2a55c',
    x2: '#6f8dcc',
    x3: '#a29ab5',
    x4: '#d37a80',
    x5: '#82a1b9',
    x6: '#c99a4d',
    Df: '#7194b0',
    L: '#87a2dc',
  },
  [STRUCTFLOW_LIGHT_THEME]: {
    H: '#337451',
    x1: '#895f1e',
    x2: '#4b6eaf',
    x3: '#665d7e',
    x4: '#a9424a',
    x5: '#386d92',
    x6: '#76571d',
    Df: '#2f668f',
    L: '#365d9f',
  },
};

export function geometryFieldColorsForTheme(theme: ThemeId): Record<GeometryFieldKey, string> {
  return GEOMETRY_FIELD_COLORS_BY_THEME[theme];
}

export function embeddedWireframeColorForTheme(theme: ThemeId): string {
  return theme === STRUCTFLOW_LIGHT_THEME ? '#365d9f' : '#87a2dc';
}

export function embeddedSurfaceColorForTheme(theme: ThemeId): string {
  return theme === STRUCTFLOW_LIGHT_THEME ? '#64748b' : '#6b7280';
}
