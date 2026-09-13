'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';
import type { WorkspaceEventBus } from './workspaceEventBus';

const WorkspaceEventContext = createContext<WorkspaceEventBus | null>(null);

export function WorkspaceEventProvider({ bus, children }: PropsWithChildren<{ bus: WorkspaceEventBus }>) {
  return <WorkspaceEventContext.Provider value={bus}>{children}</WorkspaceEventContext.Provider>;
}

export function useWorkspaceEvents(): WorkspaceEventBus {
  const bus = useContext(WorkspaceEventContext);
  if (!bus) throw new Error('Workspace event bus is not mounted');
  return bus;
}
