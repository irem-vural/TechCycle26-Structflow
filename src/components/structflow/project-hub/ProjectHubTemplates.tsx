"use client";

import type { ReactNode } from "react";
import { Landmark, Layers, ShieldAlert } from "lucide-react";
import type { ProjectType } from "@/core/workspace/projectTypes";

interface ProjectHubTemplatesProps {
  onNew: (projectType: ProjectType) => void;
}

export function ProjectHubTemplates({ onNew }: ProjectHubTemplatesProps) {
  return (
    <div className="h-full overflow-y-auto bg-transparent p-3 sm:p-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sf-text-muted)]">
        İstinat Duvarı Başlangıç Şablonları
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] sm:gap-4">
        <TemplateCard
          title="Konsol İstinat Duvarı"
          description="Standart T-Tipi betonarme konsol duvar. Gövde, temel ve sürşarj yükleri tanımlı."
          icon={<Landmark className="h-4 w-4" />}
          moduleLabel="Konsol Tipi"
          onClick={() => onNew("retaining-wall")}
        />
        <TemplateCard
          title="Ağırlık İstinat Duvarı"
          description="Kütle beton / blok ağırlık istinat duvarı şablonu. Kayma ve devrilme tahkikleri."
          icon={<Layers className="h-4 w-4" />}
          moduleLabel="Ağırlık Tipi"
          onClick={() => onNew("retaining-wall")}
        />
        <TemplateCard
          title="Topuklu / Akslı İstinat Duvarı"
          description="Ön ve arka topuklu, yüksek zemin ve deprem yükleri altındaki özel istinat yapısı."
          icon={<ShieldAlert className="h-4 w-4" />}
          moduleLabel="Özel Topuklu"
          onClick={() => onNew("retaining-wall")}
        />
      </div>
    </div>
  );
}

function TemplateCard({
  title,
  description,
  icon,
  moduleLabel,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  moduleLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-left shadow-sm transition-[scale,background-color,border-color,box-shadow] duration-150 hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-panel-raised)] hover:shadow-md active:scale-[0.96]"
    >
      <div className="border-b border-[var(--sf-divider)] bg-[var(--sf-bg-canvas)]">
        <TechnicalPreview />
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--sf-text-muted)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)] text-[var(--sf-action-primary-hover)]">
            {icon}
          </span>
          {moduleLabel}
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--sf-text-primary)]">{title}</h3>
        <p className="mt-2 text-pretty text-[12.5px] leading-5 text-[var(--sf-text-secondary)]">
          {description}
        </p>
      </div>
    </button>
  );
}

function TechnicalPreview() {
  return (
    <svg
      className="h-[150px] w-full"
      viewBox="0 0 420 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="420" height="150" fill="#0d1117" />
      <g stroke="rgba(255,255,255,0.055)" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, index) => (
          <line
            key={`v-${index}`}
            x1={index * 52}
            y1="0"
            x2={index * 52}
            y2="150"
          />
        ))}
        {Array.from({ length: 5 }).map((_, index) => (
          <line
            key={`h-${index}`}
            x1="0"
            y1={index * 36}
            x2="420"
            y2={index * 36}
          />
        ))}
      </g>
      <path
        d="M122 38 L168 38 L188 116 L88 116 Z"
        fill="rgba(157,198,239,0.09)"
        stroke="#8192a5"
        strokeWidth="1.4"
      />
      <path d="M188 116 L316 116" stroke="#55616e" strokeWidth="1.2" />
      <path
        d="M64 119 H338"
        stroke="#6b7785"
        strokeWidth="1"
        strokeDasharray="6 7"
      />
      <path
        d="M54 128 C108 118 144 136 196 126 S292 116 360 132"
        fill="none"
        stroke="#43505e"
        strokeWidth="1"
      />
    </svg>
  );
}
