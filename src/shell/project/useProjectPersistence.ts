import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { SFL_EXTENSION, type ProjectPayload } from '@/core/workspace/projectTypes';
import { writeSflow } from '@/core/workspace/sflowFormat';
import { sanitizeProjectPayloadForWrite } from '@/core/workspace/projectPersistence';
import { ProjectDecodeClient, projectDecodeUserMessage } from '@/core/workspace/projectDecodeClient';
import { emitWorkspaceWarning } from '@/core/workspace/workspaceWarningPort';
import type { DesktopApi, ProjectOpenResult, RecentProjectDescriptor } from '@/core/desktop/desktopContracts';
import {
  createDocumentSessionId,
  normalizePath,
  safeExportName,
  tabNameFromPath,
  type ProjectOpenPreview,
  type ProjectSplashData,
  type RecentEntry,
  type WorkspaceTab,
} from './projectPayloadFactory';
import {
  applyWorkspaceTabSaveCompletion,
  beginWorkspaceTabSave,
  captureWorkspaceTabSaveDraft,
  workspaceTabOwnsSaveCompletion,
  type WorkspaceTabSaveDraft,
  type WorkspaceTabSaveSnapshot,
} from './projectTabTransition';

const RECENTS_KEY = 'structflow.recentProjects';

type LoadedProject = {
  name: string;
  payload: ProjectPayload;
  tab: WorkspaceTab;
};

type UseProjectPersistenceArgs = {
  activeTab: WorkspaceTab | null;
  activeTabId: string;
  tabsRef: MutableRefObject<WorkspaceTab[]>;
  buildPayloadFor: (tab: WorkspaceTab) => ProjectPayload;
  activateWorkspaceTab: (tab: WorkspaceTab) => void;
  setTabs: Dispatch<SetStateAction<WorkspaceTab[]>>;
  startProjectSplash: (project: ProjectSplashData, onCommit: () => void | Promise<void>) => void;
};

function newRecentId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `recent-${Date.now()}`;
}

function isOpenSuccess(result: ProjectOpenResult): result is Extract<ProjectOpenResult, { canceled: false; capabilityId: string }> {
  return result.canceled === false && 'capabilityId' in result && result.bytes instanceof Uint8Array;
}

function hasDesktopMethods<K extends keyof DesktopApi>(
  api: DesktopApi | undefined,
  ...methods: readonly K[]
): api is DesktopApi & Required<Pick<DesktopApi, K>> {
  return Boolean(api && methods.every((method) => typeof api[method] === 'function'));
}

export function useProjectPersistence({
  activeTab,
  activeTabId,
  tabsRef,
  buildPayloadFor,
  activateWorkspaceTab,
  setTabs,
  startProjectSplash,
}: UseProjectPersistenceArgs) {
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [recentPayloads, setRecentPayloads] = useState<Record<string, ProjectPayload>>({});
  const [previewsLoaded, setPreviewsLoaded] = useState(false);
  const projectDecoderRef = useRef<ProjectDecodeClient | null>(null);
  const openDecodeAbortRef = useRef<AbortController | null>(null);
  const openGenerationRef = useRef(0);

  const beginSaveRequest = useCallback((draft: WorkspaceTabSaveDraft): WorkspaceTabSaveSnapshot | null => {
    const begun = beginWorkspaceTabSave(tabsRef.current, draft);
    if (!begun.snapshot) return null;
    tabsRef.current = begun.tabs;
    const { saveToken } = begun.snapshot;
    setTabs((previous) => previous.map((tab) => (
      tab.id === draft.tabId && tab.documentSessionId === saveToken.documentSessionId
        ? { ...tab, latestSaveRequestSequence: Math.max(tab.latestSaveRequestSequence, saveToken.requestSequence) }
        : tab
    )));
    return begun.snapshot;
  }, [setTabs, tabsRef]);

  const getProjectDecoder = useCallback(() => {
    if (!projectDecoderRef.current) projectDecoderRef.current = new ProjectDecodeClient();
    return projectDecoderRef.current;
  }, []);

  const markPreviewsLoaded = useCallback(() => {
    window.setTimeout(() => setPreviewsLoaded(true), 300);
  }, []);

  const pushRecent = useCallback(async (entry: Omit<RecentEntry, 'id'> & { capabilityId?: string }) => {
    let recent: RecentEntry = { ...entry, id: newRecentId() };
    let desktopPersisted = false;
    const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (entry.capabilityId && hasDesktopMethods(desktopApi, 'rememberRecentProject')) {
      try {
        const descriptor = await desktopApi.rememberRecentProject(entry.capabilityId, entry.name, entry.at, 'retaining-wall');
        desktopPersisted = true;
        if (descriptor) recent = fromDesktopRecent(descriptor);
      } catch (error) {
        console.error('Recent project could not be remembered:', error);
      }
    }
    setRecents((previous) => {
      const next = [recent, ...previous.filter((item) => item.id !== recent.id && item.path !== recent.path)].slice(0, 16);
      try {
        if (!desktopPersisted) localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const removeRecent = useCallback((recentId: string) => {
    const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (hasDesktopMethods(desktopApi, 'forgetRecentProject')) {
      void desktopApi.forgetRecentProject(recentId).catch((error) => console.error('Recent project could not be forgotten:', error));
    }
    setRecents((previous) => {
      const next = previous.filter((recent) => recent.id !== recentId);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const saveAs = useCallback(async (): Promise<string | null> => {
    const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!activeTab || !hasDesktopMethods(desktopApi, 'selectProjectSavePath', 'saveProject')) return null;
    const draft = captureWorkspaceTabSaveDraft(activeTab, sanitizeProjectPayloadForWrite(buildPayloadFor(activeTab)));
    const selected = await desktopApi.selectProjectSavePath(`${safeExportName(activeTab.name)}.${SFL_EXTENSION}`);
    if (selected.canceled) return null;
    const finalName = tabNameFromPath(selected.filePath);
    const snapshot = beginSaveRequest({ ...draft, payload: { ...draft.payload, name: finalName } });
    if (!snapshot) return null;
    const result = await desktopApi.saveProject(selected.capabilityId, writeSflow(snapshot.payload), snapshot.saveToken);
    if (!result.ok || !tabsRef.current.some((tab) => workspaceTabOwnsSaveCompletion(tab, snapshot))) return null;
    setTabs((previous) => applyWorkspaceTabSaveCompletion(previous, snapshot, {
      filePath: selected.filePath,
      fileCapabilityId: selected.capabilityId,
      name: finalName,
    }));
    await pushRecent({ path: selected.filePath, name: finalName, at: new Date().toISOString(), projectType: 'retaining-wall', capabilityId: selected.capabilityId });
    return selected.filePath;
  }, [activeTab, beginSaveRequest, buildPayloadFor, pushRecent, setTabs, tabsRef]);

  const save = useCallback(async () => {
    const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!activeTab || !hasDesktopMethods(desktopApi, 'saveProject')) return;
    if (!activeTab.filePath || !activeTab.fileCapabilityId) {
      await saveAs();
      return;
    }
    const draft = captureWorkspaceTabSaveDraft(activeTab, sanitizeProjectPayloadForWrite(buildPayloadFor(activeTab)));
    const snapshot = beginSaveRequest(draft);
    if (!snapshot) return;
    const result = await desktopApi.saveProject(activeTab.fileCapabilityId, writeSflow(snapshot.payload), snapshot.saveToken);
    if (!result.ok || !tabsRef.current.some((tab) => workspaceTabOwnsSaveCompletion(tab, snapshot))) return;
    setTabs((previous) => applyWorkspaceTabSaveCompletion(previous, snapshot));
    await pushRecent({ path: activeTab.filePath, name: activeTab.name, at: new Date().toISOString(), projectType: 'retaining-wall', capabilityId: activeTab.fileCapabilityId });
  }, [activeTab, beginSaveRequest, buildPayloadFor, pushRecent, saveAs, setTabs, tabsRef]);

  const saveTabById = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabsRef.current.find((item) => item.id === tabId);
    const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!tab || !hasDesktopMethods(desktopApi, 'selectProjectSavePath', 'saveProject')) return false;
    const draft = captureWorkspaceTabSaveDraft(tab, sanitizeProjectPayloadForWrite(tab.id === activeTabId ? buildPayloadFor(tab) : tab.payload));
    let filePath = tab.filePath;
    let capabilityId = tab.fileCapabilityId;
    let finalName = tab.name;
    if (!filePath || !capabilityId) {
      const selected = await desktopApi.selectProjectSavePath(`${safeExportName(tab.name)}.${SFL_EXTENSION}`);
      if (selected.canceled) return false;
      filePath = selected.filePath;
      capabilityId = selected.capabilityId;
      finalName = tabNameFromPath(filePath);
    }
    const snapshot = beginSaveRequest(finalName === tab.name ? draft : { ...draft, payload: { ...draft.payload, name: finalName } });
    if (!snapshot) return false;
    const result = await desktopApi.saveProject(capabilityId, writeSflow(snapshot.payload), snapshot.saveToken);
    if (!result.ok || !tabsRef.current.some((item) => workspaceTabOwnsSaveCompletion(item, snapshot))) return false;
    setTabs((previous) => applyWorkspaceTabSaveCompletion(previous, snapshot, { filePath, fileCapabilityId: capabilityId, name: finalName }));
    await pushRecent({ path: filePath, name: finalName, at: new Date().toISOString(), projectType: 'retaining-wall', capabilityId });
    return true;
  }, [activeTabId, beginSaveRequest, buildPayloadFor, pushRecent, setTabs, tabsRef]);

  const loadProjectResult = useCallback(async (result: ProjectOpenResult, signal?: AbortSignal): Promise<LoadedProject | null> => {
    if (!isOpenSuccess(result)) {
      if (result.canceled === false) emitWorkspaceWarning(result.error || 'Proje dosyası açılamadı.');
      return null;
    }
    try {
      const parsed = await getProjectDecoder().decodeProject(result.bytes, { signal, priority: 'open' });
      const name = parsed.name || tabNameFromPath(result.filePath);
      const payload = { ...parsed, name };
      return {
        name,
        payload,
        tab: {
          id: newRecentId(),
          name,
          filePath: result.filePath,
          fileCapabilityId: result.capabilityId,
          documentSessionId: createDocumentSessionId(),
          latestSaveRequestSequence: 0,
          dirty: false,
          projectType: 'retaining-wall',
          payload,
        },
      };
    } catch (error) {
      const message = projectDecodeUserMessage(error);
      if (message) emitWorkspaceWarning(message);
      return null;
    }
  }, [getProjectDecoder]);

  const mountLoadedProject = useCallback((loaded: LoadedProject) => {
    activateWorkspaceTab(loaded.tab);
    void pushRecent({ path: loaded.tab.filePath ?? '', name: loaded.name, at: new Date().toISOString(), projectType: 'retaining-wall', capabilityId: loaded.tab.fileCapabilityId });
  }, [activateWorkspaceTab, pushRecent]);

  const openProjectResult = useCallback(async (resultPromise: Promise<ProjectOpenResult>, preview?: ProjectOpenPreview) => {
    const generation = openGenerationRef.current + 1;
    openGenerationRef.current = generation;
    openDecodeAbortRef.current?.abort();
    const controller = new AbortController();
    openDecodeAbortRef.current = controller;
    try {
      const result = await resultPromise;
      if (generation !== openGenerationRef.current || controller.signal.aborted) return;
      const loaded = await loadProjectResult(result, controller.signal);
      if (!loaded || generation !== openGenerationRef.current || controller.signal.aborted) return;
      startProjectSplash(preview ?? { name: loaded.name, projectType: 'retaining-wall', payload: loaded.payload }, () => mountLoadedProject(loaded));
    } finally {
      if (generation === openGenerationRef.current) openDecodeAbortRef.current = null;
    }
  }, [loadProjectResult, mountLoadedProject, startProjectSplash]);

  const openProjectFromPath = useCallback(async (recentId?: string, preview?: ProjectOpenPreview) => {
    if (typeof window === 'undefined' || !window.electronAPI) return;
    const api = window.electronAPI;
    try {
      if (recentId) {
        if (typeof api.openRecentProject !== 'function') return;
        await openProjectResult(api.openRecentProject(recentId), preview);
      } else {
        if (typeof api.openProjectDialog !== 'function') return;
        await openProjectResult(api.openProjectDialog(), preview);
      }
    } catch (error) {
      emitWorkspaceWarning(`Proje açma başarısız: ${error instanceof Error ? error.message : 'beklenmeyen hata.'}`);
    }
  }, [openProjectResult]);

  const openProjectCapability = useCallback(async (capabilityId: string) => {
    if (typeof window === 'undefined' || typeof window.electronAPI?.openProjectCapability !== 'function') return;
    await openProjectResult(window.electronAPI.openProjectCapability(capabilityId));
  }, [openProjectResult]);

  useEffect(() => () => {
    openGenerationRef.current += 1;
    openDecodeAbortRef.current?.abort();
    projectDecoderRef.current?.dispose();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRecents = async () => {
      if (typeof window !== 'undefined' && typeof window.electronAPI?.listRecentProjects === 'function') {
        try {
          const descriptors = await window.electronAPI.listRecentProjects();
          if (!cancelled) setRecents(descriptors.map(fromDesktopRecent));
          return;
        } catch {}
      }
      try {
        const raw = localStorage.getItem(RECENTS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!cancelled && Array.isArray(parsed)) {
          setRecents(parsed.flatMap((item): RecentEntry[] => {
            if (typeof item === 'string') return [{ id: newRecentId(), path: item, name: tabNameFromPath(item), at: '', projectType: 'retaining-wall' }];
            if (!isRecord(item) || typeof item.path !== 'string') return [];
            return [{ id: typeof item.id === 'string' ? item.id : newRecentId(), path: item.path, name: typeof item.name === 'string' ? item.name : tabNameFromPath(item.path), at: typeof item.at === 'string' ? item.at : '', projectType: 'retaining-wall' }];
          }));
        }
      } catch {}
    };
    void loadRecents().finally(() => { if (!cancelled) markPreviewsLoaded(); });
    return () => { cancelled = true; };
  }, [markPreviewsLoaded]);

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!hasDesktopMethods(api, 'openRecentProject') || recents.length === 0) return;
    const missing = recents.filter((recent) => !recentPayloads[normalizePath(recent.path) ?? '']).slice(0, 16);
    if (missing.length === 0) return;
    let cancelled = false;
    const controller = new AbortController();
    void Promise.all(missing.map(async (recent) => {
      try {
        const result = await api.openRecentProject(recent.id);
        if (!isOpenSuccess(result)) return null;
        const payload = await getProjectDecoder().decodeProject(result.bytes, { signal: controller.signal, priority: 'preview' });
        return { pathKey: normalizePath(recent.path), payload };
      } catch { return null; }
    })).then((loaded) => {
      if (cancelled) return;
      setRecentPayloads((previous) => {
        const next = { ...previous };
        loaded.forEach((item) => { if (item?.pathKey) next[item.pathKey] = item.payload; });
        return next;
      });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [getProjectDecoder, recentPayloads, recents]);

  return { openProjectFromPath, openProjectCapability, previewsLoaded, recentPayloads, recents, removeRecent, save, saveAs, saveTabById };
}

function fromDesktopRecent(descriptor: RecentProjectDescriptor): RecentEntry {
  return { id: descriptor.id, path: descriptor.filePath, name: descriptor.name, at: descriptor.at, projectType: 'retaining-wall' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
