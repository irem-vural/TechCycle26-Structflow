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
      className="relative z-50 flex h-9 w-full shrink-0 select-none items-center border-b border-[var(--sf-divider)] bg-[var(--sf-bg-titlebar)]"
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
                ? 'border-white/[0.06] bg-[#0d1320]'
                : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]'
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
          <div className="flex h-full items-center gap-0.5 px-1.5">
            <TitleIconAction tone="neutral" icon={<ArrowUndo16Regular />} label="Geri Al (Ctrl+Z)" onClick={onUndo} disabled={!onUndo || !canUndo} />
            <TitleIconAction tone="neutral" icon={<ArrowRedo16Regular />} label="İleri Al (Ctrl+Y)" onClick={onRedo} disabled={!onRedo || !canRedo} />
            <span className="mx-1 h-4 w-px bg-white/[0.07]" />
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
            className={`flex h-7 min-w-[190px] max-w-[340px] items-center justify-center gap-2 rounded-md px-3 text-[11.5px] font-medium transition-[background-color,color,transform] active:scale-[0.96] ${projectMenuOpen ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.045] hover:text-zinc-50'}`}
          >
            <span className="truncate">{workspaceTitle ?? tabs.find((tab) => tab.id === activeTabId)?.name}</span>
            {(dirty ?? tabs.find((tab) => tab.id === activeTabId)?.dirty) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Kaydedilmemiş değişiklikler" />}
            <ChevronDown12Regular className={`shrink-0 text-zinc-500 transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} />
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
      <div className="w-36 shrink-0" />
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
    <div role="menu" className="absolute left-1/2 top-full mt-1 w-[320px] -translate-x-1/2 overflow-hidden rounded-md bg-[#101216] py-1 shadow-[0_12px_28px_rgba(0,0,0,0.46),0_0_0_1px_rgba(255,255,255,0.09)]">
      <div className="px-1">
        <ProjectMenuAction icon={<Add20Regular />} label="Yeni Proje" shortcut="Ctrl+N" onClick={onNew} />
        <ProjectMenuAction icon={<FolderOpen20Regular />} label="Proje Aç" shortcut="Ctrl+O" onClick={onOpen} />
      </div>
      <div className="mx-2 my-1 h-px bg-white/[0.07]" />
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        <span>Açık Projeler</span>
        <span className="tabular-nums text-zinc-600">{tabs.length}</span>
      </div>
      <div className="max-h-[264px] overflow-y-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div key={tab.id} className={`group flex h-8 items-center rounded ${active ? 'bg-white/[0.065] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
              <button type="button" role="menuitem" onClick={() => onSwitch(tab.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left">
                <span className={`h-1 w-1 shrink-0 rounded-full ${active ? 'bg-sky-400' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{tab.name}</span>
                {tab.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
                {active && <Checkmark12Regular className="shrink-0 text-zinc-400" />}
              </button>
              {onClose && (
                <button type="button" onClick={() => onClose(tab.id)} title={`${tab.name} projesini kapat`} className="mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-600 opacity-0 transition-[background-color,color,opacity,transform] hover:bg-white/[0.07] hover:text-zinc-200 active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100">
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
    <button type="button" role="menuitem" onClick={onClick} className="flex h-8 w-full items-center gap-2.5 rounded px-2 text-left text-[11.5px] text-zinc-300 transition-[background-color,color,transform] hover:bg-white/[0.05] hover:text-zinc-50 active:scale-[0.96]">
      <span className="h-4 w-4 shrink-0 text-zinc-500 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-[9.5px] tabular-nums text-zinc-600">{shortcut}</span>
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
      className="absolute left-0 top-full z-50 mt-0 flex w-[540px] overflow-hidden rounded-b-lg border border-t-0 border-white/[0.07] bg-[#0a0e14] shadow-2xl shadow-black/70"
    >
      {/* Sol kolon — ana menü */}
      <div className="flex w-[300px] flex-col border-r border-white/[0.06] bg-[#0a0e14]">
        {primary && (
          <div className="flex-1 overflow-y-auto py-2.5">
            <SectionLabel>{primary.label}</SectionLabel>
            <ul className="px-1.5">
              {primary.items.map((item, i) =>
                item === 'separator' ? (
                  <li key={`sep-${i}`} className="my-1.5 h-px bg-white/[0.05]" />
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
      <div className="flex flex-1 flex-col bg-[#080c12]">
        {secondary.length > 0 ? (
          <div className="flex-1 overflow-y-auto py-2">
            {secondary.map((group) => (
              <div key={group.id} className="mb-2">
                <SectionLabel>{group.label}</SectionLabel>
                <ul className="px-1.5">
                  {group.items.map((item, i) =>
                    item === 'separator' ? (
                      <li key={`sep-${group.id}-${i}`} className="my-1.5 h-px bg-white/[0.05]" />
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
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] text-zinc-600">
            Proje komutları
          </div>
        )}

        {/* Hover hint footer */}
        <div className="min-h-[48px] border-t border-white/[0.06] bg-[#0a0e14] px-4 py-2.5">
          {hovered ? (
            <>
              <div className="text-[11px] font-semibold text-zinc-200">{hovered.label}</div>
              {hovered.shortcut && (
                <div className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
                  Kısayol: <span className="font-semibold text-zinc-300">{hovered.shortcut}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-[10.5px] leading-relaxed text-zinc-600">
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
    neutral: disabled ? 'text-zinc-500' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
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
    <div className="mt-1 px-3 pb-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-zinc-500">
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
            ? 'cursor-not-allowed text-zinc-600'
            : item.active
            ? 'bg-sky-500/12 text-sky-200 ring-1 ring-sky-400/25'
            : 'text-zinc-300 hover:bg-white/[0.055] hover:text-zinc-50'
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-md ${
            compact ? 'h-6 w-6' : 'h-7 w-7'
          } ${
            item.disabled
              ? 'bg-white/[0.025] text-zinc-700'
              : item.active
              ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30'
              : 'bg-white/[0.04] text-zinc-400'
          } [&_svg]:h-[15px] [&_svg]:w-[15px]`}
        >
          {item.active && !item.icon ? <Checkmark12Regular /> : item.icon ?? <span />}
        </span>
        <span className={`flex-1 truncate ${compact ? 'text-[11px]' : 'text-[12px] font-semibold'}`}>
          {item.label}
        </span>
        {item.shortcut && (
          <span className="ml-2 shrink-0 rounded border border-white/[0.06] bg-[#0a0f17] px-1.5 py-0.5 text-[9.5px] tabular-nums text-zinc-500">
            {item.shortcut}
          </span>
        )}
      </button>
    </li>
  );
}
