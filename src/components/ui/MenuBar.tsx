import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FolderOpen,
  Save,
  SaveAll,
  Monitor,
  LayoutGrid,
} from 'lucide-react';

export interface MenuItem {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: (MenuItem | 'separator')[];
}

export interface MenuBarProps {
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onReturnToHub?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onResetView?: () => void;
  onResetLayout?: () => void;
  moduleMenus?: MenuGroup[];
  fileExtras?: (MenuItem | 'separator')[];
  editExtras?: (MenuItem | 'separator')[];
  windowExtras?: (MenuItem | 'separator')[];
  rightActions?: React.ReactNode;
}

export default function MenuBar({
  onOpen,
  onSave,
  onSaveAs,
  onReturnToHub,
  onUndo,
  onRedo,
  onResetView,
  onResetLayout,
  moduleMenus = [],
  fileExtras = [],
  editExtras = [],
  windowExtras = [],
  rightActions,
}: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const close = () => setActiveMenu(null);

  const fileItems: (MenuItem | 'separator')[] = [
    { icon: <ArrowLeft className="h-3.5 w-3.5" />, label: 'Ana Sayfaya Dön', onClick: () => { onReturnToHub?.(); close(); } },
    'separator',
    { icon: <FolderOpen className="h-3.5 w-3.5" />, label: 'Proje Aç', shortcut: 'Ctrl+O', onClick: () => { onOpen?.(); close(); } },
    { icon: <Save className="h-3.5 w-3.5" />, label: 'Kaydet', shortcut: 'Ctrl+S', onClick: () => { onSave?.(); close(); } },
    { icon: <SaveAll className="h-3.5 w-3.5" />, label: 'Farklı Kaydet', shortcut: 'Ctrl+Shift+S', onClick: () => { onSaveAs?.(); close(); } },
    ...(fileExtras.length ? ['separator' as const, ...fileExtras] : []),
  ];

  const editItems: (MenuItem | 'separator')[] = [
    { label: 'Geri Al', shortcut: 'Ctrl+Z', onClick: () => { onUndo?.(); close(); }, disabled: !onUndo },
    { label: 'İleri Al', shortcut: 'Ctrl+Y', onClick: () => { onRedo?.(); close(); }, disabled: !onRedo },
    ...(editExtras.length ? ['separator' as const, ...editExtras] : []),
  ];

  const windowItems: (MenuItem | 'separator')[] = [
    { icon: <Monitor className="h-3.5 w-3.5" />, label: 'Görünümü Sıfırla', onClick: () => { onResetView?.(); close(); }, disabled: !onResetView },
    ...(onResetLayout ? [{ icon: <LayoutGrid className="h-3.5 w-3.5" />, label: 'Yerleşimi Sıfırla', onClick: () => { onResetLayout(); close(); } }] : []),
    ...(windowExtras.length ? ['separator' as const, ...windowExtras] : []),
  ];

  const builtInGroups: MenuGroup[] = [
    { id: 'file', label: 'Dosya', items: fileItems },
    { id: 'edit', label: 'Düzenle', items: editItems },
    { id: 'window', label: 'Pencere', items: windowItems },
  ];

  const allGroups = [...builtInGroups, ...moduleMenus];

  return (
    <div className="flex h-7 w-full shrink-0 select-none items-center border-b border-[var(--sf-divider)] bg-[var(--sf-bg-toolbar)] px-1.5" ref={menuRef}>
      {allGroups.map((group) => (
        <div className="relative" key={group.id}>
          <button
            onClick={() => setActiveMenu(activeMenu === group.id ? null : group.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors ${
              activeMenu === group.id
                ? 'bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]'
                : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
            }`}
          >
            {group.label}
          </button>
          {activeMenu === group.id && (
            <div className="absolute top-full left-0 mt-0.5 min-w-48 rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] shadow-md overflow-hidden z-50 py-1">
              {group.items.map((item, i) =>
                item === 'separator' ? (
                  <div key={`sep-${i}`} className="mx-2 my-1 h-px bg-[var(--sf-divider)]" />
                ) : (
                  <MenuButton key={item.label + i} {...item} />
                )
              )}
            </div>
          )}
        </div>
      ))}

      {rightActions && (
        <div className="ml-auto flex items-center gap-1">{rightActions}</div>
      )}
    </div>
  );
}

function MenuButton({ icon, label, shortcut, onClick, active, disabled }: MenuItem) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors text-left ${
        active
          ? 'bg-[var(--sf-status-success-bg)] text-[var(--sf-status-success)]'
          : disabled
            ? 'cursor-not-allowed text-[var(--sf-text-disabled)]'
            : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon && <span className={active ? 'text-[var(--sf-status-success)]' : 'text-[var(--sf-text-muted)]'}>{icon}</span>}
        {!icon && !active && <span className="w-3.5" />}
        {active && !icon && <span className="text-xs text-[var(--sf-status-success)]">✓</span>}
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-xs tabular-nums text-[var(--sf-text-muted)]">{shortcut}</span>}
    </button>
  );
}
