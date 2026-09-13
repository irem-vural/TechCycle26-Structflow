"use client";

import type { ReactNode } from "react";
import {
  Archive,
  Briefcase,
  ChevronDown,
  Clock,
  FolderOpen,
  Home,
  LayoutGrid,
  List,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import type { ManagerView, ProjectFilter, SortMode, ViewMode } from "./types";

interface ProjectHubRibbonProps {
  activeView: ManagerView;
  filter: ProjectFilter;
  sortMode: SortMode;
  viewMode: ViewMode;
  searchQuery: string;
  onViewChange: (view: ManagerView) => void;
  onFilterChange: (filter: ProjectFilter) => void;
  onSortModeChange: (sortMode: SortMode) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (value: string) => void;
  onNewProject: () => void;
  onOpenProject: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: ManagerView;
  label: string;
  icon: typeof Home;
}> = [
  { id: "projects", label: "Projeler", icon: Home },
  { id: "recent", label: "Son Dosyalar", icon: Clock },
  { id: "favorites", label: "Favoriler", icon: Star },
  { id: "templates", label: "Şablonlar", icon: Briefcase },
  { id: "archived", label: "Arşiv", icon: Archive },
];

const FILTER_OPTIONS: ReadonlyArray<{ id: ProjectFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "active", label: "Açık" },
  { id: "favorites", label: "Favori" },
];

export function ProjectHubRibbon({
  activeView,
  filter,
  sortMode,
  viewMode,
  searchQuery,
  onViewChange,
  onFilterChange,
  onSortModeChange,
  onViewModeChange,
  onSearchChange,
  onNewProject,
  onOpenProject,
}: ProjectHubRibbonProps) {
  const sortLabel =
    sortMode === "name-asc"
      ? "Ada göre"
      : sortMode === "updated-asc"
        ? "En eski"
        : "Son değişen";

  return (
    <header className="min-w-0 border-b border-[var(--sf-divider)] bg-[var(--sf-bg-toolbar)]">
      {/* Primary row: section tabs + main action */}
      <div className="flex min-h-14 flex-wrap items-center gap-1 px-2 py-2 sm:h-14 sm:flex-nowrap sm:px-5 sm:py-0">
        <nav className="order-1 flex min-w-0 max-w-full flex-1 items-stretch gap-0.5 overflow-x-auto scrollbar-none sm:order-none sm:h-full sm:flex-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onViewChange(item.id)}
                className={`group relative flex min-w-10 shrink-0 items-center gap-1.5 px-2 text-xs font-medium transition-colors duration-150 sm:gap-2 sm:px-3 sm:text-[12.5px] ${
                  active ? "text-[var(--sf-text-primary)]" : "text-[var(--sf-text-secondary)] hover:text-[var(--sf-text-primary)]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                    active
                      ? "text-[var(--sf-action-primary-hover)]"
                      : "text-[var(--sf-text-muted)] group-hover:text-[var(--sf-text-secondary)]"
                  }`}
                />
                <span className="truncate">{item.label}</span>
                <span
                  className={`pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-opacity duration-150 ${
                    active
                      ? "bg-[var(--sf-action-primary)] opacity-100"
                      : "bg-[var(--sf-text-muted)] opacity-0 group-hover:opacity-30"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onNewProject}
          className="order-2 flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--sf-control-primary-bg)] px-3 text-[12px] font-semibold text-[var(--sf-text-on-accent)] transition-colors duration-150 hover:bg-[var(--sf-control-primary-hover)] sm:order-none sm:w-auto sm:justify-start sm:pl-3.5 sm:pr-3 sm:text-[12.5px]"
        >
          <Plus className="h-3.5 w-3.5" />
          Yeni Proje
        </button>
      </div>

      {/* Secondary row: search + filters + view controls */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-[var(--sf-divider)] px-2 py-2 sm:gap-2 sm:px-5 sm:py-3">
        {activeView !== "templates" && (
          <>
            <label className="relative min-w-0 basis-full flex-1 sm:min-w-[200px] sm:basis-auto sm:max-w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sf-text-secondary)]" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Proje ara..."
                className="h-9 w-full rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] pl-8 pr-8 text-[12.5px] text-[var(--sf-text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--sf-text-muted)] focus:border-[var(--sf-border-focus)] focus:bg-[var(--sf-bg-input)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  title="Aramayı temizle"
                  onClick={() => onSearchChange("")}
                  className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[var(--sf-text-secondary)] transition-[background-color,color] duration-150 hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            <div className="flex h-8 items-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] p-0.5">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onFilterChange(option.id)}
                  className={`h-7 rounded px-2.5 text-xs font-medium transition-[background-color,color] duration-150 ${
                    filter === option.id
                      ? "bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]"
                      : "text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onSortModeChange(
                  sortMode === "updated-desc"
                    ? "updated-asc"
                    : sortMode === "updated-asc"
                      ? "name-asc"
                      : "updated-desc",
                )
              }
              className="flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--sf-text-secondary)] transition-[background-color,color] duration-150 hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
            >
              {sortLabel}
              <ChevronDown className="h-3.5 w-3.5 text-[var(--sf-text-secondary)]" />
            </button>
          </>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenProject}
          className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium text-[var(--sf-text-secondary)] transition-[background-color,border-color,color] duration-150 hover:border-[var(--sf-border-default)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] sm:flex-none sm:px-2.5"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Diskten Aç
        </button>

        {activeView !== "templates" && (
          <div className="flex h-8 items-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] p-0.5">
            <ViewModeButton
              active={viewMode === "grid"}
              onClick={() => onViewModeChange("grid")}
              title="Kart görünümü"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </ViewModeButton>
            <ViewModeButton
              active={viewMode === "list"}
              onClick={() => onViewModeChange("list")}
              title="Liste görünümü"
            >
              <List className="h-3.5 w-3.5" />
            </ViewModeButton>
          </div>
        )}
      </div>
    </header>
  );
}

function ViewModeButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition-[background-color,color] duration-150 ${
        active
          ? "bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]"
          : "text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
