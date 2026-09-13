"use client";

import React, { useState } from "react";
import { Landmark, X } from "lucide-react";
import type { NewProjectOptions } from "@/shell/project/projectPayloadFactory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NewProjectDialogProps {
  onClose: () => void;
  onSelect: (options?: NewProjectOptions) => void;
}

export function NewProjectDialog({
  onClose,
  onSelect,
}: NewProjectDialogProps) {
  const [projectName, setProjectName] = useState("Yeni İstinat Duvarı Projesi");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim() || "Yeni İstinat Duvarı Projesi";
    onSelect({ name });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-4 text-[var(--sf-text-primary)] sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-action-primary-hover)]">
                <Landmark className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-[var(--sf-text-primary)]">
                  Yeni İstinat Duvarı Projesi
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--sf-text-muted)]">
                  Stabilite analizi ve donatı tasarımı çalışma alanı
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--sf-text-muted)] transition-colors hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="projectName" className="mb-1.5 block text-xs font-medium text-[var(--sf-text-secondary)]">
              Proje Adı
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Örn: Konsol İstinat Duvarı A Blok"
              className="w-full rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-3 py-2 text-sm text-[var(--sf-text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--sf-text-muted)] focus:border-[var(--sf-border-focus)] focus:ring-1 focus:ring-[var(--sf-border-focus)]"
              autoFocus
            />
          </div>

          <div className="flex flex-col-reverse items-stretch justify-end gap-2 pt-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] sm:w-auto"
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="w-full bg-[var(--sf-control-primary-bg)] text-[var(--sf-text-on-accent)] hover:bg-[var(--sf-control-primary-hover)] sm:w-auto"
            >
              Proje Oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
