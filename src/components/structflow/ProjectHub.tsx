"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import {
  PROJECT_TYPE_LABELS,
  type ProjectPayload,
  type ProjectType,
} from "@/core/workspace/projectTypes";
import { publicAsset } from "@/lib/publicAsset";
import type { WallGeometry } from "@/retaining-wall/types";
import { createRetainingWallSolidGeometry } from "@/retaining-wall/geometry/retainingWallSolidGeometry";
import type { NewProjectOptions } from "@/shell/project/projectPayloadFactory";
import { NewProjectDialog } from "./project-hub/NewProjectDialog";
import { ProjectHubFrame } from "./project-hub/ProjectHubFrame";
import {
  getProjectPathKey,
  normalizePath,
  readStoredSet,
  writeStoredSet,
} from "./project-hub/projectHubUtils";
import type {
  ManagerView,
  ProjectFilter,
  ProjectItem,
  SortMode,
} from "./project-hub/types";

export { NewProjectDialog } from "./project-hub/NewProjectDialog";
export type { ProjectItem } from "./project-hub/types";

interface RecentEntry {
  id: string;
  path: string;
  name: string;
  at: string;
  projectType?: ProjectType;
}

interface WorkspaceProject {
  id: string;
  name: string;
  filePath: string | null;
  dirty: boolean;
  updatedAt: string;
  projectType: ProjectType;
  payload: ProjectPayload;
}

interface ProjectHubProps {
  recents: RecentEntry[];
  workspaceProjects: WorkspaceProject[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNew: (options?: NewProjectOptions) => void;
  onOpen: () => void;
  onOpenRecent: (
    recentId: string,
    preview?: { name: string; projectType: ProjectType; payload?: ProjectPayload },
  ) => void;
  onOpenWorkspaceProject: (id: string) => void;
  onCloseWorkspaceProject: (id: string) => boolean;
  onRemoveRecent: (recentId: string) => void;
  recentPayloads: Record<string, ProjectPayload>;
}

const FAVORITES_KEY = "structflow.favoriteProjects";
const ARCHIVED_KEY = "structflow.archivedProjects";

export default function ProjectHub({
  recents,
  workspaceProjects,
  searchQuery,
  onSearchChange,
  onNew,
  onOpen,
  onOpenRecent,
  onOpenWorkspaceProject,
  onCloseWorkspaceProject,
  onRemoveRecent,
  recentPayloads,
}: ProjectHubProps) {
  const [managerView, setManagerView] = useState<ManagerView>("projects");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [favoritePaths, setFavoritePaths] = useState<Set<string>>(() => readStoredSet(FAVORITES_KEY));
  const [archivedPaths, setArchivedPaths] = useState<Set<string>>(() => readStoredSet(ARCHIVED_KEY));
  const [showNewDialog, setShowNewDialog] = useState(false);

  useEffect(() => writeStoredSet(FAVORITES_KEY, favoritePaths), [favoritePaths]);
  useEffect(() => writeStoredSet(ARCHIVED_KEY, archivedPaths), [archivedPaths]);

  const projects = useMemo<ProjectItem[]>(() => {
    const map = new Map<string, ProjectItem>();
    workspaceProjects.forEach((project) => {
      const pathKey = normalizePath(project.filePath);
      map.set(pathKey ?? `workspace:${project.id}`, {
        key: pathKey ?? `workspace:${project.id}`,
        source: "workspace",
        id: project.id,
        path: project.filePath ?? undefined,
        name: project.name,
        category: PROJECT_TYPE_LABELS["retaining-wall"],
        projectType: "retaining-wall",
        updatedAt: project.updatedAt,
        dirty: project.dirty,
        payload: project.payload,
      });
    });

    recents.forEach((recent) => {
      const pathKey = normalizePath(recent.path);
      if (!pathKey || map.has(pathKey)) return;
      map.set(pathKey, {
        key: pathKey,
        source: "recent",
        id: recent.id,
        path: recent.path,
        name: recent.name,
        category: PROJECT_TYPE_LABELS["retaining-wall"],
        projectType: "retaining-wall",
        updatedAt: recent.at,
        dirty: false,
        payload: recentPayloads[pathKey],
      });
    });
    return [...map.values()];
  }, [recents, recentPayloads, workspaceProjects]);

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    const activeIds = new Set(workspaceProjects.map((project) => project.id));
    return projects
      .filter((project) => {
        const pathKey = normalizePath(project.path);
        const favorite = pathKey ? favoritePaths.has(pathKey) : false;
        const archived = pathKey ? archivedPaths.has(pathKey) : false;
        const active = project.id ? activeIds.has(project.id) : false;
        if (managerView === "recent" && project.source !== "recent") return false;
        if (managerView === "favorites" && !favorite) return false;
        if (managerView === "archived" && !archived) return false;
        if (managerView !== "archived" && archived) return false;
        if (filter === "active" && !active) return false;
        if (filter === "favorites" && !favorite) return false;
        if (!q) return true;
        return `${project.name} ${project.path ?? ""}`.toLocaleLowerCase("tr-TR").includes(q);
      })
      .sort((a, b) => {
        if (sortMode === "name-asc") return a.name.localeCompare(b.name, "tr");
        const aTime = new Date(a.updatedAt).getTime() || 0;
        const bTime = new Date(b.updatedAt).getTime() || 0;
        return sortMode === "updated-asc" ? aTime - bTime : bTime - aTime;
      });
  }, [archivedPaths, favoritePaths, filter, managerView, projects, searchQuery, sortMode, workspaceProjects]);

  const openProject = (project: ProjectItem) => {
    if (project.source === "workspace" && project.id) {
      onOpenWorkspaceProject(project.id);
      return;
    }
    if (project.id && project.path) {
      onOpenRecent(project.id, {
        name: project.name,
        projectType: "retaining-wall",
        payload: project.payload,
      });
    }
  };

  const toggleStoredPath = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    project: ProjectItem,
  ) => {
    const pathKey = normalizePath(project.path);
    if (!pathKey) return;
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  };

  const removeProject = (project: ProjectItem) => {
    const ok = window.confirm(
      project.source === "workspace"
        ? "Bu proje açık çalışma alanından kapatılacak. Devam edilsin mi?"
        : "Bu proje listeden kaldırılacak. Dosya diskten silinmez. Devam edilsin mi?",
    );
    if (!ok) return;
    if (project.source === "workspace" && project.id) {
      onCloseWorkspaceProject(project.id);
      return;
    }
    if (project.id) onRemoveRecent(project.id);
  };

  const isFavorite = (project: ProjectItem) => {
    const key = getProjectPathKey(project);
    return key ? favoritePaths.has(key) : false;
  };
  const isArchived = (project: ProjectItem) => {
    const key = getProjectPathKey(project);
    return key ? archivedPaths.has(key) : false;
  };

  return (
    <>
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onSelect={(options) => {
            setShowNewDialog(false);
            onNew(options);
          }}
        />
      )}
      <ProjectHubFrame
        activeView={managerView}
        filter={filter}
        sortMode={sortMode}
        searchQuery={searchQuery}
        projects={visibleProjects}
        isFavorite={isFavorite}
        isArchived={isArchived}
        onViewChange={setManagerView}
        onFilterChange={setFilter}
        onSortModeChange={setSortMode}
        onSearchChange={onSearchChange}
        onClearSearch={() => onSearchChange("")}
        onNewProject={() => setShowNewDialog(true)}
        onOpenDisk={onOpen}
        onNewFromTemplate={() => onNew()}
        onOpen={openProject}
        onToggleFavorite={(project) => toggleStoredPath(setFavoritePaths, project)}
        onToggleArchive={(project) => toggleStoredPath(setArchivedPaths, project)}
        onRemove={removeProject}
        renderProjectPreview={(project, index) => (
          <Project3DPreview project={project} seed={index} compact />
        )}
      />
    </>
  );
}

const FALLBACK_WALL_GEOMETRY: WallGeometry = {
  H: 6,
  x1: 4,
  x2: 1,
  x3: 0.5,
  x4: 0.3,
  x5: 0.6,
  x6: 2.5,
  Df: 1,
  L: 10,
};

const RETAINING_WALL_THUMBNAIL_WIDTH = 1440;
const RETAINING_WALL_THUMBNAIL_HEIGHT = 720;
const RETAINING_WALL_THUMBNAIL_COMPACT_WIDTH = 720;
const RETAINING_WALL_THUMBNAIL_COMPACT_HEIGHT = 432;
const RETAINING_WALL_THUMBNAIL_HIGH_WIDTH = 1920;
const RETAINING_WALL_THUMBNAIL_HIGH_HEIGHT = 960;
const RETAINING_WALL_THUMBNAIL_CACHE_LIMIT = 32;
const RETAINING_WALL_THUMBNAIL_LAYOUT_VERSION = "v6-environment-side-camera";
const RETAINING_WALL_CONCRETE_TILE_SIZE_M = 1.8;
const RETAINING_WALL_GROUND_TILE_SIZE_M = 3.2;

type RetainingWallThumbnailPresentation = "card" | "loading";

const retainingWallThumbnailCache = new Map<string, string>();
const retainingWallThumbnailPromiseCache = new Map<string, Promise<string>>();

type RetainingWallThumbnailQueueTask = {
  cancelled: boolean;
  run: () => Promise<void>;
};

const retainingWallThumbnailQueue: RetainingWallThumbnailQueueTask[] = [];
let retainingWallThumbnailQueueActive = false;

function trimRetainingWallThumbnailCache() {
  while (retainingWallThumbnailCache.size > RETAINING_WALL_THUMBNAIL_CACHE_LIMIT) {
    const firstKey = retainingWallThumbnailCache.keys().next().value;
    if (!firstKey) return;
    retainingWallThumbnailCache.delete(firstKey);
  }
}

function scheduleRetainingWallPreview(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (idleWindow.requestIdleCallback) {
    const id = idleWindow.requestIdleCallback(callback, { timeout: 700 });
    return () => idleWindow.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 24);
  return () => window.clearTimeout(id);
}

function pumpRetainingWallThumbnailQueue() {
  if (retainingWallThumbnailQueueActive || typeof window === "undefined") return;
  const task = retainingWallThumbnailQueue.shift();
  if (!task) return;

  retainingWallThumbnailQueueActive = true;
  scheduleRetainingWallPreview(() => {
    void (async () => {
      try {
        if (!task.cancelled) await task.run();
      } finally {
        retainingWallThumbnailQueueActive = false;
        pumpRetainingWallThumbnailQueue();
      }
    })();
  });
}

function enqueueRetainingWallThumbnailRender(run: () => Promise<void>): () => void {
  const task: RetainingWallThumbnailQueueTask = { cancelled: false, run };
  retainingWallThumbnailQueue.push(task);
  pumpRetainingWallThumbnailQueue();
  return () => {
    task.cancelled = true;
  };
}

function retainingWallPreviewSignature(
  geometry: WallGeometry,
  compact: boolean,
  highQuality: boolean,
  presentation: RetainingWallThumbnailPresentation,
): string {
  return [
    RETAINING_WALL_THUMBNAIL_LAYOUT_VERSION,
    presentation,
    highQuality ? "high" : compact ? "compact" : "full",
    geometry.H,
    geometry.x1,
    geometry.x2,
    geometry.x3,
    geometry.x4,
    geometry.x5,
    geometry.x6,
    geometry.Df,
    geometry.L,
  ].map((value) => typeof value === "number" ? value.toFixed(4) : value).join(":");
}

export function Project3DPreview({
  project,
  compact = false,
  quality = "standard",
  mobile = false,
  onReady,
}: {
  project: ProjectItem;
  seed: number;
  compact?: boolean;
  quality?: "standard" | "high";
  mobile?: boolean;
  onReady?: () => void;
}) {
  const geometry = project.payload?.data.wallInput.geometry ?? FALLBACK_WALL_GEOMETRY;
  return (
    <RetainingWallThumbnailPreview
      geometry={geometry}
      compact={compact}
      highQuality={quality === "high" && !mobile}
      presentation="card"
      onReady={onReady}
    />
  );
}

function RetainingWallThumbnailPreview({ geometry, compact, highQuality, presentation, onReady }: {
  geometry: WallGeometry;
  compact: boolean;
  highQuality: boolean;
  presentation: RetainingWallThumbnailPresentation;
  onReady?: () => void;
}) {
  const cacheKey = useMemo(
    () => retainingWallPreviewSignature(geometry, compact, highQuality, presentation),
    [compact, geometry, highQuality, presentation],
  );
  const cachedSrc = retainingWallThumbnailCache.get(cacheKey) ?? null;
  const [thumbnail, setThumbnail] = useState<{
    key: string;
    src: string | null;
    failed: boolean;
  }>({ key: cacheKey, src: cachedSrc, failed: false });

  useEffect(() => {
    let alive = true;
    if (cachedSrc) {
      onReady?.();
      return () => {
        alive = false;
      };
    }

    const cancel = enqueueRetainingWallThumbnailRender(async () => {
      if (!alive) return;
      try {
        const src = await prepareRetainingWallThumbnail(geometry, compact, highQuality, presentation);
        if (alive) setThumbnail({ key: cacheKey, src, failed: false });
      } catch (error) {
        if (alive) setThumbnail({ key: cacheKey, src: null, failed: true });
        if (process.env.NODE_ENV !== "production") {
          console.warn("StructFlow retaining-wall project thumbnail failed", error);
        }
      } finally {
        if (alive) onReady?.();
      }
    });

    return () => {
      alive = false;
      cancel();
    };
  }, [cacheKey, cachedSrc, compact, geometry, highQuality, onReady, presentation]);

  const src = thumbnail.key === cacheKey ? thumbnail.src : cachedSrc;

  return (
    <div className={`relative w-full overflow-hidden bg-[#080c10] ${compact ? "h-full" : "h-[152px]"}`}>
      {src ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : (
        <div
          className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.035),transparent_58%)] ${thumbnail.failed ? "opacity-70" : "animate-pulse"}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

async function prepareRetainingWallThumbnail(
  geometry: WallGeometry,
  compact: boolean,
  highQuality: boolean,
  presentation: RetainingWallThumbnailPresentation,
): Promise<string> {
  const cacheKey = retainingWallPreviewSignature(geometry, compact, highQuality, presentation);
  const cached = retainingWallThumbnailCache.get(cacheKey);
  if (cached) return cached;

  const inFlight = retainingWallThumbnailPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = renderRetainingWallThumbnail(geometry, compact, highQuality, presentation)
    .then((src) => {
      retainingWallThumbnailCache.set(cacheKey, src);
      trimRetainingWallThumbnailCache();
      return src;
    })
    .finally(() => retainingWallThumbnailPromiseCache.delete(cacheKey));

  retainingWallThumbnailPromiseCache.set(cacheKey, promise);
  return promise;
}

export function prepareProject3DThumbnail(
  project: ProjectItem,
  quality: "standard" | "high" = "standard",
): Promise<string> {
  const geometry = project.payload?.data.wallInput.geometry ?? FALLBACK_WALL_GEOMETRY;
  return prepareRetainingWallThumbnail(geometry, true, quality === "high", "loading");
}

async function renderRetainingWallThumbnail(
  geometry: WallGeometry,
  compact: boolean,
  highQuality: boolean,
  presentation: RetainingWallThumbnailPresentation,
): Promise<string> {
  const width = highQuality
    ? RETAINING_WALL_THUMBNAIL_HIGH_WIDTH
    : compact
      ? RETAINING_WALL_THUMBNAIL_COMPACT_WIDTH
      : RETAINING_WALL_THUMBNAIL_WIDTH;
  const height = highQuality
    ? RETAINING_WALL_THUMBNAIL_HIGH_HEIGHT
    : compact
      ? RETAINING_WALL_THUMBNAIL_COMPACT_HEIGHT
      : RETAINING_WALL_THUMBNAIL_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let environmentTexture: THREE.DataTexture | null = null;
  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x080c10, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c10);

    try {
      environmentTexture = await new EXRLoader().loadAsync(publicAsset("textures/env.exr"));
      environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      environmentTarget = pmrem.fromEquirectangular(environmentTexture);
      pmrem.dispose();
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.82;
      scene.background = environmentTexture;
      scene.backgroundBlurriness = 0.26;
      scene.backgroundIntensity = 0.54;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("StructFlow retaining-wall thumbnail environment failed", error);
      }
    }

    const modelGroup = new THREE.Group();
    const wallGeometry = createRetainingWallSolidGeometry(geometry);
    applyThumbnailWorldScaleUvs(wallGeometry, RETAINING_WALL_CONCRETE_TILE_SIZE_M);
    const wallMaterial = await createRetainingWallThumbnailMaterial(
      "textures/wall",
      renderer,
      0xffffff,
    );
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    modelGroup.add(wallMesh);

    const edgeGeometry = new THREE.EdgesGeometry(wallGeometry, 18);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xe7ecea,
      transparent: true,
      opacity: 0.28,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    modelGroup.add(edges);
    scene.add(modelGroup);

    const modelBounds = new THREE.Box3().setFromObject(modelGroup);
    await addRetainingWallThumbnailGround(scene, modelBounds, renderer);
    addRetainingWallThumbnailLights(scene, modelBounds, highQuality);
    const camera = createRetainingWallThumbnailCamera(modelBounds, width / height, presentation);

    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  } finally {
    if (scene) disposeRetainingWallThumbnailScene(scene);
    environmentTarget?.dispose();
    environmentTexture?.dispose();
    renderer?.dispose();
  }
}

interface RetainingWallThumbnailPbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  armMap: THREE.Texture;
  aoMap: THREE.Texture;
}

async function loadRetainingWallThumbnailPbrSet(
  base: string,
  renderer: THREE.WebGLRenderer,
): Promise<RetainingWallThumbnailPbrSet> {
  const loader = new THREE.TextureLoader();
  const [map, normalMap, armMap, aoMap] = await Promise.all([
    loader.loadAsync(publicAsset(`${base}/diff.jpg`)),
    loader.loadAsync(publicAsset(`${base}/nor.jpg`)),
    loader.loadAsync(publicAsset(`${base}/arm.jpg`)),
    loader.loadAsync(publicAsset(`${base}/ao.jpg`)),
  ]);

  map.colorSpace = THREE.SRGBColorSpace;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  [map, normalMap, armMap, aoMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  });
  return { map, normalMap, armMap, aoMap };
}

async function createRetainingWallThumbnailMaterial(
  base: string,
  renderer: THREE.WebGLRenderer,
  color: number,
): Promise<THREE.MeshStandardMaterial> {
  const pbr = await loadRetainingWallThumbnailPbrSet(base, renderer);
  return new THREE.MeshStandardMaterial({
    color,
    map: pbr.map,
    normalMap: pbr.normalMap,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughnessMap: pbr.armMap,
    metalnessMap: pbr.armMap,
    aoMap: pbr.aoMap,
    roughness: 0.98,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

function applyThumbnailWorldScaleUvs(
  geometry: THREE.BufferGeometry,
  metersPerTile: number,
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!position || !normal) return;

  const uvs = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));

    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z / metersPerTile;
      v = y / metersPerTile;
    } else if (ny >= nx && ny >= nz) {
      u = x / metersPerTile;
      v = z / metersPerTile;
    } else {
      u = x / metersPerTile;
      v = y / metersPerTile;
    }
    uvs[index * 2] = u;
    uvs[index * 2 + 1] = v;
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("uv1", new THREE.BufferAttribute(new Float32Array(uvs), 2));
}

async function addRetainingWallThumbnailGround(
  scene: THREE.Scene,
  modelBounds: THREE.Box3,
  renderer: THREE.WebGLRenderer,
): Promise<THREE.Mesh> {
  const size = modelBounds.getSize(new THREE.Vector3());
  const center = modelBounds.getCenter(new THREE.Vector3());
  // The loading/card camera is fitted only to the wall. Keep the textured soil
  // plane far beyond the frustum so its outer edges never read as a small pad.
  // This gives the project preview the same visual continuity as an infinite
  // viewport ground without paying the cost of a truly unbounded shader plane.
  const footprintSpan = Math.max(size.x, size.z, 8);
  const groundSize = Math.max(footprintSpan * 40, 400);
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
  groundGeometry.rotateX(-Math.PI / 2);
  applyThumbnailWorldScaleUvs(groundGeometry, RETAINING_WALL_GROUND_TILE_SIZE_M);
  const groundMaterial = await createRetainingWallThumbnailMaterial(
    "textures/ground",
    renderer,
    0xffffff,
  );
  const ground = new THREE.Mesh(
    groundGeometry,
    groundMaterial,
  );
  ground.position.set(
    center.x,
    modelBounds.min.y - 0.03,
    center.z,
  );
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);
  return ground;
}

function addRetainingWallThumbnailLights(
  scene: THREE.Scene,
  bounds: THREE.Box3,
  highQuality: boolean,
) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 8);

  scene.add(new THREE.HemisphereLight(0xf1f4f2, 0x111916, 1.02));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
  keyLight.position.set(
    center.x - span * 0.75,
    center.y + span * 1.45,
    center.z + span * 0.85,
  );
  keyLight.target.position.copy(center);
  keyLight.castShadow = true;
  const shadowMapSize = highQuality ? 2048 : 1024;
  keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = span * 5;
  const shadowExtent = span * 0.85;
  keyLight.shadow.camera.left = -shadowExtent;
  keyLight.shadow.camera.right = shadowExtent;
  keyLight.shadow.camera.top = shadowExtent;
  keyLight.shadow.camera.bottom = -shadowExtent;
  keyLight.shadow.bias = -0.00035;
  keyLight.shadow.normalBias = 0.015;
  scene.add(keyLight, keyLight.target);

  const fillLight = new THREE.DirectionalLight(0x9fc4d4, 0.42);
  fillLight.position.set(
    center.x + span * 0.9,
    center.y + span * 0.55,
    center.z - span,
  );
  fillLight.target.position.copy(center);
  scene.add(fillLight, fillLight.target);
}

function createRetainingWallThumbnailCamera(
  modelBounds: THREE.Box3,
  aspect: number,
  presentation: RetainingWallThumbnailPresentation,
): THREE.PerspectiveCamera {
  const modelSphere = modelBounds.getBoundingSphere(new THREE.Sphere());
  const size = modelBounds.getSize(new THREE.Vector3());
  const center = modelBounds.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(
    center.x,
    center.y + size.y * 0.055,
    center.z,
  );

  // Keep the live viewport's elevated ISO character but move closer to a side
  // elevation so the full wall face reads clearly and the footing still shows
  // enough depth to communicate the 3-D geometry.
  const direction = new THREE.Vector3(-0.98, 0.48, 0.36).normalize();
  const verticalFovDeg = 45;
  const verticalFov = THREE.MathUtils.degToRad(verticalFovDeg);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.1));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const radius = Math.max(modelSphere.radius, size.y * 0.6, 1);
  // Loading thumbnails are displayed through a cover-sized image container;
  // leave additional framing room so no part of the wall is cropped there.
  const framingScale = presentation === "loading" ? 1.16 : 1.09;
  const distance = (radius / Math.sin(limitingFov / 2)) * framingScale;

  const camera = new THREE.PerspectiveCamera(verticalFovDeg, aspect, 0.1, distance + radius * 6);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return camera;
}

function disposeRetainingWallThumbnailScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const renderable = object as THREE.Mesh | THREE.LineSegments;
    if (renderable.geometry) geometries.add(renderable.geometry);
    const material = renderable.material;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });
  materials.forEach((material) => {
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    [
      material.map,
      material.normalMap,
      material.roughnessMap,
      material.metalnessMap,
      material.aoMap,
    ].forEach((texture) => {
      if (texture) textures.add(texture);
    });
  });
  geometries.forEach((entry) => entry.dispose());
  materials.forEach((entry) => entry.dispose());
  textures.forEach((entry) => entry.dispose());
}
