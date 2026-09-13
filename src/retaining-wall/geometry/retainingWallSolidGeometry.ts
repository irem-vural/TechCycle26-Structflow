import * as THREE from 'three';
import type { WallGeometry } from '@/retaining-wall/types';

export type RetainingWallProfilePoint = [number, number];

/**
 * Canonical retaining-wall concrete profile used by both the live 3D viewport
 * and project thumbnails. Keeping one geometry source prevents the manager
 * preview from drifting away from the model that is actually opened.
 */
export function getRetainingWallProfilePoints(
  geometry: WallGeometry,
): RetainingWallProfilePoint[] {
  const { H, x1, x2, x3, x4, x5 } = geometry;
  const topY = x5 + H;

  return [
    [0, 0],
    [x1, 0],
    [x1, x5],
    [x2 + x3, x5],
    [x2 + x4, topY],
    [x2, topY],
    [x2, x5],
    [0, x5],
  ];
}

export function createRetainingWallSolidGeometry(
  geometry: WallGeometry,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = getRetainingWallProfilePoints(geometry);
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(points[0][0], points[0][1]);

  const solid = new THREE.ExtrudeGeometry(shape, {
    depth: geometry.L,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  solid.translate(0, 0, -geometry.L / 2);

  const uv = solid.getAttribute('uv');
  if (uv) solid.setAttribute('uv1', uv.clone());
  solid.computeVertexNormals();
  return solid;
}
