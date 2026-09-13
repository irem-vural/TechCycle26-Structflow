"use client";

import { FolderOpen, Plus, Search } from "lucide-react";

interface ProjectHubEmptyStateProps {
  searchQuery: string;
  onClearSearch: () => void;
  onNewProject: () => void;
  onOpenDisk: () => void;
}

export function ProjectHubEmptyState({
  searchQuery,
  onClearSearch,
  onNewProject,
  onOpenDisk,
}: ProjectHubEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-transparent p-8">
      <div className="w-full max-w-[560px] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-muted)]">
          <Search className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-balance text-[19px] font-semibold tracking-tight text-[var(--sf-text-primary)]">
          Gösterilecek proje yok
        </h2>
        <p className="mt-2 text-pretty text-[13px] leading-5 text-[var(--sf-text-muted)]">
          {searchQuery
            ? "Arama ya da seçili filtreyle eşleşen proje bulunamadı."
            : "Yeni bir model oluşturun veya mevcut bir StructFlow dosyasını açın."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="h-10 rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3.5 text-[12px] font-medium text-[var(--sf-text-secondary)] transition-colors duration-150 hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
            >
              Aramayı Temizle
            </button>
          )}
          <button
            type="button"
            onClick={onOpenDisk}
            className="flex h-10 items-center gap-2 rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3.5 text-[12px] font-medium text-[var(--sf-text-secondary)] transition-colors duration-150 hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
          >
            <FolderOpen className="h-4 w-4" />
            Proje Aç
          </button>
          <button
            type="button"
            onClick={onNewProject}
            className="flex h-10 items-center gap-2 rounded-md bg-[var(--sf-control-primary-bg)] pl-3.5 pr-3 text-[12px] font-semibold text-[var(--sf-text-on-accent)] transition-colors duration-150 hover:bg-[var(--sf-control-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            Yeni Proje
          </button>
        </div>
      </div>
    </div>
  );
}
