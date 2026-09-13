'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import ViewToolbar from './ViewToolbar';
import { emitWorkspaceReady } from '@/core/workspace/workspaceLifecyclePort';
import { useMobileViewport } from '@/hooks/useMobileViewport';

function ViewerLoading({ message = '3D görünüm yükleniyor' }: { message?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--sf-bg-canvas)] p-5" role="status" aria-live="polite">
      <div className="max-w-xs rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-4 text-center shadow-xl">
        <div className="mx-auto size-6 animate-spin rounded-full border-2 border-[var(--sf-border-default)] border-t-[var(--sf-action-primary)]" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-semibold text-[var(--sf-text-primary)]">{message}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--sf-text-muted)]">Model hazır olduğunda viewport otomatik açılacak.</p>
      </div>
    </div>
  );
}

const LazyGeometry3DViewer = dynamic(() => import('./Geometry3DViewer'), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void; onFailure: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('3D görünüm başlatılamadı:', error);
    this.props.onFailure();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--sf-bg-canvas)] p-5">
        <div className="max-w-sm rounded-xl border border-[var(--sf-status-danger)] bg-[var(--sf-bg-panel)] p-4 text-center shadow-xl">
          <h2 className="text-sm font-semibold text-[var(--sf-text-primary)]">3D görünüm başlatılamadı</h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--sf-text-secondary)]">WebGL veya görüntüleme kaynağı hazırlanamadı. Hesap girdileri ve sonuçlar kullanılmaya devam edebilir.</p>
          <button type="button" onClick={this.props.onRetry} className="mt-3 min-h-9 rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-control-primary-bg)] px-3 text-xs font-semibold text-[var(--sf-text-on-accent)] transition-colors hover:bg-[var(--sf-control-primary-hover)]">
            3D görünümü yeniden dene
          </button>
        </div>
      </div>
    );
  }
}

export default function CanvasPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { geometryErrors, wallInput } = useRetainingWallStore();
  const [isVrActive, setIsVrActive] = useState(false);
  const [mobile3dEnabled, setMobile3dEnabled] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const { isMobile, ready: viewportReady } = useMobileViewport();
  const show3d = viewportReady && (!isMobile || mobile3dEnabled);
  const hasBlockingGeometry = geometryErrors.some((error) => error.severity === 'error');

  useEffect(() => {
    const handleStart = () => setIsVrActive(true);
    const handleEnd = () => setIsVrActive(false);

    window.addEventListener('vr-session-start', handleStart);
    window.addEventListener('vr-session-end', handleEnd);

    return () => {
      window.removeEventListener('vr-session-start', handleStart);
      window.removeEventListener('vr-session-end', handleEnd);
    };
  }, []);

  // Mobile deliberately defers the heavy 3D viewport. The project is ready as
  // soon as its input/results workspace has committed; on desktop readiness is
  // emitted only by Geometry3DViewer after an actual R3F frame has rendered.
  useEffect(() => {
    if (!viewportReady || !isMobile || mobile3dEnabled) return;
    const frame = window.requestAnimationFrame(() => emitWorkspaceReady());
    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, mobile3dEnabled, viewportReady, wallInput]);

  return (
    <div
      ref={containerRef}
      className={`${isVrActive ? 'fixed inset-0 z-[9999]' : 'relative h-full min-h-0 w-full'} flex min-w-0 flex-col overflow-hidden bg-[var(--sf-bg-canvas)] touch-none`}
    >
      {show3d && <ViewToolbar />}
      {show3d ? (
        <ViewerErrorBoundary
          key={viewerKey}
          onRetry={() => setViewerKey((value) => value + 1)}
          onFailure={emitWorkspaceReady}
        >
          <LazyGeometry3DViewer mobilePerformance={isMobile} focusInputOnDimensionClick onReady={emitWorkspaceReady} />
        </ViewerErrorBoundary>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--sf-bg-canvas)] p-5 text-center">
          <div className="max-w-xs rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-4 shadow-xl">
            <div className="mx-auto flex size-11 items-center justify-center rounded-lg border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-action-primary-hover)]">
              <span className="text-lg" aria-hidden="true">◈</span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-[var(--sf-text-primary)]">3D görünüm hazır değil</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--sf-text-secondary)]">
              Telefon performansını korumak için model otomatik yüklenmedi. İsterseniz yalnızca bu panelde açabilirsiniz.
            </p>
            {viewportReady && isMobile && (
              <button
                type="button"
                onClick={() => setMobile3dEnabled(true)}
                className="mt-3 min-h-9 rounded-md bg-[var(--sf-control-primary-bg)] px-3 text-xs font-semibold text-[var(--sf-text-on-accent)] transition-colors hover:bg-[var(--sf-control-primary-hover)]"
              >
                3D görünümünü aç
              </button>
            )}
          </div>
        </div>
      )}

      {hasBlockingGeometry && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--sf-status-danger)]">
          Geometri hatalı — hesap güncellenmiyor
        </div>
      )}
    </div>
  );
}
