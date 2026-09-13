'use client';

/* Hallmark · component: embedded Geometry3DViewer · genre: modern-minimal · theme: StructFlow dark */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · slop: pass */

import Geometry3DViewer from './Geometry3DViewer';

export default function GeometryWireframePreview() {
  return (
    <div
      className="relative h-[340px] w-full touch-none overflow-visible rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-canvas)]"
      role="application"
      aria-label="Döndürülebilen ve yakınlaştırılabilen üç boyutlu istinat duvarı ölçü modeli"
    >
      <Geometry3DViewer
        cameraInteractive
        enableVr={false}
        compact
        modelOnly
        focusCameraOnSelection
        focusInputOnDimensionClick
        cameraViewOverride="iso"
        renderModeOverride="wireframe"
      />
    </div>
  );
}
