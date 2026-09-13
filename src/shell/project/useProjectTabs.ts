import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceTab } from './projectPayloadFactory';

export function useProjectTabs() {
  const [showHub, setShowHub] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const tabsRef = useRef<WorkspaceTab[]>([]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  return {
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
  };
}
