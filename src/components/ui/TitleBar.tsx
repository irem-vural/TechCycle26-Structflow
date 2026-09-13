'use client';

import React from 'react';
import Image from 'next/image';
import { publicAsset } from '@/lib/publicAsset';
import {
  Add20Regular,
  ArrowRedo16Regular,
  ArrowUndo16Regular,
  Checkmark12Regular,
  ChevronDown12Regular,
  Dismiss12Regular,
  DocumentSave20Regular,
  FolderOpen16Regular,
  FolderOpen20Regular,
  Save16Regular,
} from '@fluentui/react-icons';

export interface TitleBarMenuItem {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export interface TitleBarMenuGroup {
  id: string;
  label: string;
  items: (TitleBarMenuItem | 'separator')[];
}

export interface TitleBarTab {
  id: string;
  name: string;
  dirty?: boolean;
  projectType?: string;
}

interface TitleBarProps {
  mode?: 'workspace' | 'manager';
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  workspaceTitle?: string;
  dirty?: boolean;
  menuGroups?: TitleBarMenuGroup[];
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenProject?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  tabs?: TitleBarTab[];
  activeTabId?: string;
  onTabSwitch?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
}

export default function TitleBar({
  mode = 'workspace',
  menuGroups = [],
  workspaceTitle,
  dirty,
  onSave,
  onSaveAs,
  onOpenProject,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
  tabs = [],
  activeTabId = '',
  onTabSwitch,
  onTabClose,
  onNewTab,
}: TitleBarProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const brandRef = React.useRef<HTMLDivElement | null>(null);
  const projectMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) setProjectMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div
      className="relative z-50 flex h-10 w-full min-w-0 shrink-0 select-none items-center overflow-visible border-b border-[var(--sf-divider)] bg-[var(--sf-bg-titlebar)] sm:h-9"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: brand, file operations and history */}
      <div
        className="relative flex h-full shrink-0 items-stretch"
        ref={brandRef}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => mode === 'workspace' && menuGroups.length ? setMenuOpen((o) => !o) : undefined}
          aria-label={mode === 'workspace' && menuGroups.length ? 'StructFlow menüsünü aç' : 'StructFlow'}
          aria-expanded={mode === 'workspace' && menuGroups.length ? menuOpen : undefined}
          title={mode === 'workspace' && menuGroups.length ? 'StructFlow menüsü' : 'StructFlow'}
          className={`group flex h-full w-11 items-center justify-center border-r transition-colors ${
            mode === 'workspace' && menuGroups.length
              ? menuOpen
                ? 'border-[var(--sf-border-default)] bg-[var(--sf-bg-selected)]'
                : 'border-transparent hover:border-[var(--sf-border-default)] hover:bg-[var(--sf-bg-hover)]'
              : 'border-transparent'
          }`}
        >
          <span className="relative flex items-center justify-center">
            <Image src={publicAsset("sflogo.svg")} alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </span>
        </button>

        {menuOpen && mode === 'workspace' && (
          <AppMenu menuGroups={menuGroups} onClose={() => setMenuOpen(false)} />
        )}

        {mode === 'workspace' && (
          <div className="hidden h-full items-center gap-0.5 px-1.5 sm:flex">
            <TitleIconAction tone="neutral" icon={<ArrowUndo16Regular />} label="Geri Al (Ctrl+Z)" onClick={onUndo} disabled={!onUndo || !canUndo} />
            <TitleIconAction tone="neutral" icon={<ArrowRedo16Regular />} label="İleri Al (Ctrl+Y)" onClick={onRedo} disabled={!onRedo || !canRedo} />
            <span className="mx-1 h-4 w-px bg-[var(--sf-divider)]" />
            <TitleIconAction tone="neutral" icon={<Save16Regular />} label="Kaydet (Ctrl+S)" onClick={onSave} disabled={!onSave} />
            <TitleIconAction tone="neutral" icon={<DocumentSave20Regular />} label="Farklı Kaydet (Ctrl+Shift+S)" onClick={onSaveAs} disabled={!onSaveAs} />
            <TitleIconAction tone="neutral" icon={<FolderOpen16Regular />} label="Proje Aç (Ctrl+O)" onClick={onOpenProject} disabled={!onOpenProject} />
          </div>
        )}
      </div>

      {/* Center: active project switcher */}
      {mode === 'workspace' && tabs.length > 0 && (
        <div
          ref={projectMenuRef}
          className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setProjectMenuOpen((open) => !open)}
            aria-expanded={projectMenuOpen}
            aria-haspopup="menu"
            className={`flex h-8 min-w-0 max-w-[calc(100vw-96px)] items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-[background-color,color,transform] active:scale-[0.96] sm:min-w-[190px] sm:max-w-[340px] sm:gap-2 sm:px-3 ${projectMenuOpen ? 'bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]' : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'}`}
          >
            <span className="truncate">{workspaceTitle ?? tabs.find((tab) => tab.id === activeTabId)?.name}</span>
            {(dirty ?? tabs.find((tab) => tab.id === activeTabId)?.dirty) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sf-status-warning)]" title="Kaydedilmemiş değişiklikler" />}
            <ChevronDown12Regular className={`shrink-0 text-[var(--sf-text-muted)] transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {projectMenuOpen && (
            <ProjectSwitcher
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={(id) => { onTabSwitch?.(id); setProjectMenuOpen(false); }}
              onClose={onTabClose}
              onNew={() => { onNewTab?.(); setProjectMenuOpen(false); }}
              onOpen={() => { onOpenProject?.(); setProjectMenuOpen(false); }}
            />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1" />
      <div className="w-10 shrink-0 sm:w-36" />
    </div>
  );
}

function ProjectSwitcher({ tabs, activeTabId, onSwitch, onClose, onNew, onOpen }: {
  tabs: TitleBarTab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose?: (id: string) => void;
  onNew: () => void;
  onOpen: () => void;
}) {
  return (
    <div role="menu" className="absolute left-1/2 top-full mt-1 w-[min(320px,calc(100vw-8px))] max-w-[calc(100vw-8px)] -translate-x-1/2 overflow-hidden rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] py-1 text-[var(--sf-text-primary)] shadow-xl">
      <div className="px-1">
        <ProjectMenuAction icon={<Add20Regular />} label="Yeni Proje" shortcut="Ctrl+N" onClick={onNew} />
        <ProjectMenuAction icon={<FolderOpen20Regular />} label="Proje Aç" shortcut="Ctrl+O" onClick={onOpen} />
      </div>
      <div className="mx-2 my-1 h-px bg-[var(--sf-divider)]" />
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sf-text-muted)]">
        <span>Açık Projeler</span>
        <span className="tabular-nums text-[var(--sf-text-disabled)]">{tabs.length}</span>
      </div>
      <div className="max-h-[264px] overflow-y-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div key={tab.id} className={`group flex h-9 items-center rounded ${active ? 'bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]' : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'}`}>
              <button type="button" role="menuitem" onClick={() => onSwitch(tab.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left">
                <span className={`h-1 w-1 shrink-0 rounded-full ${active ? 'bg-[var(--sf-action-primary)]' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{tab.name}</span>
                {tab.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sf-status-warning)]" />}
                {active && <Checkmark12Regular className="shrink-0 text-[var(--sf-text-secondary)]" />}
              </button>
              {onClose && (
                <button type="button" onClick={() => onClose(tab.id)} title={`${tab.name} projesini kapat`} className="mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--sf-text-disabled)] opacity-0 transition-[background-color,color,opacity,transform] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100">
                  <Dismiss12Regular />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectMenuAction({ icon, label, shortcut, onClick }: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex h-9 w-full items-center gap-2.5 rounded px-2 text-left text-xs text-[var(--sf-text-secondary)] transition-[background-color,color,transform] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] active:scale-[0.96]">
      <span className="h-4 w-4 shrink-0 text-[var(--sf-text-muted)] [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-xs tabular-nums text-[var(--sf-text-disabled)]">{shortcut}</span>
    </button>
  );
}

// ============================================================
// AppMenu — yoğun mühendislik uygulaması tarzında proje menüsü
// ============================================================

function AppMenu({
  menuGroups,
  onClose,
}: {
  menuGroups: TitleBarMenuGroup[];
  onClose: () => void;
}) {
  const [hovered, setHovered] = React.useState<TitleBarMenuItem | null>(null);

  const primary = menuGroups[0];
  const secondary = menuGroups.slice(1);

  return (
    <div
      className="absolute left-0 top-full z-50 mt-0 flex max-h-[calc(100dvh-3rem)] w-[min(540px,calc(100vw-8px))] max-w-[calc(100vw-8px)] flex-col overflow-hidden rounded-b-lg border border-t-0 border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-primary)] shadow-2xl sm:flex-row"
    >
      {/* Sol kolon — ana menü */}
      <div className="flex min-h-0 w-full flex-col border-b border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] sm:w-[300px] sm:shrink-0 sm:border-b-0 sm:border-r">
        {primary && (
          <div className="flex-1 overflow-y-auto py-2.5">
            <SectionLabel>{primary.label}</SectionLabel>
            <ul className="px-1.5">
              {primary.items.map((item, i) =>
                item === 'separator' ? (
                  <li key={`sep-${i}`} className="my-1.5 h-px bg-[var(--sf-divider)]" />
                ) : (
                  <AppMenuRow
                    key={`${primary.id}-${item.label}-${i}`}
                    item={item}
                    onHover={setHovered}
                    onClose={onClose}
                  />
                )
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Sağ kolon — ikincil gruplar */}
      <div className="flex flex-1 flex-col bg-[var(--sf-bg-panel-raised)]">
        {secondary.length > 0 ? (
          <div className="flex-1 overflow-y-auto py-2">
            {secondary.map((group) => (
              <div key={group.id} className="mb-2">
                <SectionLabel>{group.label}</SectionLabel>
                <ul className="px-1.5">
                  {group.items.map((item, i) =>
                    item === 'separator' ? (
                      <li key={`sep-${group.id}-${i}`} className="my-1.5 h-px bg-[var(--sf-divider)]" />
                    ) : (
                      <AppMenuRow
                        key={`${group.id}-${item.label}-${i}`}
                        item={item}
                        compact
                        onHover={setHovered}
                        onClose={onClose}
                      />
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-[var(--sf-text-disabled)]">
            Proje komutları
          </div>
        )}

        {/* Hover hint footer */}
        <div className="min-h-[48px] border-t border-[var(--sf-divider)] bg-[var(--sf-bg-toolbar)] px-4 py-2.5">
          {hovered ? (
            <>
              <div className="text-xs font-semibold text-[var(--sf-text-primary)]">{hovered.label}</div>
              {hovered.shortcut && (
                <div className="mt-0.5 text-xs tabular-nums text-[var(--sf-text-muted)]">
                  Kısayol: <span className="font-semibold text-[var(--sf-text-secondary)]">{hovered.shortcut}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs leading-relaxed text-[var(--sf-text-muted)]">
              Komut seçmek için fareyi bir öğe üzerinde gezdir.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TitleIconAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'neutral';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const toneClasses = {
    neutral: disabled ? 'text-[var(--sf-text-disabled)]' : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-[background-color,color,transform] active:scale-[0.96] ${disabled ? 'cursor-default' : ''} ${toneClasses[tone]}`}
    >
      <span className="flex h-4 w-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 px-3 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--sf-text-muted)]">
      {children}
    </div>
  );
}

function AppMenuRow({
  item,
  compact,
  onHover,
  onClose,
}: {
  item: TitleBarMenuItem;
  compact?: boolean;
  onHover: (item: TitleBarMenuItem | null) => void;
  onClose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (item.disabled) return;
          item.onClick?.();
          onClose();
        }}
        disabled={item.disabled}
        onMouseEnter={() => onHover(item)}
        onMouseLeave={() => onHover(null)}
        className={`flex w-full items-center gap-3 rounded-md px-2.5 text-left transition-colors ${
          compact ? 'h-8' : 'h-10'
        } ${
          item.disabled
            ? 'cursor-not-allowed text-[var(--sf-text-disabled)]'
            : item.active
            ? 'bg-[var(--sf-action-primary-subtle)] text-[var(--sf-action-primary-hover)] ring-1 ring-[var(--sf-border-active)]'
            : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-md ${
            compact ? 'h-6 w-6' : 'h-7 w-7'
          } ${
            item.disabled
              ? 'bg-[var(--sf-bg-disabled)] text-[var(--sf-text-disabled)]'
              : item.active
              ? 'bg-[var(--sf-bg-selected)] text-[var(--sf-action-primary-hover)] ring-1 ring-[var(--sf-border-active)]'
              : 'bg-[var(--sf-bg-input)] text-[var(--sf-text-secondary)]'
          } [&_svg]:h-[15px] [&_svg]:w-[15px]`}
        >
          {item.active && !item.icon ? <Checkmark12Regular /> : item.icon ?? <span />}
        </span>
        <span className="flex-1 truncate text-xs font-semibold">
          {item.label}
        </span>
        {item.shortcut && (
          <span className="ml-2 shrink-0 rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--sf-text-muted)]">
            {item.shortcut}
          </span>
        )}
      </button>
    </li>
  );
}
