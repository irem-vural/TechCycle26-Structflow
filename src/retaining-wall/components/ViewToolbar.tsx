'use client';

import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import {
  Box,
  Layers,
  Eye,
  Ruler,
  Mountain,
  Grid,
  ChevronDown,
  Grid3x3,
  Sparkles,
} from 'lucide-react';

const VrIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-2.5-3-2.5 3H5a2 2 0 0 1-2-2V7z" />
    <circle cx="8" cy="10" r="1" fill="currentColor" />
    <circle cx="16" cy="10" r="1" fill="currentColor" />
  </svg>
);

export default function ViewToolbar() {
  const {
    visibleParts,
    toggleVisibility,
    renderMode,
    setRenderMode,
    cameraView,
    setCameraView,
  } = useRetainingWallStore();
  const { t } = useLocaleStore();
  const [layersOpen, setLayersOpen] = useState(false);

  // Count active layers
  const activeLayersCount = Object.keys(visibleParts).filter(
    (key) => visibleParts[key as keyof typeof visibleParts] && key !== 'concreteTransparent'
  ).length;

  const layerItems = [
    { key: 'wall', label: t('geometry.wall'), icon: <Box className="w-3.5 h-3.5" /> },
    { key: 'soil', label: t('geometry.soil'), icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'ground', label: t('geometry.ground'), icon: <Mountain className="w-3.5 h-3.5" /> },
    { key: 'excavation', label: t('geometry.excavation'), icon: <Mountain className="w-3.5 h-3.5" /> },
    { key: 'dimensions', label: t('geometry.dimensions'), icon: <Ruler className="w-3.5 h-3.5" /> },
    { key: 'rebars', label: t('geometry.rebars'), icon: <Grid className="w-3.5 h-3.5" /> },
    { key: 'concreteTransparent', label: t('geometry.concreteTransparent'), icon: <Eye className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="pointer-events-none absolute left-2 right-2 top-2 z-40 flex items-center justify-center select-none sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:top-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] p-1 shadow-lg backdrop-blur-md sm:gap-1">
        
        {/* Camera Preset Group */}
        <div className="flex shrink-0 items-center rounded border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)] p-0.5">
          {(['iso', 'front', 'side', 'top'] as const).map((view) => {
            const labels = { iso: 'İZO', front: 'ÖN', side: 'YAN', top: 'ÜST' };
            const titles = { iso: 'İzometrik Görünüm', front: 'Ön Görünüm', side: 'Yan Görünüm', top: 'Üst Görünüm' };
            const isActive = cameraView === view;
            return (
              <button
                key={view}
                onClick={() => setCameraView(view)}
                title={titles[view]}
                className={`min-h-7 rounded px-2 py-1 text-xs font-bold tracking-wide transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'border border-[var(--sf-border-active)] bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)] shadow-sm'
                    : 'border border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
                }`}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-[var(--sf-divider)]" />

        {/* Render Mode Group */}
        <div className="flex shrink-0 items-center rounded border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)] p-0.5">
          {[
            { mode: 'wireframe', icon: <Grid3x3 className="w-3.5 h-3.5" />, title: 'Tel Kafes (Wireframe)' },
            { mode: 'shaded', icon: <Box className="w-3.5 h-3.5" />, title: 'Katı / Gölgeli' },
            { mode: 'realistic', icon: <Sparkles className="w-3.5 h-3.5" />, title: 'Gerçekçi Görünüm' },
          ].map(({ mode, icon, title }) => {
            const isActive = renderMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setRenderMode(mode as 'wireframe' | 'shaded' | 'realistic')}
                title={title}
                className={`p-1 rounded transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'border border-[var(--sf-border-active)] bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)] shadow-sm'
                    : 'border border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
                }`}
              >
                {icon}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-[var(--sf-divider)]" />

        {/* Layers Dropdown */}
        <div className="relative shrink-0">
          <Popover open={layersOpen} onOpenChange={setLayersOpen}>
            <PopoverTrigger
              type="button"
              aria-haspopup="menu"
              aria-expanded={layersOpen}
              className={`flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-bold transition-all cursor-pointer ${
                layersOpen
                  ? 'border border-[var(--sf-border-active)] bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]'
                  : 'border border-transparent text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-[var(--sf-text-secondary)]" />
              <span className="hidden sm:inline">{t('geometry.layers')}</span>
              <span className="flex min-w-5 items-center justify-center rounded-full border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-1 text-xs font-bold text-[var(--sf-action-primary-hover)]">
                {activeLayersCount}
              </span>
              <ChevronDown className={`h-3 w-3 text-[var(--sf-text-muted)] transition-transform duration-200 ${layersOpen ? 'rotate-180' : ''}`} />
            </PopoverTrigger>

            {/* Render the menu in a portal so the toolbar's horizontal scroller cannot clip it. */}
            <PopoverContent
              align="center"
              side="bottom"
              sideOffset={6}
              className="z-[80] flex max-h-[min(22rem,calc(100vh-5rem))] w-44 flex-col gap-0.5 overflow-y-auto rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-1.5 text-[var(--sf-text-primary)] shadow-xl"
            >
              {layerItems.map(({ key, label, icon }) => {
                const isActive = visibleParts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleVisibility(key)}
                    className={`flex min-h-8 w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]'
                        : 'text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isActive ? 'text-[var(--sf-action-primary-hover)]' : 'text-[var(--sf-text-disabled)]'}>
                        {icon}
                      </span>
                      <span>{label}</span>
                    </div>
                    <span className={`h-1.5 w-1.5 rounded-full transition-all duration-150 ${
                      isActive ? 'bg-[var(--sf-action-primary)]' : 'bg-[var(--sf-text-disabled)]'
                    }`} />
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-[var(--sf-divider)]" />

        {/* VR Toggle Button */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('request-vr-session'));
          }}
          className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-action-primary-hover)] transition-all duration-150 hover:bg-[var(--sf-bg-selected)] hover:text-[var(--sf-text-primary)] active:scale-95"
          title={t('geometry.startVr')}
        >
          <VrIcon className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
