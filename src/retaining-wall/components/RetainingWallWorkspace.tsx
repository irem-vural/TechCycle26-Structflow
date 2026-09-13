'use client';

import React, { useState } from 'react';
import { BarChart3, Box, SlidersHorizontal } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useMobileViewport } from '@/hooks/useMobileViewport';
import RetainingWallCanvasPanel from './CanvasPanel';
import RetainingWallInputPanel from './EngineeringInputPanel';
import RetainingWallResultsPanel from './EngineeringResultsPanel';

export default function RetainingWallWorkspace({ projectName }: { projectName?: string }) {
  const { isMobile, ready: viewportReady } = useMobileViewport();

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="min-h-0 flex-1">
        <RetainingWallAnalysisWorkspace mobile={viewportReady && isMobile} projectName={projectName} />
      </div>
    </div>
  );
}

function RetainingWallAnalysisWorkspace({ mobile, projectName }: { mobile: boolean; projectName?: string }) {
  if (mobile) return <MobileAnalysisWorkspace projectName={projectName} />;

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize="25%" minSize="20%" maxSize="40%" className="flex min-w-0 flex-col bg-[var(--sf-bg-sidebar)]">
        <RetainingWallInputPanel />
      </ResizablePanel>
      <ResizableHandle withHandle className="z-20 w-2 cursor-col-resize border-x border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] transition-colors hover:bg-[var(--sf-action-primary-subtle)]" />
      <ResizablePanel defaultSize="45%" className="relative flex min-w-0 flex-col bg-[var(--sf-bg-canvas)]">
        <RetainingWallCanvasPanel />
      </ResizablePanel>
      <ResizableHandle withHandle className="z-20 w-2 cursor-col-resize border-x border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] transition-colors hover:bg-[var(--sf-action-primary-subtle)]" />
      <ResizablePanel defaultSize="30%" minSize="25%" maxSize="45%" className="flex min-w-0 flex-col bg-[var(--sf-bg-sidebar)]">
        <RetainingWallResultsPanel projectName={projectName} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

type MobileAnalysisPanel = 'inputs' | 'model' | 'results';

function MobileAnalysisWorkspace({ projectName }: { projectName?: string }) {
  const [activePanel, setActivePanel] = useState<MobileAnalysisPanel>('inputs');
  const panels: Array<{ id: MobileAnalysisPanel; label: string; icon: React.ReactNode }> = [
    { id: 'inputs', label: 'Girdiler', icon: <SlidersHorizontal className="size-3.5" /> },
    { id: 'model', label: '3D model', icon: <Box className="size-3.5" /> },
    { id: 'results', label: 'Sonuçlar', icon: <BarChart3 className="size-3.5" /> },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[var(--sf-bg-app)]">
      <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]" role="tablist" aria-label="İstinat analizi mobil panelleri">
        {panels.map((panel) => {
          const active = panel.id === activePanel;
          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActivePanel(panel.id)}
              className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border px-1.5 text-xs font-semibold transition-colors ${active ? 'border-[var(--sf-border-active)] bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'}`}
            >
              {panel.icon}
              <span className="truncate">{panel.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activePanel === 'inputs' && (
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
            <RetainingWallInputPanel />
          </div>
        )}
        {activePanel === 'model' && <RetainingWallCanvasPanel />}
        {activePanel === 'results' && (
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
            <RetainingWallResultsPanel projectName={projectName} />
          </div>
        )}
      </div>
    </div>
  );
}
