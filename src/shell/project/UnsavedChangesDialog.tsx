"use client";

import { LoaderCircle, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PROJECT_TYPE_LABELS } from '@/core/workspace/projectTypes';
import type {
  UnsavedCloseAction,
  WorkspaceTab,
} from '@/shell/project/projectPayloadFactory';

type UnsavedChangesDialogProps = {
  open: boolean;
  isAppClose: boolean;
  dirtyTabs: WorkspaceTab[];
  busyAction: UnsavedCloseAction | null;
  onOpenChange: (open: boolean) => void;
  onResolve: (action: UnsavedCloseAction) => void;
};

export function UnsavedChangesDialog({
  open,
  isAppClose,
  dirtyTabs,
  busyAction,
  onOpenChange,
  onResolve,
}: UnsavedChangesDialogProps) {
  const isBusy = busyAction !== null;
  const description = isAppClose
    ? 'Uygulamayı kapatmadan önce yaptığınız değişiklikleri kaydetmek ister misiniz?'
    : 'Projeyi kapatmadan önce yaptığınız değişiklikleri kaydetmek ister misiniz?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] gap-0 overflow-hidden rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-0 text-[var(--sf-text-primary)] shadow-xl ring-0 duration-150"
      >
        <DialogHeader className="px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]">
              <TriangleAlert className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-balance text-[15px] font-semibold leading-5 text-[var(--sf-text-primary)]">
                Değişiklikleri kaydet?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-pretty text-[12px] leading-[18px] text-[var(--sf-text-secondary)]">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)]">
            {dirtyTabs.slice(0, 3).map((tab) => (
              <div
                key={tab.id}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--sf-divider)] px-3 last:border-b-0"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sf-status-warning)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium leading-4 text-[var(--sf-text-primary)]">{tab.name}</div>
                  <div className="mt-0.5 text-xs leading-4 text-[var(--sf-text-muted)]">
                    {PROJECT_TYPE_LABELS[tab.projectType]}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[var(--sf-text-muted)]">Kaydedilmedi</span>
              </div>
            ))}
            {dirtyTabs.length > 3 && (
              <div className="border-t border-[var(--sf-divider)] px-3 py-2 text-xs text-[var(--sf-text-muted)]">
                +{dirtyTabs.length - 3} proje daha
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-end gap-2 rounded-none border-t border-[var(--sf-divider)] bg-[var(--sf-bg-panel-raised)] px-4 py-3">
          <Button
            variant="ghost"
            disabled={isBusy}
            onClick={() => onResolve('cancel')}
            className="h-10 rounded-lg px-3 text-[12px] text-[var(--sf-text-secondary)] transition-[transform,background-color,color] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] active:translate-y-0 active:scale-[0.96]"
          >
            İptal
          </Button>
          <Button
            variant="ghost"
            disabled={isBusy}
            onClick={() => onResolve('discard')}
            className="h-10 rounded-lg px-3 text-[12px] text-[var(--sf-status-danger)] transition-[transform,background-color,color] hover:bg-[var(--sf-status-danger-bg)] active:translate-y-0 active:scale-[0.96]"
          >
            Kaydetmeden çık
          </Button>
          <Button
            disabled={isBusy}
            onClick={() => onResolve('save')}
            className="h-10 min-w-[76px] rounded-lg px-3 text-[12px] transition-[transform,background-color] active:translate-y-0 active:scale-[0.96]"
          >
            {busyAction === 'save' && (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
            )}
            {busyAction === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
