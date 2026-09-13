import type { ProjectPayload } from '@/core/workspace/projectTypes';
import type { ProjectSaveToken } from '@/core/desktop/desktopContracts';
import type { WorkspaceTab } from './projectPayloadFactory';

export function snapshotWorkspaceTab(tab: WorkspaceTab, payload: ProjectPayload): WorkspaceTab {
  return {
    ...tab,
    payload,
    dirty: JSON.stringify(payload.data) !== JSON.stringify(tab.payload.data),
  };
}

export type WorkspaceTabSaveSnapshot = {
  tabId: string;
  projectType: WorkspaceTab['projectType'];
  payload: ProjectPayload;
  saveToken: ProjectSaveToken;
};

export type WorkspaceTabSaveDraft = {
  tabId: string;
  expectedDocumentSessionId: string;
  payload: ProjectPayload;
};

export type WorkspaceTabSaveMetadata = Partial<Pick<WorkspaceTab, 'filePath' | 'fileCapabilityId' | 'name'>>;

export function workspaceTabOwnsSaveCompletion(tab: WorkspaceTab, snapshot: WorkspaceTabSaveSnapshot): boolean {
  return tab.id === snapshot.tabId
    && tab.documentSessionId === snapshot.saveToken.documentSessionId
    && tab.latestSaveRequestSequence === snapshot.saveToken.requestSequence;
}

export function captureWorkspaceTabSaveDraft(tab: WorkspaceTab, payload: ProjectPayload): WorkspaceTabSaveDraft {
  return {
    tabId: tab.id,
    expectedDocumentSessionId: tab.documentSessionId,
    payload,
  };
}

export function beginWorkspaceTabSave(
  tabs: WorkspaceTab[],
  input: WorkspaceTabSaveDraft,
): { tabs: WorkspaceTab[]; snapshot: WorkspaceTabSaveSnapshot | null } {
  const tab = tabs.find((candidate) => candidate.id === input.tabId);
  if (!tab || tab.documentSessionId !== input.expectedDocumentSessionId) {
    return { tabs, snapshot: null };
  }

  const requestSequence = tab.latestSaveRequestSequence + 1;
  const saveToken: ProjectSaveToken = {
    documentSessionId: tab.documentSessionId,
    requestSequence,
  };
  return {
    tabs: tabs.map((candidate) => (
      candidate.id === tab.id && candidate.documentSessionId === tab.documentSessionId
        ? { ...candidate, latestSaveRequestSequence: requestSequence }
        : candidate
    )),
    snapshot: {
      tabId: tab.id,
      projectType: 'retaining-wall',
      payload: input.payload,
      saveToken,
    },
  };
}

export function applyWorkspaceTabSaveCompletion(
  tabs: WorkspaceTab[],
  snapshot: WorkspaceTabSaveSnapshot,
  metadata: WorkspaceTabSaveMetadata = {},
): WorkspaceTab[] {
  return tabs.map((tab) => (
    workspaceTabOwnsSaveCompletion(tab, snapshot)
      ? { ...tab, ...metadata, payload: snapshot.payload, dirty: false }
      : tab
  ));
}

export function transitionWorkspaceTab(args: {
  tabs: WorkspaceTab[];
  activeTabId: string;
  targetTabId: string;
  targetTab?: WorkspaceTab;
  outgoingPayload: ProjectPayload;
}): { tabs: WorkspaceTab[]; targetPayload: ProjectPayload | null } {
  const outgoing = args.tabs.find((tab) => tab.id === args.activeTabId);
  let tabs = outgoing
    ? args.tabs.map((tab) => tab.id === outgoing.id ? snapshotWorkspaceTab(tab, args.outgoingPayload) : tab)
    : args.tabs;

  if (args.targetTab) {
    const targetIndex = tabs.findIndex((tab) => tab.id === args.targetTabId);
    const existingTarget = targetIndex >= 0 ? tabs[targetIndex] : undefined;
    if (!existingTarget || existingTarget.documentSessionId !== args.targetTab.documentSessionId) {
      tabs = targetIndex >= 0
        ? tabs.map((tab, index) => index === targetIndex ? args.targetTab! : tab)
        : [...tabs, args.targetTab];
    }
  }

  const target = tabs.find((tab) => tab.id === args.targetTabId);
  return { tabs, targetPayload: target?.payload ?? null };
}

export function resolveWorkspaceTabCloseFallback(
  tabs: WorkspaceTab[],
  closingTabIds: readonly string[],
  activeTabId: string,
): { tabs: WorkspaceTab[]; fallback: WorkspaceTab | null } {
  const closingIds = new Set(closingTabIds);
  const nextTabs = tabs.filter((tab) => !closingIds.has(tab.id));
  if (!closingIds.has(activeTabId)) return { tabs: nextTabs, fallback: null };
  return { tabs: nextTabs, fallback: nextTabs[nextTabs.length - 1] ?? null };
}
