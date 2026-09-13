"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  FolderOpen,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import type { ProjectItem } from "./types";

interface ProjectActionsMenuProps {
  project: ProjectItem;
  favorite: boolean;
  archived: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onRemove: () => void;
  /** Which side of the trigger the dropdown opens toward. Defaults to "bottom". */
  placement?: "top" | "bottom";
}

export function ProjectActionsMenu({
  project,
  favorite,
  archived,
  open,
  onOpenChange,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onRemove,
  placement = "bottom",
}: ProjectActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const canPersist = Boolean(project.path);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,color] duration-150 ${
          open
            ? "bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]"
            : "text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
        }`}
        title="Proje işlemleri"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`absolute right-0 z-30 w-52 overflow-hidden rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] py-1.5 shadow-xl ${
            placement === "top"
              ? "bottom-[calc(100%+6px)]"
              : "top-[calc(100%+6px)]"
          }`}
        >
          <MenuAction
            icon={<FolderOpen className="h-4 w-4" />}
            label="Aç"
            onClick={() => run(onOpen)}
          />
          <MenuAction
            icon={
              <Star
                className={`h-4 w-4 ${favorite ? "fill-[var(--sf-status-warning)] text-[var(--sf-status-warning)]" : ""}`}
              />
            }
            label={favorite ? "Favoriden çıkar" : "Favoriye ekle"}
            disabled={!canPersist}
            onClick={() => run(onToggleFavorite)}
          />
          <MenuAction
            icon={
              <Archive
                className={`h-4 w-4 ${archived ? "text-[var(--sf-action-primary-hover)]" : ""}`}
              />
            }
            label={archived ? "Arşivden çıkar" : "Arşivle"}
            disabled={!canPersist}
            onClick={() => run(onToggleArchive)}
          />
          <div className="my-1 h-px bg-[var(--sf-divider)]" />
          <MenuAction
            danger
            icon={<Trash2 className="h-4 w-4" />}
            label={
              project.source === "workspace" ? "Projeyi kapat" : "Listeden sil"
            }
            onClick={() => run(onRemove)}
          />
        </div>
      )}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 px-3 text-left text-[12.5px] font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "text-[var(--sf-status-danger)] hover:bg-[var(--sf-status-danger-bg)]"
          : "text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
      }`}
    >
      <span className={danger ? "text-[var(--sf-status-danger)]" : "text-[var(--sf-text-muted)]"}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
