import type {
  ProjectPayload,
  ProjectType,
} from "@/core/workspace/projectTypes";

export type ManagerView =
  | "projects"
  | "recent"
  | "favorites"
  | "templates"
  | "archived";
export type ViewMode = "grid" | "list";
export type ProjectFilter = "all" | "active" | "favorites";
export type SortMode = "updated-desc" | "updated-asc" | "name-asc";
export type ProjectSource = "workspace" | "recent";

export interface ProjectItem {
  key: string;
  source: ProjectSource;
  id?: string;
  path?: string;
  name: string;
  category: string;
  projectType: ProjectType;
  updatedAt: string;
  dirty: boolean;
  payload?: ProjectPayload;
}

export type ProjectFavoriteState = (project: ProjectItem) => boolean;

export interface ProjectActionHandlers {
  onOpen: (project: ProjectItem) => void;
  onToggleFavorite: (project: ProjectItem) => void;
  onToggleArchive: (project: ProjectItem) => void;
  onRemove: (project: ProjectItem) => void;
}
