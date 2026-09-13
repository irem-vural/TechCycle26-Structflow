'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, FolderOpen, Save, SaveAll } from 'lucide-react';
import TitleBar, { type TitleBarMenuGroup } from '@/components/ui/TitleBar';
import { RetainingWallWorkspace, useRetainingWallStore } from '@/retaining-wall';
import type { ProjectPayload } from '@/core/workspace/projectTypes';
import {
  createDocumentSessionId,
  createNewProjectPayload,
  makePayload,
  samePayload,
  type NewProjectOptions,
  type PendingCloseRequest,
  type ProjectSplashData,
  type UnsavedCloseAction,
  type WorkspaceTab,
} from './projectPayloadFactory';
import { useProjectPersistence } from './useProjectPersistence';
import { useProjectTabs } from './useProjectTabs';
import { resolveWorkspaceTabCloseFallback, transitionWorkspaceTab } from './projectTabTransition';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import ProjectHub, { NewProjectDialog, prepareProject3DThumbnail } from '@/shell/hub/ProjectHub';
import SplashScreen from '@/shell/hub/SplashScreen';
import ProjectLoadingScreen from '@/shell/hub/ProjectLoadingScreen';
import { WorkspaceEventProvider } from '@/core/workspace/WorkspaceEventContext';
import { createWorkspaceEventBus } from '@/core/workspace/workspaceEventBus';
import { registerWorkspaceWarningSink } from '@/core/workspace/workspaceWarningPort';
import { registerWorkspaceReadySink } from '@/core/workspace/workspaceLifecyclePort';
import { registerWorkspaceFocusSink } from '@/core/workspace/workspaceFocusPort';

export default function ProjectShell() {
  const [workspaceEvents] = useState(createWorkspaceEventBus);
  useEffect(() => registerWorkspaceWarningSink((message) => workspaceEvents.emit('canvas-warning', message)), [workspaceEvents]);
  useEffect(() => () => workspaceEvents.dispose(), [workspaceEvents]);
  useEffect(() => registerWorkspaceFocusSink((detail) => workspaceEvents.emit('focus-elements', detail)), [workspaceEvents]);

  const rwCalculate = useRetainingWallStore((state) => state.calculate);
  const rwExport = useRetainingWallStore((state) => state.exportProjectData);
  const rwLoad = useRetainingWallStore((state) => state.loadProjectData);
  const rwWallInput = useRetainingWallStore((state) => state.wallInput);
  const rwLogistics = useRetainingWallStore((state) => state.logistics);
  const rwCustomCoefficients = useRetainingWallStore((state) => state.customCoefficients);
  const rwConcreteMix = useRetainingWallStore((state) => state.concreteMix);
  const rwSustainableConcrete = useRetainingWallStore((state) => state.sustainableConcrete);

  const [showSplash, setShowSplash] = useState(true);
  const [showProjectSplash, setShowProjectSplash] = useState(false);
  const [projectSplashData, setProjectSplashData] = useState<ProjectSplashData | null>(null);
  const [projectSplashThumbnailSrc, setProjectSplashThumbnailSrc] = useState<string | null>(null);
  const [projectSplashReady, setProjectSplashReady] = useState(false);
  const [pendingCloseRequest, setPendingCloseRequest] = useState<PendingCloseRequest | null>(null);
  const [closeActionBusy, setCloseActionBusy] = useState<UnsavedCloseAction | null>(null);
  const appCloseConfirmedRef = useRef(false);
  const hydratingRef = useRef(false);
  const projectSplashJobRef = useRef(0);

  useEffect(() => registerWorkspaceReadySink(() => {
    workspaceEvents.emit('workspace-ready');
    setProjectSplashReady(true);
  }), [workspaceEvents]);

  const {
    activeTab,
    activeTabId,
    managerSearch,
    setActiveTabId,
    setManagerSearch,
    setShowHub,
    setShowNewDialog,
    setTabs,
    showHub,
    showNewDialog,
    tabs,
    tabsRef,
  } = useProjectTabs();

  const buildPayloadFor = useCallback((tab: WorkspaceTab): ProjectPayload => (
    makePayload(tab.name, rwExport())
  ), [rwExport]);

  const hydrateStore = useCallback((payload: ProjectPayload) => {
    hydratingRef.current = true;
    rwLoad({
      wallInput: payload.data.wallInput,
      logistics: payload.data.logistics,
      customCoefficients: payload.data.customCoefficients,
      concreteMix: payload.data.concreteMix,
      sustainableConcrete: payload.data.sustainableConcrete,
    });
    setTimeout(() => { hydratingRef.current = false; }, 30);
  }, [rwLoad]);

  const startProjectSplash = useCallback((project: ProjectSplashData, onCommit: () => void | Promise<void>) => {
    const jobId = projectSplashJobRef.current + 1;
    projectSplashJobRef.current = jobId;
    setProjectSplashReady(false);
    setProjectSplashThumbnailSrc(null);

    // Show the loading surface immediately. Thumbnail generation is relatively
    // expensive (EXR + PBR textures + WebGL render) and must never gate the
    // user's first visual response after clicking "Oluştur".
    setProjectSplashData(project);
    setShowProjectSplash(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (projectSplashJobRef.current !== jobId) return;
        Promise.resolve(onCommit()).catch((error) => {
          console.error('Project load failed', error);
          if (projectSplashJobRef.current === jobId) setProjectSplashReady(true);
        });
      });
    });

    // Let React paint the loading screen first, then prepare the richer preview
    // in the background and swap it in when available.
    window.setTimeout(() => {
      if (projectSplashJobRef.current !== jobId || !project.payload) return;
      const previewProject = {
        key: `project-splash:${jobId}`,
        source: 'workspace' as const,
        name: project.name,
        category: '',
        projectType: 'retaining-wall' as const,
        updatedAt: project.payload.updatedAt,
        dirty: false,
        payload: project.payload,
      };

      void (async () => {
        let thumbnailSrc: string | null = null;
        try {
          thumbnailSrc = await prepareProject3DThumbnail(previewProject, 'high');
        } catch (error) {
          console.warn('High quality retaining-wall splash thumbnail failed, retrying standard quality:', error);
          try {
            thumbnailSrc = await prepareProject3DThumbnail(previewProject);
          } catch (fallbackError) {
            console.error('Retaining-wall splash thumbnail failed:', fallbackError);
          }
        }

        if (projectSplashJobRef.current !== jobId) return;
        setProjectSplashThumbnailSrc(thumbnailSrc);
      })();
    }, 0);
  }, []);

  const finishProjectSplash = useCallback(() => {
    setShowProjectSplash(false);
    setProjectSplashData(null);
    setProjectSplashThumbnailSrc(null);
    setProjectSplashReady(false);
  }, []);

  const activateWorkspaceTab = useCallback((targetTab: WorkspaceTab) => {
    const currentTabs = tabsRef.current;
    const currentTarget = currentTabs.find((tab) => tab.id === targetTab.id);
    if (targetTab.id === activeTabId && currentTarget?.documentSessionId === targetTab.documentSessionId) return;
    const outgoing = currentTabs.find((tab) => tab.id === activeTabId);
    const transition = transitionWorkspaceTab({
      tabs: currentTabs,
      activeTabId,
      targetTabId: targetTab.id,
      ...(currentTarget?.documentSessionId === targetTab.documentSessionId ? {} : { targetTab }),
      outgoingPayload: outgoing ? buildPayloadFor(outgoing) : targetTab.payload,
    });
    if (!transition.targetPayload) return;
    tabsRef.current = transition.tabs;
    setTabs(transition.tabs);
    hydrateStore(transition.targetPayload);
    setActiveTabId(targetTab.id);
    setShowHub(false);
  }, [activeTabId, buildPayloadFor, hydrateStore, setActiveTabId, setShowHub, setTabs, tabsRef]);

  const {
    openProjectCapability,
    openProjectFromPath,
    previewsLoaded,
    recentPayloads,
    recents,
    removeRecent,
    save,
    saveAs,
    saveTabById,
  } = useProjectPersistence({
    activeTab,
    activeTabId,
    tabsRef,
    buildPayloadFor,
    activateWorkspaceTab,
    setTabs,
    startProjectSplash,
  });

  useEffect(() => { rwCalculate(); }, [rwCalculate]);

  const newProject = useCallback((options?: NewProjectOptions) => {
    const { id, name, payload } = createNewProjectPayload(tabs.length, options);
    const tab: WorkspaceTab = {
      id,
      documentSessionId: createDocumentSessionId(),
      latestSaveRequestSequence: 0,
      name,
      filePath: null,
      dirty: false,
      projectType: 'retaining-wall',
      payload,
    };
    startProjectSplash({ name, projectType: 'retaining-wall', payload }, () => activateWorkspaceTab(tab));
  }, [activateWorkspaceTab, startProjectSplash, tabs.length]);

  const openCaptureWorkspace = useCallback(() => {
    const { id, name, payload } = createNewProjectPayload(0, { name: 'StructFlow · İstinat Duvarı' });
    const tab: WorkspaceTab = {
      id,
      documentSessionId: createDocumentSessionId(),
      latestSaveRequestSequence: 0,
      name,
      filePath: null,
      dirty: false,
      projectType: 'retaining-wall',
      payload,
    };
    tabsRef.current = [tab];
    setTabs([tab]);
    hydrateStore(payload);
    setActiveTabId(id);
    setShowHub(false);
    setShowProjectSplash(false);
    setShowSplash(false);
  }, [hydrateStore, setActiveTabId, setShowHub, setTabs, tabsRef]);

  useLayoutEffect(() => {
    const captureWindow = window as Window & {
      __structflowCapture?: {
        openWorkspace?: () => void;
        showHub?: () => void;
        setInputCategory?: (category: 'geometry' | 'params' | 'logistics' | 'concrete' | 'rebar') => void;
        setResultTab?: (tab: 'overview' | 'engineering' | 'sustainability' | 'cost-logistics') => void;
      };
    };
    captureWindow.__structflowCapture = {
      ...captureWindow.__structflowCapture,
      openWorkspace: openCaptureWorkspace,
      showHub: () => {
        setShowSplash(false);
        setShowProjectSplash(false);
        setShowHub(true);
      },
      setInputCategory: (category) => useRetainingWallStore.getState().setActiveInputCategory(category),
    };
  }, [openCaptureWorkspace, setShowHub]);

  const switchToTab = useCallback((id: string) => {
    if (id === activeTabId) return;
    const target = tabsRef.current.find((tab) => tab.id === id);
    if (target) activateWorkspaceTab(target);
  }, [activeTabId, activateWorkspaceTab, tabsRef]);

  const requestCloseUnsaved = useCallback((request: PendingCloseRequest): boolean => {
    const targetIds = new Set(request.tabIds);
    const dirtyTabs = tabsRef.current.filter((tab) => targetIds.has(tab.id) && tab.dirty);
    if (dirtyTabs.length === 0) return true;
    setPendingCloseRequest({ ...request, tabIds: dirtyTabs.map((tab) => tab.id) });
    return false;
  }, [tabsRef]);

  const closeTabsWithoutPrompt = useCallback((ids: string[]) => {
    const result = resolveWorkspaceTabCloseFallback(tabsRef.current, ids, activeTabId);
    tabsRef.current = result.tabs;
    setTabs(result.tabs);
    if (result.tabs.length === 0) {
      setShowHub(true);
      setActiveTabId('');
      return;
    }
    if (result.fallback) activateWorkspaceTab(result.fallback);
  }, [activeTabId, activateWorkspaceTab, setActiveTabId, setShowHub, setTabs, tabsRef]);

  const closeTab = useCallback((id: string): boolean => {
    if (!requestCloseUnsaved({ kind: 'tab', tabIds: [id] })) return false;
    closeTabsWithoutPrompt([id]);
    return true;
  }, [closeTabsWithoutPrompt, requestCloseUnsaved]);

  const openWorkspaceProject = useCallback((id: string) => {
    const target = tabs.find((tab) => tab.id === id);
    if (!target) return;
    startProjectSplash({ name: target.name, projectType: 'retaining-wall', payload: target.payload }, () => {
      if (id !== activeTabId) switchToTab(id);
      setShowHub(false);
    });
  }, [activeTabId, setShowHub, startProjectSplash, switchToTab, tabs]);

  const pendingDirtyTabs = useMemo(() => {
    if (!pendingCloseRequest) return [];
    const ids = new Set(pendingCloseRequest.tabIds);
    return tabs.filter((tab) => ids.has(tab.id) && tab.dirty);
  }, [pendingCloseRequest, tabs]);

  const cancelPendingClose = useCallback(() => {
    if (closeActionBusy) return;
    if (pendingCloseRequest?.kind === 'app') window.electronAPI?.cancelWindowClose?.();
    setPendingCloseRequest(null);
  }, [closeActionBusy, pendingCloseRequest]);

  const resolvePendingClose = useCallback(async (action: UnsavedCloseAction) => {
    if (!pendingCloseRequest || closeActionBusy) return;
    if (action === 'cancel') {
      if (pendingCloseRequest.kind === 'app') window.electronAPI?.cancelWindowClose?.();
      setPendingCloseRequest(null);
      return;
    }
    setCloseActionBusy(action);
    try {
      if (action === 'save') {
        for (const tab of tabsRef.current.filter((candidate) => pendingCloseRequest.tabIds.includes(candidate.id) && candidate.dirty)) {
          if (!await saveTabById(tab.id)) return;
        }
      }
      const request = pendingCloseRequest;
      setPendingCloseRequest(null);
      if (request.kind === 'app') {
        appCloseConfirmedRef.current = true;
        window.electronAPI?.confirmWindowClose?.();
      } else {
        closeTabsWithoutPrompt(request.tabIds);
      }
    } finally {
      setCloseActionBusy(null);
    }
  }, [closeActionBusy, closeTabsWithoutPrompt, pendingCloseRequest, saveTabById, tabsRef]);

  useEffect(() => {
    if (!activeTabId || hydratingRef.current) return;
    setTabs((previous) => {
      const target = previous.find((tab) => tab.id === activeTabId);
      if (!target) return previous;
      const current = buildPayloadFor(target);
      if (samePayload(current, target.payload)) return previous;
      return previous.map((tab) => tab.id === activeTabId ? { ...tab, payload: current, dirty: true } : tab);
    });
  }, [activeTabId, buildPayloadFor, rwConcreteMix, rwCustomCoefficients, rwLogistics, rwSustainableConcrete, rwWallInput, setTabs]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (showSplash || showProjectSplash) return;
      if (event.key === 'Escape') {
        const retainingWallStore = useRetainingWallStore.getState();
        retainingWallStore.setFocusedGeoField(null);
        retainingWallStore.setSelectedGeoField(null);
        return;
      }
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;
      const key = event.key.toLowerCase();
      if (key === 's' && event.shiftKey) { event.preventDefault(); void saveAs(); }
      else if (key === 's') { event.preventDefault(); void save(); }
      else if (key === 'o') { event.preventDefault(); void openProjectFromPath(); }
      else if (key === 'n' || key === 't') { event.preventDefault(); newProject(); }
      else if (key === 'w' && activeTabId) { event.preventDefault(); closeTab(activeTabId); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabId, closeTab, newProject, openProjectFromPath, save, saveAs, showProjectSplash, showSplash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = window.electronAPI;
    const removeOpenListener = typeof api?.onProjectOpenRequest === 'function'
      ? api.onProjectOpenRequest((capabilityId) => void openProjectCapability(capabilityId))
      : undefined;
    if (typeof api?.getStartupProject === 'function') {
      void api.getStartupProject().then((result) => {
        if (result && result.canceled === false && 'capabilityId' in result) void openProjectCapability(result.capabilityId);
      });
    }
    return () => removeOpenListener?.();
  }, [openProjectCapability]);

  useEffect(() => {
    const handleCloseRequest = () => {
      const dirtyTabIds = tabsRef.current.filter((tab) => tab.dirty).map((tab) => tab.id);
      if (dirtyTabIds.length === 0) {
        appCloseConfirmedRef.current = true;
        window.electronAPI?.confirmWindowClose?.();
        return;
      }
      requestCloseUnsaved({ kind: 'app', tabIds: dirtyTabIds });
    };
    const removeCloseListener = window.electronAPI?.onCloseRequest?.(handleCloseRequest);
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (appCloseConfirmedRef.current || showSplash || showProjectSplash || !tabsRef.current.some((tab) => tab.dirty)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { removeCloseListener?.(); window.removeEventListener('beforeunload', handleBeforeUnload); };
  }, [requestCloseUnsaved, showProjectSplash, showSplash, tabsRef]);

  const projectTitleMenu = useMemo<TitleBarMenuGroup[]>(() => activeTab ? [{
    id: 'project',
    label: 'Proje',
    items: [
      { icon: <ArrowLeft className="h-3.5 w-3.5" />, label: 'Ana Sayfaya Dön', onClick: () => setShowHub(true) },
      'separator',
      { icon: <FolderOpen className="h-3.5 w-3.5" />, label: 'Proje Aç', shortcut: 'Ctrl+O', onClick: () => void openProjectFromPath() },
      { icon: <Save className="h-3.5 w-3.5" />, label: 'Kaydet', shortcut: 'Ctrl+S', onClick: () => void save() },
      { icon: <SaveAll className="h-3.5 w-3.5" />, label: 'Farklı Kaydet', shortcut: 'Ctrl+Shift+S', onClick: () => void saveAs() },
      'separator',
      { icon: <FileText className="h-3.5 w-3.5" />, label: 'Dışa Aktarım çalışma alanı içinden yapılır', disabled: true },
    ],
  }] : [], [activeTab, openProjectFromPath, save, saveAs, setShowHub]);

  return (
    <WorkspaceEventProvider bus={workspaceEvents}>
      <div className="relative flex h-[100dvh] min-h-[100svh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden overscroll-none bg-[var(--sf-bg-app)] font-sans text-[var(--sf-text-primary)]">
        {showSplash && <SplashScreen onFinished={() => setShowSplash(false)} ready={previewsLoaded} />}
        {showProjectSplash && projectSplashData && (
          <ProjectLoadingScreen
            project={projectSplashData}
            ready={projectSplashReady}
            thumbnailSrc={projectSplashThumbnailSrc}
            onFinished={finishProjectSplash}
          />
        )}
        <UnsavedChangesDialog
          open={pendingCloseRequest !== null}
          isAppClose={pendingCloseRequest?.kind === 'app'}
          dirtyTabs={pendingDirtyTabs}
          busyAction={closeActionBusy}
          onOpenChange={(open) => { if (!open) cancelPendingClose(); }}
          onResolve={(action) => void resolvePendingClose(action)}
        />
        {showNewDialog && (
          <NewProjectDialog
            onClose={() => setShowNewDialog(false)}
            onSelect={(options) => { setShowNewDialog(false); newProject(options); }}
          />
        )}
        <TitleBar
          mode={showHub ? 'manager' : 'workspace'}
          searchValue={managerSearch}
          onSearchChange={setManagerSearch}
          workspaceTitle={activeTab?.name}
          dirty={activeTab?.dirty}
          menuGroups={projectTitleMenu}
          onSave={activeTab ? () => void save() : undefined}
          onSaveAs={activeTab ? () => void saveAs() : undefined}
          onOpenProject={() => void openProjectFromPath()}
          tabs={tabs.map((tab) => ({ id: tab.id, name: tab.name, dirty: tab.dirty, projectType: 'retaining-wall' }))}
          activeTabId={activeTabId}
          onTabSwitch={(id) => { switchToTab(id); setShowHub(false); }}
          onTabClose={closeTab}
          onNewTab={() => setShowNewDialog(true)}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showHub ? (
            <ProjectHub
              recents={recents}
              workspaceProjects={tabs.map((tab) => ({
                id: tab.id,
                name: tab.name,
                filePath: tab.filePath,
                dirty: tab.dirty,
                updatedAt: tab.payload.updatedAt,
                projectType: 'retaining-wall',
                payload: tab.payload,
              }))}
              searchQuery={managerSearch}
              onSearchChange={setManagerSearch}
              onNew={newProject}
              onOpen={() => void openProjectFromPath()}
              onOpenRecent={(id, preview) => void openProjectFromPath(id, preview)}
              onOpenWorkspaceProject={openWorkspaceProject}
              onCloseWorkspaceProject={closeTab}
              onRemoveRecent={removeRecent}
              recentPayloads={recentPayloads}
            />
          ) : (
            <RetainingWallWorkspace projectName={activeTab?.name} />
          )}
        </main>
      </div>
    </WorkspaceEventProvider>
  );
}
