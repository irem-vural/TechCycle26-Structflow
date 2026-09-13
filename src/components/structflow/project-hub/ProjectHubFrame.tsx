"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { ProjectType } from "@/core/workspace/projectTypes";
import { ProjectHubProjectList } from "./ProjectHubProjectList";
import { ProjectHubRibbon } from "./ProjectHubRibbon";
import { ProjectHubTemplates } from "./ProjectHubTemplates";
import type {
  ManagerView,
  ProjectActionHandlers,
  ProjectFavoriteState,
  ProjectFilter,
  ProjectItem,
  SortMode,
  ViewMode,
} from "./types";

interface ProjectHubFrameProps extends ProjectActionHandlers {
  activeView: ManagerView;
  filter: ProjectFilter;
  sortMode: SortMode;
  searchQuery: string;
  projects: ProjectItem[];
  isFavorite: ProjectFavoriteState;
  isArchived: ProjectFavoriteState;
  onViewChange: (view: ManagerView) => void;
  onFilterChange: (filter: ProjectFilter) => void;
  onSortModeChange: (sortMode: SortMode) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onNewProject: () => void;
  onOpenDisk: () => void;
  onNewFromTemplate: (projectType: ProjectType) => void;
  /** Renders the visual preview inside a project card (e.g. 3-D thumbnail). */
  renderProjectPreview?: (project: ProjectItem, index: number) => ReactNode;
}

export function ProjectHubFrame({
  activeView,
  filter,
  sortMode,
  searchQuery,
  projects,
  isFavorite,
  isArchived,
  onViewChange,
  onFilterChange,
  onSortModeChange,
  onSearchChange,
  onClearSearch,
  onNewProject,
  onOpenDisk,
  onNewFromTemplate,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
  renderProjectPreview,
}: ProjectHubFrameProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return (
    <div data-structflow-project-hub className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--sf-bg-app)] text-[var(--sf-text-primary)]">
      <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ProjectHubRibbon
            activeView={activeView}
            filter={filter}
            sortMode={sortMode}
            viewMode={viewMode}
            searchQuery={searchQuery}
            onViewChange={onViewChange}
            onFilterChange={onFilterChange}
            onSortModeChange={onSortModeChange}
            onViewModeChange={setViewMode}
            onSearchChange={onSearchChange}
            onNewProject={onNewProject}
            onOpenProject={onOpenDisk}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            {activeView === "templates" ? (
              <ProjectHubTemplates onNew={onNewFromTemplate} />
            ) : (
              <ProjectHubProjectList
                projects={projects}
                searchQuery={searchQuery}
                viewMode={viewMode}
                isFavorite={isFavorite}
                isArchived={isArchived}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
                onToggleArchive={onToggleArchive}
                onRemove={onRemove}
                onNewProject={onNewProject}
                onOpenDisk={onOpenDisk}
                onClearSearch={onClearSearch}
                renderProjectPreview={renderProjectPreview}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
