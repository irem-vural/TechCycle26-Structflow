'use client';

/* Hallmark · component: focused 3D geometry preview · genre: modern-minimal · theme: StructFlow dark */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 · slop: pass */

import React, { useMemo, useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CameraControls,
  Grid,
  Environment,
  ContactShadows,
  GizmoHelper,
  Edges,
  Html,
  Line,
} from '@react-three/drei';
import * as THREE from 'three';
import ViewCubeGizmo from '@/components/structflow/ViewCubeGizmo';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import { publicAsset } from '@/lib/publicAsset';
import {
  GEOMETRY_LIMITS,
} from '@/retaining-wall/engine/validation';
import type { GeometryFieldKey } from '@/retaining-wall/types';
import RebarCage from './RebarCage';
import VrManager from './VrManager';
import {
  embeddedSurfaceColorForTheme,
  embeddedWireframeColorForTheme,
  geometryFieldColorsForTheme,
} from './geometryFieldVisuals';
import { STRUCTFLOW_DARK_THEME, themeRuntime } from '@/core/theme/structflowTheme';
import { createRetainingWallSolidGeometry } from '@/retaining-wall/geometry/retainingWallSolidGeometry';

// ═══════════════════════════════════════════════════════════════
//  SAFE PBR TEXTURE LOADER  (THREE.TextureLoader — never throws)
// ═══════════════════════════════════════════════════════════════

const _loader = typeof window !== 'undefined' ? new THREE.TextureLoader() : null;

function loadTex(
  path: string,
  repeat = 1,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
): THREE.Texture {
  const fallback = new THREE.Texture();
  fallback.colorSpace = colorSpace;
  if (!_loader) return fallback;
  const tex = _loader.load(path, undefined, undefined, () => {
    // silently ignore missing files
  });
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

interface PBRSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}

function loadPBR(base: string, repeat = 1): PBRSet {
  // ARM texture: R=AO, G=Roughness, B=Metalness
  const arm = loadTex(`${base}/arm.jpg`, repeat);
  return {
    map:          loadTex(`${base}/diff.jpg`, repeat, THREE.SRGBColorSpace),
    normalMap:    loadTex(`${base}/nor.jpg`,  repeat),
    roughnessMap: arm,
    metalnessMap: arm,
    aoMap:        loadTex(`${base}/ao.jpg`,   repeat),
  };
}

function emptyPBR(): PBRSet {
  return {
    map: new THREE.Texture(),
    normalMap: new THREE.Texture(),
    roughnessMap: new THREE.Texture(),
    metalnessMap: new THREE.Texture(),
    aoMap: new THREE.Texture(),
  };
}

// ═══════════════════════════════════════════════════════════════
//  GL SETUP — enable localClippingPlanes inside Canvas
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  CAMERA CONTROLLER
// ═══════════════════════════════════════════════════════════════

// Axis-aligned profile frame for a focused geometry field.
// world-space target + size of region to fit + which profile view to use.
export interface ProfileFrame {
  view: 'front' | 'side' | 'top';
  target: THREE.Vector3; // world-space aim point
  width: number;  // extent horizontal to the view plane
  height: number; // extent vertical to the view plane
}

function CameraController({
  view,
  target,
  bounds,
  focusField,
  focusFrame,
  interactive,
  distanceScale,
}: {
  view: string;
  target: THREE.Vector3;
  bounds: { H: number; B: number; L: number };
  focusField: GeometryFieldKey | null;
  focusFrame: ProfileFrame | null;
  interactive: boolean;
  distanceScale: number;
}) {
  const { gl } = useThree();
  const controlsRef = useRef<CameraControls | null>(null);
  const savedPoseRef = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null);
  const focusActiveRef = useRef(false);

  // Default / user-selected view presets
  useEffect(() => {
    if (!controlsRef.current) return;
    if (gl.xr.isPresenting) return;
    if (focusField) return;
    const c = controlsRef.current;
    const { H, B, L } = bounds;
    const extent = Math.max(H, B, L);
    const d = extent * 2.0 * distanceScale;

    // Set camera up vector — top view needs up=[0,0,-1] to avoid gimbal-lock flip
    const isTop = view === 'top';
    c.camera.up.set(0, isTop ? 0 : 1, isTop ? -1 : 0).normalize();

    let px = 0, py = 0, pz = 0;
    switch (view) {
      case 'iso':   px = -d * 0.9; py = d * 0.5; pz = d * 0.65; break;
      case 'front': px = -d;       py = target.y; pz = 0;      break;
      case 'side':  px = 0;       py = target.y; pz = d;      break;
      case 'top':   px = 0;       py = d;       pz = 0.001;   break;
      default:      px = -d * 0.9; py = d * 0.5; pz = d * 0.65;
    }

    c.setLookAt(
      px + target.x, py, pz + target.z,
      target.x, target.y, target.z,
      false
    );
  }, [view, target, bounds, focusField, gl.xr.isPresenting, distanceScale]);

  // Click-focused profile view — clean axis-aligned framing
  useEffect(() => {
    if (!controlsRef.current) return;
    if (gl.xr.isPresenting) return;
    const c = controlsRef.current;

    if (focusField && focusFrame) {
      if (!focusActiveRef.current) {
        const pos = new THREE.Vector3();
        const tgt = new THREE.Vector3();
        c.getPosition(pos);
        c.getTarget(tgt);
        savedPoseRef.current = { pos, tgt };
        focusActiveRef.current = true;
      }

      // Compute framing distance to fit width×height at fov=45° with generous margin.
      // User feedback: previous framing was too tight — widened padding + multiplier.
      const fovRad = (45 * Math.PI) / 180;
      const padW = focusFrame.width + 2;
      const padH = focusFrame.height + 2;
      const dist = Math.max(padW, padH) / (2 * Math.tan(fovRad / 2)) * 1.35;
      const d = Math.max(dist, 6) * distanceScale;

      const { target: t } = focusFrame;
      let px = t.x, py = t.y, pz = t.z;
      switch (focusFrame.view) {
        case 'front': px = t.x + d;      break; // look along -X
        case 'side':  pz = t.z + d;      break; // look along -Z
        case 'top':   py = t.y + d;      break; // look down -Y
      }

      c.setLookAt(px, py, pz, t.x, t.y, t.z, false);
      return;
    }

    if (!focusField && focusActiveRef.current && savedPoseRef.current) {
      const { pos, tgt } = savedPoseRef.current;
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false);
      focusActiveRef.current = false;
      savedPoseRef.current = null;
    }
  }, [focusField, focusFrame, gl.xr.isPresenting, distanceScale]);

  // Disable controls when presenting in VR
  if (gl.xr.isPresenting) return null;

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={interactive}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI - 0.01}
      minDistance={1.2}
      maxDistance={160}
      dollyToCursor
      dollySpeed={0.8}
      truckSpeed={1.5}
      azimuthRotateSpeed={0.8}
      polarRotateSpeed={0.8}
      smoothTime={0.08}
      draggingSmoothTime={0.04}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
//  DIMENSION LINE + HOVER LABEL
//  – Line is always visible (dashed)
//  – Label fades in only on hover via an invisible hit-target mesh
// ═══════════════════════════════════════════════════════════════

interface DimLineProps {
  start: [number, number, number];
  end: [number, number, number];
  /** Label midpoint offset from line midpoint */
  labelOffset?: [number, number, number];
  field: GeometryFieldKey;
  value: number;
  label: string;
  color?: string;
  hasError?: boolean;
  /** Axis along which the line runs: 'x' | 'y' | 'z' */
  axis?: 'x' | 'y' | 'z';
  /** Override hit-target position (default: line midpoint) */
  hitPos?: [number, number, number];
  /** Override hit-target box size */
  hitSize?: [number, number, number];
  /** Externally force highlight for the selected measurement. */
  forceHighlight?: boolean;
  /** Keep this measurement visible without hover. */
  alwaysShow?: boolean;
  /** Reduce label chrome in the embedded viewer. */
  compact?: boolean;
  /** Current input focus, used to fade unrelated measurements. */
  focusedField?: GeometryFieldKey | null;
  onSelect?: (field: GeometryFieldKey) => void;
}

function DimLine({
  start,
  end,
  labelOffset = [0, 0, 0],
  field,
  value,
  label,
  color = '#10b981',
  hasError = false,
  axis = 'y',
  hitPos,
  hitSize,
  forceHighlight = false,
  alwaysShow = false,
  compact = false,
  focusedField = null,
  onSelect,
}: DimLineProps) {
  const [hovered, setHovered] = useState(false);
  const lineActive = hovered || forceHighlight;
  const labelVisible = forceHighlight || alwaysShow;
  const visible = lineActive || alwaysShow;
  const deemphasized = alwaysShow && focusedField !== null && focusedField !== field;
  const limit = GEOMETRY_LIMITS[field];

  const edgeMid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  const labelPos: [number, number, number] = [
    edgeMid[0] + labelOffset[0],
    edgeMid[1] + labelOffset[1],
    edgeMid[2] + labelOffset[2],
  ];

  const lineLen = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);

  // Tight hit-target — a thin box running along the edge, not covering the whole face.
  const defaultHitArgs: [number, number, number] =
    axis === 'x' ? [lineLen, 0.45, 0.55]
    : axis === 'z' ? [0.55, 0.45, lineLen]
    : [0.45, lineLen, 0.55];

  const resolvedHitPos: [number, number, number] = hitPos ?? edgeMid;
  const resolvedHitArgs = hitSize ?? defaultHitArgs;

  const effectiveColor = hasError ? '#f87171' : color;

  return (
    <group>
      {/* Tight invisible hit-target along the edge — pointer events only */}
      <mesh
        position={resolvedHitPos}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(field);
        }}
      >
        <boxGeometry args={resolvedHitArgs} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Edge glow — the actual wall edge highlights on hover, no separate offset line */}
      {visible && (
        <Line
          points={[start, end]}
          color={effectiveColor}
          lineWidth={lineActive ? 4 : 1.35}
          opacity={deemphasized && !lineActive ? 0.22 : lineActive ? 1 : 0.78}
          transparent
        />
      )}

      {/* Labels live on the model; the active input stays visually dominant. */}
      <Html position={labelPos} center zIndexRange={[100, 0]}>
        <div
          style={{
            pointerEvents: 'none',
            opacity: labelVisible ? (deemphasized && !forceHighlight ? 0.24 : forceHighlight ? 1 : 0.9) : 0,
            transition: 'opacity 0.15s ease',
            willChange: 'opacity',
          }}
        >
          <div
            className={`flex items-center rounded-md border shadow-lg backdrop-blur-md select-none whitespace-nowrap ${compact ? 'gap-1 px-1.5 py-1' : 'gap-1.5 px-2.5 py-1.5'} ${
              hasError
                ? 'border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] text-[var(--sf-text-primary)]'
                : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-primary)]'
            }`}
            style={{ fontSize: compact ? 11 : 12 }}
            title={`${limit.min} – ${limit.max} m (sol panelden düzenleyin)`}
          >
            {/* Color swatch */}
            <span
              style={{
                width: compact ? 5 : 8, height: compact ? 5 : 8, borderRadius: '50%',
                background: effectiveColor,
                flexShrink: 0,
                boxShadow: `0 0 6px ${effectiveColor}80`,
              }}
            />
            <span style={{ fontWeight: 700, fontSize: compact ? 10 : 12, letterSpacing: '0.03em', opacity: 0.9 }}>
              {label}
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--sf-text-primary)' }}>
              {value.toFixed(2)}
              <span style={{ fontSize: 11, opacity: 0.82, marginLeft: 2 }}>m</span>
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN VIEWER
// ═══════════════════════════════════════════════════════════════

export interface Geometry3DViewerProps {
  mobilePerformance?: boolean;
  cameraInteractive?: boolean;
  enableVr?: boolean;
  compact?: boolean;
  modelOnly?: boolean;
  alwaysShowDimensionLabels?: boolean;
  focusCameraOnSelection?: boolean;
  focusInputOnDimensionClick?: boolean;
  cameraViewOverride?: 'iso' | 'front' | 'top' | 'side';
  renderModeOverride?: 'wireframe' | 'shaded' | 'realistic';
  onReady?: () => void;
}

export default function Geometry3DViewer({
  mobilePerformance = false,
  cameraInteractive = true,
  enableVr = true,
  compact = false,
  modelOnly = false,
  alwaysShowDimensionLabels = false,
  focusCameraOnSelection = false,
  focusInputOnDimensionClick = false,
  cameraViewOverride,
  renderModeOverride,
  onReady,
}: Geometry3DViewerProps) {
  const themeId = useSyncExternalStore(
    themeRuntime.subscribe,
    () => themeRuntime.getSnapshot().id,
    () => STRUCTFLOW_DARK_THEME,
  );
  const geometryFieldColors = geometryFieldColorsForTheme(themeId);
  const embeddedWireframeColor = embeddedWireframeColorForTheme(themeId);
  const embeddedSurfaceColor = embeddedSurfaceColorForTheme(themeId);
  const {
    wallInput,
    renderMode: storeRenderMode,
    cameraView,
    visibleParts,
    geometryErrors,
    selectedGeoField,
    setFocusedGeoField,
    setSelectedGeoField,
  } = useRetainingWallStore();
  const activeHighlightedGeoField = selectedGeoField;
  const activeCameraFocusField = focusCameraOnSelection ? selectedGeoField : null;
  const activeCameraView = cameraViewOverride ?? cameraView;
  const renderMode = renderModeOverride ?? storeRenderMode;
  const [sceneOffset, setSceneOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [vrScale, setVrScale] = useState<number>(1);
  const [webglResetKey, setWebglResetKey] = useState(0);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const webglRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { H, x1, x2, x3, x4, x5, x6, L } = wallInput.geometry;
  const Df = wallInput.geometry.Df;
  const { beta } = wallInput.backfillSoil;
  const topY = x5 + H;
  const totalH = H + x5;
  // Df is the embedment from terrain down to the BASE BOTTOM. The whole wall
  // is therefore translated by -Df so local y=0 (base bottom) lands at -Df
  // and local y=Df is the terrain datum. This keeps the passive soil height
  // above the base top equal to max(Df - x5, 0), matching the core engine.
  const pitDepthApprox = Math.max(Df, 0.01);
  const errorFields = useMemo(() => new Set(geometryErrors.map((e) => e.field)), [geometryErrors]);
  const centerTarget = useMemo(
    () => new THREE.Vector3(x1 / 2, totalH / 2 - (modelOnly ? pitDepthApprox : 0), 0),
    [x1, totalH, modelOnly, pitDepthApprox],
  );

  // Every focused field targets the midpoint of its real model edge. L alone
  // changes projection because it runs along the wall's extrusion axis.
  const focusFrame = useMemo<ProfileFrame | null>(() => {
    if (!activeCameraFocusField) return null;
    const w = (y: number) => y - pitDepthApprox; // local Y → world Y
    const section = (targetX: number, targetY: number, width: number, height: number): ProfileFrame => ({
      view: 'side',
      target: new THREE.Vector3(targetX, w(targetY), 0),
      width: Math.max(width, 0.8),
      height: Math.max(height, 0.8),
    });

    switch (activeCameraFocusField) {
      case 'H':
        return section(x2, x5 + H / 2, Math.max(x4, x3) + 1.2, H + 0.8);
      case 'x1':
        return section(x1 / 2, 0, x1 + 0.8, Math.max(x5, 1.2));
      case 'x2':
        return section(x2 / 2, x5, x2 + 0.8, Math.max(x5, 1) + 0.8);
      case 'x3':
        return section(x2 + x3 / 2, x5, x3 + 1, Math.max(x5, 1) + 0.8);
      case 'x4':
        return section(x2 + x4 / 2, topY, x4 + 1, 1.6);
      case 'x5':
        return section(0, x5 / 2, 1.6, x5 + 1);
      case 'x6':
        return section(x2 + x3 + x6 / 2, x5, x6 + 0.8, Math.max(x5, 1) + 0.8);
      case 'Df':
        return section(x1, Df / 2, 1.8, Df + 1);
      case 'L':
        return {
          view: 'front',
          target: new THREE.Vector3(x1 / 2, w(Math.max(x5, totalH / 3)), 0),
          width: L + 1,
          height: totalH + 1,
        };
      default:
        return null;
    }
  }, [activeCameraFocusField, Df, H, L, pitDepthApprox, topY, totalH, x1, x2, x3, x4, x5, x6]);

  const displayedCameraView = focusFrame?.view ?? activeCameraView;

  // Isolation on explicit selection is enabled only in the embedded preview.
  // The center viewport never enables camera focus/isolation for selection.
  const isolating = focusFrame !== null;
  const effectiveVisible = useMemo(() => ({
    wall: true,
    soil: modelOnly ? false : (isolating ? false : visibleParts.soil),
    ground: modelOnly ? false : (isolating ? false : (displayedCameraView === 'side' ? false : visibleParts.ground)),
    excavation: modelOnly ? false : (isolating ? false : visibleParts.excavation),
    dimensions: modelOnly ? true : (isolating ? true : visibleParts.dimensions),
  }), [isolating, visibleParts, displayedCameraView, modelOnly]);

  // ── PBR Textures ──
  const groundPBR = useMemo(() => modelOnly ? emptyPBR() : loadPBR(publicAsset('textures/ground'), 200), [modelOnly]);
  const wallPBR   = useMemo(() => modelOnly ? emptyPBR() : loadPBR(publicAsset('textures/wall'),   200), [modelOnly]);
  const soilTex   = useMemo(() => modelOnly ? new THREE.Texture() : loadTex(publicAsset('textures/ground/diff.jpg'), 3, THREE.SRGBColorSpace), [modelOnly]);

  useEffect(() => {
    const r = Math.max(1, x1 / 4);
    const s = Math.max(1, totalH / 3);
    Object.values(wallPBR).forEach((t) => { t.repeat.set(r, s); t.needsUpdate = true; });
  }, [totalH, x1, wallPBR]);

  useEffect(() => () => {
    const textures = new Set<THREE.Texture>([
      ...Object.values(groundPBR),
      ...Object.values(wallPBR),
      soilTex,
    ]);
    textures.forEach((texture) => texture.dispose());
  }, [groundPBR, wallPBR, soilTex]);

  // ── Pit params ──
  const pitDepth  = Math.max(Df, 0.01);
  const slopeXY   = pitDepth * 0.5;   // 1V : 0.5H  — fairly steep
  const pitHalfL  = L / 2 + slopeXY;

  // ── ClippingPlanes: rectangle = pit footprint at y=0 surface ──
  // clipIntersection=true → terrain is REMOVED inside all 4 planes (box intersection)
  const pitClipPlanes = useMemo<THREE.Plane[]>(() => [
    new THREE.Plane(new THREE.Vector3( 1, 0, 0), -(x1 + slopeXY)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), -slopeXY),
    new THREE.Plane(new THREE.Vector3( 0, 0, 1), -pitHalfL),
    new THREE.Plane(new THREE.Vector3( 0, 0,-1), -pitHalfL),
  ], [x1, slopeXY, pitHalfL]);

  const sectionClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);
  const wallClippingPlanes = useMemo(() => {
    return displayedCameraView === 'side' ? [sectionClipPlane] : [];
  }, [displayedCameraView, sectionClipPlane]);

  // ── Fixed 200×200 terrain (size never changes with geometry) ──
  const terrainGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(2000, 2000, 4, 4);
    const uv = geom.getAttribute('uv');
    geom.setAttribute('uv1', uv.clone());
    geom.rotateX(-Math.PI / 2);
    geom.computeVertexNormals();
    return geom;
  }, []);

  // ── Excavation pit: trapezoid BufferGeometry walls + floor ──
  const pitGeometry = useMemo(() => {
    const hL   = L / 2;
    const hLx  = pitHalfL;
    const dep  = pitDepth;
    const sx   = slopeXY;

    function quad(
      tl: [number,number,number], tr: [number,number,number],
      bl: [number,number,number], br: [number,number,number]
    ): THREE.BufferGeometry {
      const v = new Float32Array([
        ...tl, ...tr, ...bl,
        ...tr, ...br, ...bl,
      ]);
      const u = new Float32Array([0,1, 1,1, 0,0,  1,1, 1,0, 0,0]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      g.setAttribute('uv',  new THREE.BufferAttribute(u, 2));
      g.setAttribute('uv1', new THREE.BufferAttribute(u.slice(), 2));
      g.computeVertexNormals();
      return g;
    }

    const left  = quad([-sx,0,-hLx], [-sx,0,hLx],  [0,-dep,-hL],  [0,-dep,hL]);
    const right = quad([x1+sx,0,hLx],[x1+sx,0,-hLx],[x1,-dep,hL], [x1,-dep,-hL]);
    const back  = quad([x1+sx,0,-hLx],[-sx,0,-hLx], [x1,-dep,-hL],[0,-dep,-hL]);
    const front = quad([-sx,0,hLx],  [x1+sx,0,hLx], [0,-dep,hL],  [x1,-dep,hL]);

    const floor = new THREE.PlaneGeometry(x1, L, 4, 4);
    floor.setAttribute('uv1', floor.getAttribute('uv').clone());
    floor.rotateX(-Math.PI / 2);
    floor.translate(x1 / 2, -dep + 0.005, 0);

    return { left, right, back, front, floor };
  }, [x1, L, pitDepth, slopeXY, pitHalfL]);

  // ── Wall geometry ──
  const wallGeometry = useMemo(() => {
    return createRetainingWallSolidGeometry(wallInput.geometry);
  }, [wallInput.geometry]);

  // ── Backfill ──
  const soilGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const sw = Math.max(H, x1) * 1.5;
    const sh = sw * Math.tan(((beta || 0) * Math.PI) / 180);
    shape.moveTo(x2+x3, x5);
    shape.lineTo(x1, x5);
    shape.lineTo(x1+sw, x5);
    shape.lineTo(x1 + sw, topY + sh);
    shape.lineTo(x2 + x4, topY);
    shape.lineTo(x2+x3, x5);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, steps: 1 });
    geom.translate(0, 0, -L / 2);
    geom.computeVertexNormals();
    return geom;
  }, [H, topY, x1, x2, x3, x4, x5, L, beta]);

  // ── Blinding ──
  const blindingGeometry = useMemo(() => {
    const geom = new THREE.BoxGeometry(x1 + 0.2, 0.1, L + 0.2);
    geom.translate(x1 / 2, -0.05, 0);
    return geom;
  }, [x1, L]);

  const isWireframe = renderMode === 'wireframe';
  // Keep the camera depth range tight enough for the opaque wall to occlude
  // rebars reliably when the user zooms out. The previous 0.001..1000 range
  // lost too much depth precision and caused geometry/texture flicker.
  const cameraFar = Math.max(500, Math.max(totalH, x1, L) * 3 + 100);
  // Realistic PBR mode is intentionally downgraded on phones; the explicit
  // mobile toggle should not turn a small screen into a high-resolution shadow
  // and environment workload.
  const isRealistic = renderMode === 'realistic' && !mobilePerformance;
  // Explicit input/measurement selection must remain discoverable even when
  // the general dimension layer is hidden from the viewport toolbar.
  const showDims = effectiveVisible.dimensions || activeHighlightedGeoField !== null;
  const showFocusedSectionProfile = modelOnly && isolating && activeCameraFocusField !== 'L';
  const sectionProfilePoints = useMemo<[number, number, number][]>(() => [
    [0, 0, 0],
    [x1, 0, 0],
    [x1, x5, 0],
    [x2 + x3, x5, 0],
    [x2 + x4, topY, 0],
    [x2, topY, 0],
    [x2, x5, 0],
    [0, x5, 0],
    [0, 0, 0],
  ], [topY, x1, x2, x3, x4, x5]);
  const dimPresentation = {
    alwaysShow: alwaysShowDimensionLabels,
    compact,
    focusedField: activeHighlightedGeoField,
  };
  const handleDimensionSelect = useCallback((field: GeometryFieldKey) => {
    setSelectedGeoField(field);
    if (!focusInputOnDimensionClick) return;
    setFocusedGeoField(field);
    window.dispatchEvent(new CustomEvent('retaining-wall:focus-geometry-field', { detail: { field } }));
  }, [focusInputOnDimensionClick, setFocusedGeoField, setSelectedGeoField]);
  // Dim lines sit just in front of the wall's front face (+Z side).
  // A tiny 0.04 m offset prevents z-fighting with the wall surface.
  const dimZ        = displayedCameraView === 'side' ? 0.04 : L / 2 + 0.04;
  // Terrain level in wall-local coords = Df (base bottom is local y=0).
  const localTerrain = pitDepth;

  const handleWebglContextLost = useCallback(() => {
    if (webglRecoveryTimerRef.current) clearTimeout(webglRecoveryTimerRef.current);
    setSceneReady(false);
    setWebglError('3D WebGL oturumu yeniden başlatılıyor...');
    webglRecoveryTimerRef.current = setTimeout(() => {
      webglRecoveryTimerRef.current = null;
      setWebglResetKey((value) => value + 1);
      setWebglError(null);
    }, 700);
  }, []);

  useEffect(() => () => {
    if (webglRecoveryTimerRef.current) clearTimeout(webglRecoveryTimerRef.current);
  }, []);

  return (
    <div className={`absolute inset-0 ${modelOnly ? 'bg-transparent' : 'bg-[#0a0a0c]'} ${cameraInteractive ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-default'}`}>
      {webglError ? (
        <div className={`flex h-full w-full items-center justify-center text-xs text-[var(--sf-text-secondary)] ${modelOnly ? 'bg-[var(--sf-bg-canvas)]' : 'bg-[#111827]'}`}>
          {webglError}
        </div>
      ) : (
        <>
        {!sceneReady && (
          <div className={`absolute inset-0 z-20 flex items-center justify-center ${modelOnly ? 'bg-[var(--sf-bg-canvas)]' : 'bg-zinc-950'}`} role="status" aria-live="polite">
            <div className="rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] px-4 py-3 text-center shadow-lg">
              <div className="mx-auto size-5 animate-spin rounded-full border-2 border-[var(--sf-border-default)] border-t-[var(--sf-action-primary)]" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-[var(--sf-text-primary)]">3D model hazırlanıyor</p>
              <p className="mt-1 text-xs text-[var(--sf-text-muted)]">Geometri ve görünüm kaynakları yükleniyor.</p>
            </div>
          </div>
        )}
        <Canvas
          key={webglResetKey}
          shadows={mobilePerformance || modelOnly ? false : 'percentage'}
          dpr={mobilePerformance || compact ? 1 : [1, 2]}
          frameloop={modelOnly ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: modelOnly, powerPreference: 'high-performance' }}
          camera={{ position: [14, 12, 14], fov: 45, near: 0.1, far: cameraFar }}
          style={{ width: '100%', height: '100%', background: 'transparent', touchAction: 'none' }}
          onCreated={({ gl }) => {
            gl.setClearColor(modelOnly ? '#000000' : '#111827', modelOnly ? 0 : 1);
            gl.localClippingEnabled = true;
            gl.xr.enabled = enableVr;
          }}
        >
          <WebglContextLossGuard onContextLost={handleWebglContextLost} />
          <SceneReadySignal
            signal={wallInput}
            resetKey={webglResetKey}
            onReady={() => {
              setSceneReady(true);
              onReady?.();
            }}
          />
          {enableVr && (
            <VrManager
              sceneOffset={sceneOffset}
              setSceneOffset={setSceneOffset}
              vrScale={vrScale}
              setVrScale={setVrScale}
            />
          )}

        {/* Sky / Environment */}
        {!modelOnly && (isRealistic ? (
          <>
            <Environment files={publicAsset('textures/env.exr')} background backgroundBlurriness={0.04} />
            <ambientLight intensity={0.3} />
            <directionalLight castShadow position={[14, 18, 10]} intensity={1.6}
              shadow-mapSize={[2048, 2048]}>
              <orthographicCamera attach="shadow-camera" args={[-25, 25, 25, -25, 0.1, 80]} />
            </directionalLight>
          </>
        ) : (
          <>
            <color attach="background" args={['#111827']} />
            {!mobilePerformance && <Environment preset="city" />}
            <ambientLight intensity={0.65} />
            <directionalLight position={[10, 12, 10]} intensity={0.9} />
            <directionalLight position={[-10, 10, -10]} intensity={0.4} />
          </>
        ))}
        {modelOnly && <ambientLight intensity={1} />}
        <group position={sceneOffset} scale={[vrScale, vrScale, vrScale]}>
          {!mobilePerformance && !modelOnly && <ContactShadows
            position={[x1 / 2, -pitDepth - 0.01, 0]}
          opacity={0.45} scale={Math.max(30, L + 20)} blur={2} far={20}
        />}

        {/* Fixed terrain with clipping hole at pit area */}
        {effectiveVisible.ground && !isWireframe && (
          <mesh geometry={terrainGeometry} receiveShadow={isRealistic}>
            <meshStandardMaterial
              {...(isRealistic ? groundPBR : {})}
              color={isRealistic ? '#ffffff' : '#4a4238'}
              roughness={1} metalness={0}
              clippingPlanes={effectiveVisible.excavation ? pitClipPlanes : []}
              clipIntersection
            />
          </mesh>
        )}

        {/* Excavation pit — trapezoid walls + floor */}
        {effectiveVisible.excavation && !isWireframe && (
          <group>
            {[pitGeometry.left, pitGeometry.right, pitGeometry.back, pitGeometry.front, pitGeometry.floor].map((g, i) => (
              <mesh key={i} geometry={g} receiveShadow={isRealistic}>
                <meshStandardMaterial
                  map={isRealistic ? soilTex : null}
                  color={isRealistic ? '#ffffff' : '#8a6a48'}
                  roughness={0.98} metalness={0}
                  side={THREE.DoubleSide}
                  clippingPlanes={wallClippingPlanes}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* ── WALL GROUP — translated down by pitDepth so base sits at pit floor ── */}
        <group position={[0, -pitDepth, 0]}>

      {/* Blinding — hidden in isolation for a clean technical section */}
          {effectiveVisible.wall && !isWireframe && !isolating && (
            <mesh geometry={blindingGeometry}>
              <meshStandardMaterial color="#707070" roughness={0.9} metalness={0} clippingPlanes={wallClippingPlanes} />
            </mesh>
          )}

          {/* Retaining Wall — context-aware rendering:
              • isolating : dark translucent fill + bright silhouette edges only (no triangle lines)
              • wireframe : silhouette Edges only, no `wireframe=true` triangle mesh
              • realistic : full PBR concrete
              • shaded    : matte fill + dark edge outline */}
          {effectiveVisible.wall && !showFocusedSectionProfile && (
            <group>
              {[wallGeometry].map((geometry) => (
                <mesh key="wall" geometry={geometry} castShadow={isRealistic && !isolating} receiveShadow={isRealistic && !isolating}>
                  {isolating && !modelOnly ? (
                    <meshBasicMaterial color="#0f172a" transparent opacity={0.35} depthWrite={false} clippingPlanes={wallClippingPlanes} side={THREE.DoubleSide} />
                  ) : isWireframe ? (
                    <meshBasicMaterial color={modelOnly ? embeddedSurfaceColor : '#0f172a'} transparent opacity={modelOnly ? 0.06 : 0.2} depthWrite={false} clippingPlanes={wallClippingPlanes} side={THREE.DoubleSide} />
                  ) : (
                    <meshPhysicalMaterial
                      {...(isRealistic ? wallPBR : {})}
                      color={isRealistic ? '#ffffff' : '#8a8d8f'}
                      roughness={visibleParts.concreteTransparent ? 0.08 : (isRealistic ? 1 : 0.88)}
                      metalness={isRealistic ? 0.02 : 0.05}
                      transparent={visibleParts.concreteTransparent}
                      opacity={visibleParts.concreteTransparent ? 0.12 : 1.0}
                      depthWrite={!visibleParts.concreteTransparent}
                      transmission={visibleParts.concreteTransparent ? 0.98 : 0.0}
                      thickness={visibleParts.concreteTransparent ? 0.5 : 0.0}
                      clippingPlanes={wallClippingPlanes}
                      side={THREE.DoubleSide}
                    />
                  )}
                  {(isolating || isWireframe || renderMode === 'shaded' || visibleParts.concreteTransparent) && (
                    <Edges
                      threshold={15}
                      color={modelOnly ? embeddedWireframeColor : isolating ? '#e2e8f0' : isWireframe ? '#94a3b8' : (visibleParts.concreteTransparent ? '#64748b' : '#1f2937')}
                      lineWidth={modelOnly ? 1.5 : isolating ? 2 : 1}
                      clippingPlanes={wallClippingPlanes}
                    />
                  )}
                </mesh>
              ))}
            </group>
          )}

          {/* Focused embedded preview: draw one clean cross-section contour.
              This removes projected front/back extrusion edges that otherwise
              overlap around the stem and base. */}
          {effectiveVisible.wall && showFocusedSectionProfile && (
            <group>
              <Line points={sectionProfilePoints} color={embeddedWireframeColor} lineWidth={1.5} />
            </group>
          )}

          {!modelOnly && <RebarCage clippingPlanes={wallClippingPlanes} />}

          {/* Ground-level reference line — crucial for Df visualization when
              excavation/terrain are hidden. Dashed slate line at local y=pitDepth. */}
          {isolating && !modelOnly && (
            <group>
              <Line
                points={[[-0.5, pitDepth, dimZ], [x1 + 1.2, pitDepth, dimZ]]}
                color="#64748b"
                lineWidth={1}
                dashed
                dashSize={0.22}
                gapSize={0.14}
                opacity={0.7}
                transparent
              />
              <Html position={[x1 + 1.3, pitDepth, dimZ]} zIndexRange={[100, 0]}>
                <div
                  style={{ pointerEvents: 'none', fontSize: 11, color: '#cbd5e1', letterSpacing: '0.08em' }}
                  className="font-mono uppercase"
                >
                  zemin
                </div>
              </Html>
            </group>
          )}

          {/* Backfill */}
          {effectiveVisible.soil && !isWireframe && (
            <mesh geometry={soilGeometry} castShadow={isRealistic} receiveShadow={isRealistic}>
              <meshStandardMaterial
                map={isRealistic ? soilTex : null}
                color={isRealistic ? '#ffffff' : '#7a5a3e'}
                roughness={0.95} metalness={0}
                transparent={!isRealistic} opacity={isRealistic ? 1 : 0.85}
                wireframe={isWireframe}
                clippingPlanes={wallClippingPlanes}
              />
            </mesh>
          )}

          {/* Hover glow lines handled by DimLine forceHighlight prop below */}

          {/* Dimension edges — invisible hit-targets on actual wall edges; glow + label on hover */}
          {showDims && (
            <group>
              {/* H — left edge of stem */}
              <DimLine
                start={[x2, x5, dimZ]} end={[x2, topY, dimZ]}
                labelOffset={[compact ? -0.55 : -0.65, 0, 0]}
                field="H" value={H} label="H · Yükseklik"
                color={geometryFieldColors.H} hasError={errorFields.has('H')} axis="y"
                forceHighlight={activeHighlightedGeoField === 'H'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x1 — base bottom edge */}
              <DimLine
                start={[0, 0, dimZ]} end={[x1, 0, dimZ]}
                labelOffset={[0, compact ? -0.8 : -0.55, 0]}
                field="x1" value={x1} label="x1 · Temel"
                color={geometryFieldColors.x1} hasError={errorFields.has('x1')} axis="x"
                forceHighlight={activeHighlightedGeoField === 'x1'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x5 — left edge of base (thickness) */}
              <DimLine
                start={[0, 0, dimZ]} end={[0, x5, dimZ]}
                labelOffset={[compact ? -0.45 : -0.65, 0, 0]}
                field="x5" value={x5} label="x5 · Plak"
                color={geometryFieldColors.x5} hasError={errorFields.has('x5')} axis="y"
                forceHighlight={activeHighlightedGeoField === 'x5'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x2 — toe top edge */}
              <DimLine
                start={[0, x5, dimZ]} end={[x2, x5, dimZ]}
                labelOffset={[0, 0.55, 0]}
                field="x2" value={x2} label="x2 · Burun"
                color={geometryFieldColors.x2} hasError={errorFields.has('x2')} axis="x"
                forceHighlight={activeHighlightedGeoField === 'x2'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x3 — stem bottom thickness top edge */}
              <DimLine
                start={[x2, x5, dimZ]} end={[x2+x3, x5, dimZ]}
                labelOffset={[0, compact ? 1.05 : 0.55, 0]}
                field="x3" value={x3} label="x3 · Alt gövde"
                color={geometryFieldColors.x3} hasError={errorFields.has('x3')} axis="x"
                forceHighlight={activeHighlightedGeoField === 'x3'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x4 — stem top edge */}
              <DimLine
                start={[x2, topY, dimZ]} end={[x2+x4, topY, dimZ]}
                labelOffset={[0, 0.55, 0]}
                field="x4" value={x4} label="x4 · Üst gövde"
                color={geometryFieldColors.x4} hasError={errorFields.has('x4')} axis="x"
                forceHighlight={activeHighlightedGeoField === 'x4'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* x6 — heel top edge */}
              <DimLine
                start={[x2+x3, x5, dimZ]} end={[x1, x5, dimZ]}
                labelOffset={[0, 0.55, 0]}
                field="x6" value={x6} label="x6 · Topuk"
                color={geometryFieldColors.x6} hasError={errorFields.has('x6')} axis="x"
                forceHighlight={activeHighlightedGeoField === 'x6'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* Df — right edge of base up to terrain */}
              <DimLine
                start={[x1, 0, dimZ]} end={[x1, localTerrain, dimZ]}
                labelOffset={[compact ? 0.55 : 0.65, 0, 0]}
                field="Df" value={Df} label="Df · Gömme"
                color={geometryFieldColors.Df} hasError={errorFields.has('Df')} axis="y"
                forceHighlight={activeHighlightedGeoField === 'Df'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
              {/* L — wall length along Z */}
              <DimLine
                start={[x1/2, x5/2, -L/2]} end={[x1/2, x5/2, L/2]}
                labelOffset={[0, compact ? 0.9 : 0.55, 0]}
                field="L" value={L} label="L · Uzunluk"
                color={geometryFieldColors.L} hasError={errorFields.has('L')} axis="z"
                forceHighlight={activeHighlightedGeoField === 'L'}
                onSelect={handleDimensionSelect}
                {...dimPresentation}
              />
            </group>
          )}
        </group>
        </group>

        {!modelOnly && (
          <Grid infiniteGrid fadeDistance={50} sectionColor="#27272a" cellColor="#18181b"
            position={[0, -pitDepth - 0.02, 0]}
          />
        )}
        <CameraController
          view={activeCameraView}
          target={centerTarget}
          bounds={{ H: totalH, B: x1, L }}
          focusField={activeCameraFocusField}
          focusFrame={focusFrame}
          interactive={cameraInteractive}
          distanceScale={modelOnly ? 0.72 : compact ? 1.1 : 1}
        />
        {!compact && (
          <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
            <ViewCubeGizmo />
          </GizmoHelper>
        )}
        </Canvas>
        </>
      )}
    </div>
  );
}

function WebglContextLossGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, { once: true });
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [gl, onContextLost]);

  return null;
}

function SceneReadySignal({
  signal,
  resetKey,
  onReady,
}: {
  signal: object;
  resetKey: number;
  onReady: () => void;
}) {
  const firedRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    firedRef.current = false;
  }, [signal, resetKey]);

  useFrame(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    window.requestAnimationFrame(() => onReadyRef.current());
  });

  return null;
}
