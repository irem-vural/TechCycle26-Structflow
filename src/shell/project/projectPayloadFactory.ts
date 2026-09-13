import {
  CURRENT_SCHEMA_VERSION,
  PROJECT_TYPE_LABELS,
  type ProjectPayload,
  type ProjectType,
} from '@/core/workspace/projectTypes';
import { createDefaultRetainingWallData } from '@/retaining-wall';

export type WorkspaceTab = {
  id: string;
  documentSessionId: string;
  latestSaveRequestSequence: number;
  name: string;
  filePath: string | null;
  dirty: boolean;
  projectType: ProjectType;
  payload: ProjectPayload;
  fileCapabilityId?: string;
};

export function createDocumentSessionId(): string {
  return crypto.randomUUID();
}

export type RecentEntry = { id: string; path: string; name: string; at: string; projectType?: ProjectType };
export type UnsavedCloseAction = 'save' | 'discard' | 'cancel';
export type NewProjectOptions = { name?: string };
export type ProjectSplashData = { name: string; projectType: ProjectType; payload?: ProjectPayload };
export type ProjectOpenPreview = ProjectSplashData;
export type PendingCloseRequest =
  | { kind: 'tab'; tabIds: string[] }
  | { kind: 'app'; tabIds: string[] };

export function tabNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  const file = parts[parts.length - 1] || path;
  return file.replace(/\.(json|sfl|sflow|srw)$/i, '');
}

export function normalizePath(path: string | null | undefined): string | null {
  return path ? path.toLowerCase() : null;
}

export function safeExportName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return cleaned || 'istinat-duvari';
}

export function samePayload(a: ProjectPayload, b: ProjectPayload): boolean {
  if (a.data === b.data) return true;
  return JSON.stringify(a.data) === JSON.stringify(b.data);
}

export function makePayload(name: string, data: ProjectPayload['data']): ProjectPayload {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectType: 'retaining-wall',
    name,
    updatedAt: new Date().toISOString(),
    data,
  };
}

export function createNewProjectPayload(
  tabCount: number,
  options?: NewProjectOptions,
): { id: string; name: string; payload: ProjectPayload } {
  const id = crypto.randomUUID();
  const requestedName = options?.name?.trim();
  const name = requestedName || `${PROJECT_TYPE_LABELS['retaining-wall']} ${tabCount + 1}`;
  return { id, name, payload: makePayload(name, createDefaultRetainingWallData()) };
}
