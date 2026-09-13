"use client";

import Image from "next/image";
import { Landmark } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type {
  ProjectPayload,
  ProjectType,
} from "@/core/workspace/projectTypes";
import { isRetainingWallPayload } from "@/core/workspace/projectTypes";
import { publicAsset } from "@/lib/publicAsset";

interface ProjectLoadingScreenProps {
  project: {
    name: string;
    projectType: ProjectType;
    payload?: ProjectPayload;
  };
  ready: boolean;
  thumbnailSrc?: string | null;
  onFinished: () => void;
}

const READY_HOLD_MS = 320;
const EXIT_DURATION_MS = 420;

export default function ProjectLoadingScreen({
  project,
  ready,
  thumbnailSrc,
  onFinished,
}: ProjectLoadingScreenProps) {
  const [phase, setPhase] = useState<"loading" | "exit">("loading");
  const { name, payload } = project;

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const timer = setTimeout(() => setPhase("exit"), READY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "exit") return;
    const timer = setTimeout(onFinished, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onFinished, phase]);

  const metrics = useMemo(() => {
    if (payload && isRetainingWallPayload(payload)) {
      const geometry = payload.data.wallInput.geometry;
      return [
        `Yükseklik ${geometry.H.toFixed(1)} m`,
        `Taban ${geometry.x1.toFixed(1)} m`,
        `Uzunluk ${geometry.L.toFixed(1)} m`,
      ];
    }

    return [];
  }, [payload]);

  const TypeIcon = Landmark;
  const loadingComplete = ready;
  const statusLabel = loadingComplete
    ? "Çalışma alanı hazır"
    : "Proje açılıyor";

  return (
    <div
      lang="tr"
      className={`project-load-root splash-root fixed inset-x-0 bottom-0 top-10 z-[9999] flex items-center justify-center overflow-hidden sm:top-9 ${
        phase === "exit" ? "splash-exit" : ""
      }`}
      aria-busy={!loadingComplete}
    >
      <div className="project-load-backdrop" />

      <main className="project-load-stage relative z-[1] w-[min(1180px,calc(100vw-40px))]">
        <section className="project-load-panel overflow-hidden">
          <header className="project-load-header project-load-in flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="project-load-logo flex size-10 shrink-0 items-center justify-center">
                <Image
                  src={publicAsset("sflogo.svg")}
                  alt="StructFlow"
                  width={26}
                  height={26}
                  className="size-[26px] object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">
                  StructFlow
                </p>
                <p className="mt-0.5 text-xs text-[var(--sf-text-muted)]">
                  İstinat duvarı analiz ve tasarım çalışma alanı
                </p>
              </div>
            </div>

          </header>

          <div className="project-load-preview-wrap project-load-in">
            {thumbnailSrc ? (
              <div className="project-load-preview">
                <div
                  aria-hidden="true"
                  className="h-full w-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${thumbnailSrc})` }}
                />
              </div>
            ) : (
              <div className="project-load-preview-empty">
                <TypeIcon className="size-8" aria-hidden="true" />
                <span>Model hazırlanıyor</span>
              </div>
            )}
          </div>

          <footer className="project-load-footer project-load-in">
            <div className="flex min-w-0 items-end justify-between gap-5">
              <div className="min-w-0">
                <h1 className="truncate text-balance text-[clamp(20px,3vw,28px)] font-semibold leading-tight tracking-[-0.025em] text-[var(--sf-text-primary)]">
                  {name}
                </h1>
                {metrics.length > 0 && (
                  <div className="project-load-metrics mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--sf-text-muted)]">
                    {metrics.map((metric) => (
                      <span key={metric}>{metric}</span>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="project-load-status flex shrink-0 items-center gap-2 text-xs font-medium"
                role="status"
                aria-live="polite"
              >
                <span className="project-load-status-dot" aria-hidden="true" />
                <span>{statusLabel}</span>
              </div>
            </div>

            <div
              className={`project-load-progress mt-4 ${loadingComplete ? "is-ready" : ""}`}
              role="progressbar"
              aria-label={statusLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              {...(loadingComplete ? { "aria-valuenow": 100 } : {})}
            >
              <div className="project-load-progress-indicator" />
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
