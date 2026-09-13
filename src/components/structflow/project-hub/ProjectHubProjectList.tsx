"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Clock, Landmark, Plus, Star, Archive } from "lucide-react";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { ProjectHubEmptyState } from "./ProjectHubEmptyState";
import { formatProjectDate, formatProjectTime } from "./projectHubUtils";
import type {
  ProjectActionHandlers,
  ProjectFavoriteState,
  ProjectItem,
  ViewMode,
} from "./types";

interface ProjectHubProjectListProps extends ProjectActionHandlers {
  projects: ProjectItem[];
  searchQuery: string;
  viewMode: ViewMode;
  isFavorite: ProjectFavoriteState;
  isArchived: ProjectFavoriteState;
  onNewProject: () => void;
  onOpenDisk: () => void;
  onClearSearch: () => void;
  /** Renders the visual preview inside a project card (e.g. 3-D thumbnail). */
  renderProjectPreview?: (project: ProjectItem, index: number) => ReactNode;
}

export function ProjectHubProjectList({
  projects,
  searchQuery,
  viewMode,
  isFavorite,
  isArchived,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
  onNewProject,
  onOpenDisk,
  onClearSearch,
  renderProjectPreview,
}: ProjectHubProjectListProps) {
  if (projects.length === 0) {
    return (
      <ProjectHubEmptyState
        searchQuery={searchQuery}
        onClearSearch={onClearSearch}
        onNewProject={onNewProject}
        onOpenDisk={onOpenDisk}
      />
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="h-full overflow-y-auto bg-transparent">
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:gap-4 sm:p-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.key}
              project={project}
              index={index}
              favorite={isFavorite(project)}
              archived={isArchived(project)}
              onOpen={() => onOpen(project)}
              onToggleFavorite={() => onToggleFavorite(project)}
              onToggleArchive={() => onToggleArchive(project)}
              onRemove={() => onRemove(project)}
              renderPreview={renderProjectPreview}
            />
          ))}
          <CreateProjectCard onNew={onNewProject} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[var(--sf-bg-app)]">
      {/* Desktop table view */}
      <div className="hidden h-full grid-rows-[auto_1fr] lg:grid">
        <div className="grid grid-cols-[132px_minmax(220px,1.3fr)_148px_150px_minmax(220px,1fr)_106px_158px] border-b border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-text-muted)]">
          <ColumnHeader>Durum</ColumnHeader>
          <ColumnHeader>Proje</ColumnHeader>
          <ColumnHeader>Tip</ColumnHeader>
          <ColumnHeader>Güncelleme</ColumnHeader>
          <ColumnHeader>Dosya Konumu</ColumnHeader>
          <ColumnHeader>Kaynak</ColumnHeader>
          <ColumnHeader alignRight>İşlemler</ColumnHeader>
        </div>
        <div className="overflow-y-auto">
          {projects.map((project) => (
            <ProjectRow
              key={project.key}
              project={project}
              favorite={isFavorite(project)}
              archived={isArchived(project)}
              onOpen={() => onOpen(project)}
              onToggleFavorite={() => onToggleFavorite(project)}
              onToggleArchive={() => onToggleArchive(project)}
              onRemove={() => onRemove(project)}
            />
          ))}
        </div>
      </div>

      {/* Mobile compact rows */}
      <div className="grid gap-2 overflow-y-auto p-3 lg:hidden">
        {projects.map((project) => (
          <ProjectCompactRow
            key={project.key}
            project={project}
            favorite={isFavorite(project)}
            archived={isArchived(project)}
            onOpen={() => onOpen(project)}
            onToggleFavorite={() => onToggleFavorite(project)}
            onToggleArchive={() => onToggleArchive(project)}
            onRemove={() => onRemove(project)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Grid card ───────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  index,
  favorite,
  archived,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
  renderPreview,
}: {
  project: ProjectItem;
  index: number;
  favorite: boolean;
  archived: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onRemove: () => void;
  renderPreview?: (project: ProjectItem, index: number) => ReactNode;
}) {
  const isWorkspace = project.source === "workspace";
  const TypeIcon = Landmark;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      className="group relative flex h-[250px] flex-col overflow-hidden rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] transition-[border-color,background-color] duration-200 ease-out hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-panel-raised)] sm:h-[294px]"
    >
      <button
        onClick={onOpen}
        className="relative min-h-0 w-full flex-1 cursor-pointer overflow-hidden text-left"
      >
        <div className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.015]">
          {renderPreview ? (
            renderPreview(project, index)
          ) : (
            <ProjectFallbackPreview project={project} seed={index} />
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/15" />

        {/* Minimal status overlay — icon-only, no text labels */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {favorite && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sf-bg-overlay)] text-[var(--sf-status-warning)] backdrop-blur-md">
              <Star className="h-3 w-3 fill-[var(--sf-status-warning)]" />
            </span>
          )}
          {archived && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sf-bg-panel)] text-[var(--sf-text-secondary)]">
              <Archive className="h-3 w-3" />
            </span>
          )}
          {isWorkspace && (
            <span
              className="h-2 w-2 rounded-full bg-[var(--sf-status-success)]"
              title="Açık çalışma alanı"
            />
          )}
        </div>
      </button>

      <div className="pointer-events-none relative z-10 w-full border-t border-[var(--sf-divider)] bg-[var(--sf-bg-toolbar)] px-4 py-3.5">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <button
            onClick={onOpen}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            <TypeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--sf-text-secondary)] transition-colors duration-150 group-hover:text-[var(--sf-action-primary-hover)]" />
            <h3 className="truncate text-[13px] font-semibold text-[var(--sf-text-primary)] transition-colors duration-150 group-hover:text-[var(--sf-action-primary-hover)]">
              {project.name}
            </h3>
          </button>
          <ProjectActionsMenu
            project={project}
            favorite={favorite}
            archived={archived}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onOpen={onOpen}
            onToggleFavorite={onToggleFavorite}
            onToggleArchive={onToggleArchive}
            onRemove={onRemove}
            placement="top"
          />
        </div>
        <div className="pointer-events-none mt-1 flex items-center justify-between pl-[22px] text-xs font-medium text-[var(--sf-text-secondary)]">
          <span className="truncate">{project.category}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-[var(--sf-text-muted)]">
            <Clock className="h-3 w-3" />
            {new Date(project.updatedAt)
              .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
              .toUpperCase()}
          </span>
        </div>
      </div>
    </article>
  );
}

function CreateProjectCard({ onNew }: { onNew: () => void }) {
  return (
    <button
      onClick={onNew}
      className="group relative flex h-[250px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-muted)] transition-[scale,background-color,color,border-color] duration-200 ease-out hover:border-[var(--sf-border-active)] hover:bg-[var(--sf-bg-selected)] hover:text-[var(--sf-action-primary-hover)] active:scale-[0.96] sm:h-[294px]"
    >
      <span className="relative mb-3.5 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] transition-[background-color,border-color] duration-200 group-hover:border-[var(--sf-border-active)] group-hover:bg-[var(--sf-action-primary-subtle)]">
        <Plus className="h-5 w-5 transition-colors" />
      </span>
      <span className="relative text-[12px] font-semibold tracking-wide text-[var(--sf-text-secondary)] transition-colors group-hover:text-[var(--sf-action-primary-hover)]">
        Yeni Proje
      </span>
    </button>
  );
}

/** SVG fallback when no renderPreview function is provided */
function ProjectFallbackPreview({
  project,
  seed,
}: {
  project: ProjectItem;
  seed: number;
}) {
  if (project.projectType === "retaining-wall") {
    return (
      <svg
        className="h-full w-full"
        viewBox="0 0 360 158"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="360" height="158" fill="#070a13" />
        <g stroke="rgba(99,102,241,0.06)" strokeWidth="1">
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 45} y1="0" x2={i * 45} y2="158" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 40} x2="360" y2={i * 40} />
          ))}
        </g>
        <rect
          x="0"
          y="108"
          width="360"
          height="50"
          fill="rgba(120,100,50,0.14)"
        />
        <line
          x1="0"
          y1="108"
          x2="360"
          y2="108"
          stroke="rgba(120,100,50,0.28)"
          strokeWidth="1"
        />
        <path
          d="M132 28 L172 28 L186 108 L112 108 Z"
          fill="rgba(99,102,241,0.1)"
          stroke="rgba(99,102,241,0.3)"
          strokeWidth="1.2"
        />
        <rect
          x="96"
          y="104"
          width="96"
          height="16"
          fill="rgba(99,102,241,0.11)"
          stroke="rgba(99,102,241,0.28)"
          strokeWidth="1"
        />
        <path
          d="M172 28 L268 28 L268 108 L186 108 Z"
          fill="rgba(120,100,50,0.2)"
        />
        <line
          x1="88"
          y1="28"
          x2="88"
          y2="108"
          stroke="rgba(99,102,241,0.2)"
          strokeWidth="0.5"
          strokeDasharray="2 3"
        />
        <text
          x="76"
          y="72"
          fill="rgba(99,102,241,0.4)"
          fontSize="8"
          fontFamily="monospace"
          textAnchor="middle"
          transform="rotate(-90,76,72)"
        >
          H=6m
        </text>
      </svg>
    );
  }

  // Generic fallback — vary slightly by seed
  const variants = ["#050810", "#04070d", "#050912"];
  const bg = variants[seed % variants.length];
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 360 158"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="360" height="158" fill={bg} />
      <g stroke="rgba(14,165,233,0.07)" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 45} y1="0" x2={i * 45} y2="158" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="360" y2={i * 40} />
        ))}
      </g>
      <g stroke="rgba(14,165,233,0.32)" strokeWidth="1.2" fill="none">
        <line x1="52" y1="22" x2="52" y2="130" />
        <line x1="308" y1="22" x2="308" y2="130" />
        <line
          x1="130"
          y1="48"
          x2="130"
          y2="130"
          stroke="rgba(14,165,233,0.22)"
        />
        <line
          x1="196"
          y1="48"
          x2="196"
          y2="130"
          stroke="rgba(14,165,233,0.22)"
        />
        <line x1="52" y1="90" x2="308" y2="90" stroke="rgba(14,165,233,0.25)" />
        <line x1="52" y1="55" x2="308" y2="55" stroke="rgba(14,165,233,0.2)" />
        <polyline points="52,22 180,10 308,22" />
      </g>
      <circle
        cx="52"
        cy="142"
        r="6"
        fill="none"
        stroke="rgba(14,165,233,0.28)"
        strokeWidth="0.8"
      />
      <text
        x="52"
        y="145"
        fill="rgba(14,165,233,0.4)"
        fontSize="5.5"
        fontFamily="monospace"
        textAnchor="middle"
      >
        A
      </text>
      <circle
        cx="180"
        cy="142"
        r="6"
        fill="none"
        stroke="rgba(14,165,233,0.22)"
        strokeWidth="0.8"
      />
      <text
        x="180"
        y="145"
        fill="rgba(14,165,233,0.35)"
        fontSize="5.5"
        fontFamily="monospace"
        textAnchor="middle"
      >
        B
      </text>
      <circle
        cx="308"
        cy="142"
        r="6"
        fill="none"
        stroke="rgba(14,165,233,0.28)"
        strokeWidth="0.8"
      />
      <text
        x="308"
        y="145"
        fill="rgba(14,165,233,0.4)"
        fontSize="5.5"
        fontFamily="monospace"
        textAnchor="middle"
      >
        C
      </text>
    </svg>
  );
}

// ─── List / table view ────────────────────────────────────────────────────────

function ProjectRow({
  project,
  favorite,
  archived,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
}: {
  project: ProjectItem;
  favorite: boolean;
  archived: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      className="grid min-h-[58px] grid-cols-[132px_minmax(220px,1.3fr)_148px_150px_minmax(220px,1fr)_106px_158px] border-b border-[var(--sf-divider)] bg-[var(--sf-bg-app)] text-[12.5px] text-[var(--sf-text-secondary)] transition-[background-color] duration-150 hover:bg-[var(--sf-bg-hover)]"
    >
      <Cell>
        <ProjectStatus project={project} />
      </Cell>
      <Cell>
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="truncate font-semibold text-[var(--sf-text-primary)]">
            {project.name}
          </div>
          {project.dirty && (
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--sf-status-warning)]">
              Kaydedilmemiş
            </div>
          )}
        </button>
      </Cell>
      <Cell>
        <ProjectTypeBadge project={project} />
      </Cell>
      <Cell>
        <div className="tabular-nums font-mono text-xs text-[var(--sf-text-secondary)]">
          {formatProjectDate(project.updatedAt)}
        </div>
        <div className="mt-0.5 tabular-nums font-mono text-xs text-[var(--sf-text-muted)]">
          {formatProjectTime(project.updatedAt)}
        </div>
      </Cell>
      <Cell>
        <span className="truncate font-mono text-xs text-[var(--sf-text-muted)]">
          {project.path ?? "Geçici çalışma alanı"}
        </span>
      </Cell>
      <Cell>
        <span className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-[0.09em] text-[var(--sf-text-muted)]">
          {project.source === "workspace" ? "Açık" : "Recent"}
        </span>
      </Cell>
      <Cell alignRight>
        <ProjectActionsMenu
          project={project}
          favorite={favorite}
          archived={archived}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onToggleArchive={onToggleArchive}
          onRemove={onRemove}
        />
      </Cell>
    </div>
  );
}

function ProjectCompactRow({
  project,
  favorite,
  archived,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
}: {
  project: ProjectItem;
  favorite: boolean;
  archived: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      className="rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="truncate text-[13px] font-semibold text-[var(--sf-text-primary)]">
            {project.name}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--sf-text-muted)]">
            <ProjectTypeBadge project={project} />
            <span className="tabular-nums font-mono">
              {formatProjectDate(project.updatedAt)}
            </span>
          </div>
        </button>
        <ProjectActionsMenu
          project={project}
          favorite={favorite}
          archived={archived}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onToggleArchive={onToggleArchive}
          onRemove={onRemove}
        />
      </div>
      <div className="mt-3 truncate border-t border-[var(--sf-divider)] pt-2 font-mono text-xs text-[var(--sf-text-muted)]">
        {project.path ?? "Geçici çalışma alanı"}
      </div>
    </div>
  );
}

function ProjectStatus({ project }: { project: ProjectItem }) {
  const active = project.source === "workspace";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[2px] px-2 py-1 text-xs font-semibold uppercase tracking-[0.09em] ${
        active
          ? "bg-[var(--sf-status-success-bg)] text-[var(--sf-status-success)]"
          : "bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-muted)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--sf-status-success)]" : "bg-[var(--sf-text-disabled)]"}`}
      />
      {active ? "Açık" : "Kayıt"}
    </span>
  );
}

function ProjectTypeBadge({ project }: { project: ProjectItem }) {
  const Icon = Landmark;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded px-2 py-1 text-xs font-medium text-[var(--sf-text-secondary)]">
      <Icon className="h-3.5 w-3.5 text-[var(--sf-text-muted)]" />
      <span className="truncate">{project.category}</span>
    </span>
  );
}

function ColumnHeader({
  children,
  alignRight,
}: {
  children: ReactNode;
  alignRight?: boolean;
}) {
  return (
    <div className={`px-3 py-2.5 ${alignRight ? "text-right" : ""}`}>
      {children}
    </div>
  );
}

function Cell({
  children,
  alignRight,
}: {
  children: ReactNode;
  alignRight?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center px-3 py-2 ${alignRight ? "justify-end" : ""}`}
    >
      {children}
    </div>
  );
}
