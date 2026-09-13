'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useRetainingWallStore } from '../store/useRetainingWallStore';

// Rebar Material Constants
const REBAR_COLOR = new THREE.Color('#4b5563'); // Slate-600 steel color
const REBAR_ROUGHNESS = 0.35;
const REBAR_METALNESS = 0.9;

export default function RebarCage({ clippingPlanes = [] }: { clippingPlanes?: THREE.Plane[] }) {
  const { wallInput, visibleParts } = useRetainingWallStore();
  const { H, x1, x2, x3, x4, x5, L } = wallInput.geometry;

  // Spacing and sizes (in meters)
  const coverStem = 0.04;  // 40mm cover
  const coverBase = 0.05;  // 50mm cover
  
  const dMain = 0.016;     // 16mm main rebar
  const dDist = 0.010;     // 10mm distribution rebar
  const dBase = 0.014;     // 14mm base rebar

  // Spacings (Optimized for realism & density control per user request)
  const sVertMain = 0.25;   // 250mm spacing for stem back rebars (reduced density)
  const sVertSec = 0.25;    // 250mm spacing for stem front rebars (aligned with back)
  const sHorizDist = 0.35;  // 350mm spacing for distribution bars (reduced density)
  const sBaseTrans = 0.25;  // 250mm spacing for transverse base bars (reduced density)
  const sBaseLong = 0.30;   // 300mm spacing for longitudinal base bars (reduced density)

  // Ref structures to update instanced matrices
  const instVertBackRef = useRef<THREE.InstancedMesh>(null);
  const instVertFrontRef = useRef<THREE.InstancedMesh>(null);
  const instHorizBackRef = useRef<THREE.InstancedMesh>(null);
  const instHorizFrontRef = useRef<THREE.InstancedMesh>(null);
  const instBaseTransBottomRef = useRef<THREE.InstancedMesh>(null);
  const instBaseTransTopRef = useRef<THREE.InstancedMesh>(null);
  const instBaseLongBottomRef = useRef<THREE.InstancedMesh>(null);
  const instBaseLongTopRef = useRef<THREE.InstancedMesh>(null);
  const instHooksRef = useRef<THREE.InstancedMesh>(null);
  const instTiesRef = useRef<THREE.InstancedMesh>(null);
  const instBaseEdgeVertRef = useRef<THREE.InstancedMesh>(null);
  const instStemTopCapRef = useRef<THREE.InstancedMesh>(null);
  const instWireLoopsRef = useRef<THREE.InstancedMesh>(null);
  const instWireTailsRef = useRef<THREE.InstancedMesh>(null);
  const instTiesFrontHookRef = useRef<THREE.InstancedMesh>(null);
  const instTiesBackHookRef = useRef<THREE.InstancedMesh>(null);
  const instStemTopCapLegsRef = useRef<THREE.InstancedMesh>(null);
  const instBaseEdgeHorizRef = useRef<THREE.InstancedMesh>(null);

  // Rebar layout calculations
  const cageData = useMemo(() => {
    const topY = x5 + H;

    // --- 1. STEM VERTICAL BACK REBARS (Inclined main tensile bars) ---
    const xStartBack = x2 + x3 - coverStem;
    const yStartBack = coverBase;
    const xEndBack = x2 + x4 - coverStem;
    const yEndBack = topY - coverStem;

    const dx = xEndBack - xStartBack;
    const dy = yEndBack - yStartBack;
    const lenVertBack = Math.sqrt(dx * dx + dy * dy);
    const angleVertBack = Math.atan2(dx, dy);

    // Spacing along Z
    const vertBackCount = Math.max(2, Math.floor((L - 2 * coverBase) / sVertMain) + 1);
    const zOffsetVertBack = (L - (vertBackCount - 1) * sVertMain) / 2 - L / 2;

    // --- 2. STEM VERTICAL FRONT REBARS (Straight secondary bars) ---
    const xVertFront = x2 + coverStem;
    const lenVertFront = topY - coverStem - coverBase;
    const vertFrontCount = Math.max(2, Math.floor((L - 2 * coverBase) / sVertSec) + 1);
    const zOffsetVertFront = (L - (vertFrontCount - 1) * sVertSec) / 2 - L / 2;

    // --- 3. STEM HORIZONTAL DISTRIBUTION REBARS ---
    const horizCount = Math.max(2, Math.floor((H - coverStem) / sHorizDist) + 1);

    // --- 4. BASE BOTTOM & TOP TRANSVERSE REBARS ---
    const lenBaseTrans = x1 - 2 * coverBase;
    const baseTransCount = Math.max(2, Math.floor((L - 2 * coverBase) / sBaseTrans) + 1);
    const zOffsetBaseTrans = (L - (baseTransCount - 1) * sBaseTrans) / 2 - L / 2;

    // --- 5. BASE BOTTOM & TOP LONGITUDINAL REBARS ---
    const lenBaseLong = L - 2 * coverBase;
    const baseLongCount = Math.max(2, Math.floor((x1 - 2 * coverBase) / sBaseLong) + 1);
    const xOffsetBaseLong = (x1 - (baseLongCount - 1) * sBaseLong) / 2;

    // --- 6. HOOKS (L-bend anchorage at base) ---
    const lenHook = 0.25;
    const hookCount = vertBackCount + vertFrontCount;

    // --- 7. TIES (Çirozlar - Stem Stirrups) ---
    const sTiesVert = 0.60; // 600mm vertical spacing (reduced density)
    const tiesVertCount = Math.max(2, Math.floor((H - coverStem) / sTiesVert) + 1);
    const tiesZStride = 2; // place at every 2nd vertical rebar grid to avoid clutter
    const tiesZCount = Math.max(1, Math.floor(vertFrontCount / tiesZStride));
    const tiesTotalCount = tiesVertCount * tiesZCount;

    // --- 8. BASE EDGE VERTICAL LINKS (딕 closure bars for footing cage) ---
    const lenBaseEdgeVert = x5 - 2 * coverBase;
    const baseEdgeVertCount = baseTransCount * 2;

    // --- 9. STEM TOP CAPS (U-caps joining front & back bars at top) ---
    const stemTopCapCount = vertFrontCount;
    const lenStemTopCap = xEndBack - xVertFront;

    return {
      vertBack: {
        count: vertBackCount,
        length: lenVertBack,
        angle: angleVertBack,
        xStart: xStartBack,
        yStart: yStartBack,
        zStart: zOffsetVertBack,
        spacing: sVertMain,
      },
      vertFront: {
        count: vertFrontCount,
        length: lenVertFront,
        x: xVertFront,
        yStart: yStartBack,
        zStart: zOffsetVertFront,
        spacing: sVertSec,
      },
      horiz: {
        count: horizCount,
        length: L - 2 * coverBase,
        yStart: x5 + coverBase,
        spacing: sHorizDist,
        frontX: xVertFront + dMain,
      },
      baseTrans: {
        count: baseTransCount,
        length: lenBaseTrans,
        zStart: zOffsetBaseTrans,
        spacing: sBaseTrans,
        yBottom: coverBase,
        yTop: x5 - coverBase,
      },
      baseLong: {
        count: baseLongCount,
        length: lenBaseLong,
        xStart: xOffsetBaseLong,
        spacing: sBaseLong,
        yBottom: coverBase + dBase,
        yTop: x5 - coverBase - dBase,
      },
      hooks: {
        count: hookCount,
        length: lenHook,
        vertBackCount,
        vertFrontCount,
      },
      ties: {
        count: tiesTotalCount,
        vertCount: tiesVertCount,
        zStart: zOffsetVertFront,
        zSpacing: sVertSec,
        yStart: x5 + coverBase,
        spacing: sTiesVert,
        zStride: tiesZStride,
      },
      baseEdgeVert: {
        count: baseEdgeVertCount,
        length: lenBaseEdgeVert,
        zStart: zOffsetBaseTrans,
        zSpacing: sBaseTrans,
        xToe: coverBase,
        xHeel: x1 - coverBase,
        yStart: coverBase,
      },
      stemTopCap: {
        count: stemTopCapCount,
        length: lenStemTopCap,
        xCenter: (xVertFront + xEndBack) / 2,
        y: topY - coverStem,
        zStart: zOffsetVertFront,
        zSpacing: sVertSec,
      },
      wireTies: {
        count: (vertFrontCount * horizCount) + (vertBackCount * horizCount) + (baseTransCount * baseLongCount) + (baseTransCount * baseLongCount)
      },
      tiesFrontHook: {
        count: tiesTotalCount,
      },
      tiesBackHook: {
        count: tiesTotalCount,
      },
      stemTopCapLegs: {
        count: stemTopCapCount * 2,
      },
      baseEdgeHoriz: {
        count: baseEdgeVertCount * 2,
      }
    };
  }, [H, x1, x2, x3, x4, x5, L]);

  // Apply transforms inside useEffect to avoid React render path overhead
  useEffect(() => {
    const dummy = new THREE.Object3D();
    const { vertBack, vertFront, horiz, baseTrans, baseLong, hooks, ties } = cageData;

    // 1. Vertical Back Rebars
    if (instVertBackRef.current) {
      for (let i = 0; i < vertBack.count; i++) {
        dummy.position.set(
          vertBack.xStart + (Math.sin(vertBack.angle) * vertBack.length) / 2,
          vertBack.yStart + (Math.cos(vertBack.angle) * vertBack.length) / 2,
          vertBack.zStart + i * vertBack.spacing
        );
        dummy.rotation.set(0, 0, -vertBack.angle);
        dummy.scale.set(1, vertBack.length, 1);
        dummy.updateMatrix();
        instVertBackRef.current.setMatrixAt(i, dummy.matrix);
      }
      instVertBackRef.current.instanceMatrix.needsUpdate = true;
    }

    // 2. Vertical Front Rebars
    if (instVertFrontRef.current) {
      for (let i = 0; i < vertFront.count; i++) {
        dummy.position.set(
          vertFront.x,
          vertFront.yStart + vertFront.length / 2,
          vertFront.zStart + i * vertFront.spacing
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, vertFront.length, 1);
        dummy.updateMatrix();
        instVertFrontRef.current.setMatrixAt(i, dummy.matrix);
      }
      instVertFrontRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Horizontal Back Distribution Rebars
    if (instHorizBackRef.current) {
      let idx = 0;
      for (let h = 0; h < horiz.count; h++) {
        const y = horiz.yStart + h * horiz.spacing;
        const t = (y - x5) / H;
        const xBack = (x2 + x3 - coverStem) * (1 - t) + (x2 + x4 - coverStem) * t - dMain;

        dummy.position.set(xBack, y, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instHorizBackRef.current.setMatrixAt(idx++, dummy.matrix);
      }
      instHorizBackRef.current.instanceMatrix.needsUpdate = true;
    }

    // 4. Horizontal Front Distribution Rebars
    if (instHorizFrontRef.current) {
      let idx = 0;
      for (let h = 0; h < horiz.count; h++) {
        const y = horiz.yStart + h * horiz.spacing;
        dummy.position.set(horiz.frontX, y, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instHorizFrontRef.current.setMatrixAt(idx++, dummy.matrix);
      }
      instHorizFrontRef.current.instanceMatrix.needsUpdate = true;
    }

    // 5. Base Transverse Bottom
    if (instBaseTransBottomRef.current) {
      for (let i = 0; i < baseTrans.count; i++) {
        dummy.position.set(x1 / 2, baseTrans.yBottom, baseTrans.zStart + i * baseTrans.spacing);
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instBaseTransBottomRef.current.setMatrixAt(i, dummy.matrix);
      }
      instBaseTransBottomRef.current.instanceMatrix.needsUpdate = true;
    }

    // 6. Base Transverse Top
    if (instBaseTransTopRef.current) {
      for (let i = 0; i < baseTrans.count; i++) {
        dummy.position.set(x1 / 2, baseTrans.yTop, baseTrans.zStart + i * baseTrans.spacing);
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instBaseTransTopRef.current.setMatrixAt(i, dummy.matrix);
      }
      instBaseTransTopRef.current.instanceMatrix.needsUpdate = true;
    }

    // 7. Base Longitudinal Bottom
    if (instBaseLongBottomRef.current) {
      for (let i = 0; i < baseLong.count; i++) {
        dummy.position.set(baseLong.xStart + i * baseLong.spacing, baseLong.yBottom, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instBaseLongBottomRef.current.setMatrixAt(i, dummy.matrix);
      }
      instBaseLongBottomRef.current.instanceMatrix.needsUpdate = true;
    }

    // 8. Base Longitudinal Top
    if (instBaseLongTopRef.current) {
      for (let i = 0; i < baseLong.count; i++) {
        dummy.position.set(baseLong.xStart + i * baseLong.spacing, baseLong.yTop, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instBaseLongTopRef.current.setMatrixAt(i, dummy.matrix);
      }
      instBaseLongTopRef.current.instanceMatrix.needsUpdate = true;
    }

    // 9. L-Hooks at the bottom of vertical bars
    if (instHooksRef.current) {
      let idx = 0;
      for (let i = 0; i < hooks.vertBackCount; i++) {
        dummy.position.set(
          vertBack.xStart + hooks.length / 2,
          vertBack.yStart,
          vertBack.zStart + i * vertBack.spacing
        );
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instHooksRef.current.setMatrixAt(idx++, dummy.matrix);
      }

      for (let i = 0; i < hooks.vertFrontCount; i++) {
        dummy.position.set(
          vertFront.x - hooks.length / 2,
          vertFront.yStart,
          vertFront.zStart + i * vertFront.spacing
        );
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instHooksRef.current.setMatrixAt(idx++, dummy.matrix);
      }
      instHooksRef.current.instanceMatrix.needsUpdate = true;
    }

    // 10. Stem Stirrup/Tie Rebars (Çirozlar - aligned with the vertical rebars) & Hooks
    if (instTiesRef.current) {
      let idx = 0;
      for (let v = 0; v < vertFront.count; v += ties.zStride) {
        const z = ties.zStart + v * ties.zSpacing; // aligned with vertical rebars
        for (let h = 0; h < ties.vertCount; h++) {
          const y = ties.yStart + h * ties.spacing;
          const t = (y - x5) / H;
          const xVertBack = (x2 + x3 - coverStem) * (1 - t) + (x2 + x4 - coverStem) * t;
          const xBack = xVertBack - dMain;
          const xFront = vertFront.x + dMain;
          const len = Math.max(0.1, xBack - xFront);
          
          // Straight tie body
          dummy.position.set((xFront + xBack) / 2, y, z);
          dummy.rotation.set(0, 0, Math.PI / 2); // align along X axis
          dummy.scale.set(1, len, 1);
          dummy.updateMatrix();
          instTiesRef.current.setMatrixAt(idx, dummy.matrix);

          // Front Hook (180 degrees) wrapping around front vertical rebar
          if (instTiesFrontHookRef.current) {
            dummy.position.set(vertFront.x, y, z);
            dummy.rotation.set(Math.PI / 2, 0, 0); // X-Z plane, starts +X and wraps to -X
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            instTiesFrontHookRef.current.setMatrixAt(idx, dummy.matrix);
          }

          // Back Hook (135 degrees) wrapping around back vertical rebar
          if (instTiesBackHookRef.current) {
            dummy.position.set(xVertBack, y, z);
            dummy.rotation.set(Math.PI / 2, 0, Math.PI); // X-Z plane, starts -X and wraps to +X
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            instTiesBackHookRef.current.setMatrixAt(idx, dummy.matrix);
          }

          idx++;
        }
      }
      instTiesRef.current.instanceMatrix.needsUpdate = true;
      if (instTiesFrontHookRef.current) instTiesFrontHookRef.current.instanceMatrix.needsUpdate = true;
      if (instTiesBackHookRef.current) instTiesBackHookRef.current.instanceMatrix.needsUpdate = true;
    }

    // 11. Base Edge Verticals & Horizontal Return Legs (U-closures)
    if (instBaseEdgeVertRef.current) {
      let idx = 0;
      let horizIdx = 0;
      const { baseEdgeVert } = cageData;
      for (let i = 0; i < baseTrans.count; i++) {
        const z = baseEdgeVert.zStart + i * baseEdgeVert.zSpacing;
        
        // Toe side vertical
        dummy.position.set(baseEdgeVert.xToe, baseEdgeVert.yStart + baseEdgeVert.length / 2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, baseEdgeVert.length, 1);
        dummy.updateMatrix();
        instBaseEdgeVertRef.current.setMatrixAt(idx++, dummy.matrix);

        // Heel side vertical
        dummy.position.set(baseEdgeVert.xHeel, baseEdgeVert.yStart + baseEdgeVert.length / 2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, baseEdgeVert.length, 1);
        dummy.updateMatrix();
        instBaseEdgeVertRef.current.setMatrixAt(idx++, dummy.matrix);

        // Horizontal return legs (200mm length) extending inwards
        if (instBaseEdgeHorizRef.current) {
          const legLen = 0.2;
          const yBottom = baseEdgeVert.yStart;
          const yTop = baseEdgeVert.yStart + baseEdgeVert.length;

          // Toe side bottom leg (extends +X)
          dummy.position.set(baseEdgeVert.xToe + legLen / 2, yBottom, z);
          dummy.rotation.set(0, 0, Math.PI / 2);
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instBaseEdgeHorizRef.current.setMatrixAt(horizIdx++, dummy.matrix);

          // Toe side top leg (extends +X)
          dummy.position.set(baseEdgeVert.xToe + legLen / 2, yTop, z);
          dummy.rotation.set(0, 0, Math.PI / 2);
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instBaseEdgeHorizRef.current.setMatrixAt(horizIdx++, dummy.matrix);

          // Heel side bottom leg (extends -X)
          dummy.position.set(baseEdgeVert.xHeel - legLen / 2, yBottom, z);
          dummy.rotation.set(0, 0, Math.PI / 2);
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instBaseEdgeHorizRef.current.setMatrixAt(horizIdx++, dummy.matrix);

          // Heel side top leg (extends -X)
          dummy.position.set(baseEdgeVert.xHeel - legLen / 2, yTop, z);
          dummy.rotation.set(0, 0, Math.PI / 2);
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instBaseEdgeHorizRef.current.setMatrixAt(horizIdx++, dummy.matrix);
        }
      }
      instBaseEdgeVertRef.current.instanceMatrix.needsUpdate = true;
      if (instBaseEdgeHorizRef.current) instBaseEdgeHorizRef.current.instanceMatrix.needsUpdate = true;
    }

    // 12. Stem Top Caps & Legs (U-caps)
    if (instStemTopCapRef.current) {
      const { stemTopCap } = cageData;
      let legIdx = 0;
      for (let i = 0; i < stemTopCap.count; i++) {
        const z = stemTopCap.zStart + i * stemTopCap.zSpacing;

        // Straight cap body
        dummy.position.set(
          stemTopCap.xCenter,
          stemTopCap.y,
          z
        );
        dummy.rotation.set(0, 0, Math.PI / 2); // align along X axis
        dummy.scale.set(1, stemTopCap.length, 1);
        dummy.updateMatrix();
        instStemTopCapRef.current.setMatrixAt(i, dummy.matrix);

        // Vertical legs going down (300mm length)
        if (instStemTopCapLegsRef.current) {
          const legLen = 0.3;

          // Front leg
          dummy.position.set(vertFront.x, stemTopCap.y - legLen / 2, z);
          dummy.rotation.set(0, 0, 0); // vertical
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instStemTopCapLegsRef.current.setMatrixAt(legIdx++, dummy.matrix);

          // Back leg
          const xEndBack = vertFront.x + stemTopCap.length;
          dummy.position.set(xEndBack, stemTopCap.y - legLen / 2, z);
          dummy.rotation.set(0, 0, 0); // vertical
          dummy.scale.set(1, legLen, 1);
          dummy.updateMatrix();
          instStemTopCapLegsRef.current.setMatrixAt(legIdx++, dummy.matrix);
        }
      }
      instStemTopCapRef.current.instanceMatrix.needsUpdate = true;
      if (instStemTopCapLegsRef.current) instStemTopCapLegsRef.current.instanceMatrix.needsUpdate = true;
    }

    // 13. Wire Loops
    if (instWireLoopsRef.current) {
      let idx = 0;

      // Front Stem: Vertical Front x Horizontal
      for (let v = 0; v < vertFront.count; v++) {
        const z = vertFront.zStart + v * vertFront.spacing;
        for (let h = 0; h < horiz.count; h++) {
          const y = horiz.yStart + h * horiz.spacing;
          const x = (vertFront.x + horiz.frontX) / 2;

          dummy.position.set(x, y, z);
          // Rotate torus so it is diagonal to the intersection
          dummy.rotation.set(Math.PI / 4, Math.PI / 2, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireLoopsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Back Stem: Vertical Back x Horizontal
      for (let v = 0; v < vertBack.count; v++) {
        const z = vertBack.zStart + v * vertBack.spacing;
        for (let h = 0; h < horiz.count; h++) {
          const y = horiz.yStart + h * horiz.spacing;
          const t = (y - x5) / H;
          const xVert = (x2 + x3 - coverStem) * (1 - t) + (x2 + x4 - coverStem) * t - dMain;
          const x = xVert - dMain / 2;

          dummy.position.set(x, y, z);
          // Rotate torus so it is diagonal to the intersection
          dummy.rotation.set(Math.PI / 4, Math.PI / 2, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireLoopsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Base Bottom: Transverse x Longitudinal
      for (let i = 0; i < baseTrans.count; i++) {
        const z = baseTrans.zStart + i * baseTrans.spacing;
        for (let j = 0; j < baseLong.count; j++) {
          const x = baseLong.xStart + j * baseLong.spacing;
          const y = (baseTrans.yBottom + baseLong.yBottom) / 2;

          dummy.position.set(x, y, z);
          // Rotate torus so it is diagonal to the base plane
          dummy.rotation.set(Math.PI / 2, Math.PI / 4, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireLoopsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Base Top: Transverse x Longitudinal
      for (let i = 0; i < baseTrans.count; i++) {
        const z = baseTrans.zStart + i * baseTrans.spacing;
        for (let j = 0; j < baseLong.count; j++) {
          const x = baseLong.xStart + j * baseLong.spacing;
          const y = (baseTrans.yTop + baseLong.yTop) / 2;

          dummy.position.set(x, y, z);
          // Rotate torus so it is diagonal to the base plane
          dummy.rotation.set(Math.PI / 2, Math.PI / 4, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireLoopsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      instWireLoopsRef.current.instanceMatrix.needsUpdate = true;
    }

    // 14. Wire Tails (twisted ends)
    if (instWireTailsRef.current) {
      let idx = 0;

      // Front Stem
      for (let v = 0; v < vertFront.count; v++) {
        const z = vertFront.zStart + v * vertFront.spacing;
        for (let h = 0; h < horiz.count; h++) {
          const y = horiz.yStart + h * horiz.spacing;
          const x = (vertFront.x + horiz.frontX) / 2;

          // Twist tail pointing outward slightly
          dummy.position.set(x + 0.013, y + 0.005, z + 0.005);
          dummy.rotation.set(0, Math.PI / 4, Math.PI / 3);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireTailsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Back Stem
      for (let v = 0; v < vertBack.count; v++) {
        const z = vertBack.zStart + v * vertBack.spacing;
        for (let h = 0; h < horiz.count; h++) {
          const y = horiz.yStart + h * horiz.spacing;
          const t = (y - x5) / H;
          const xVert = (x2 + x3 - coverStem) * (1 - t) + (x2 + x4 - coverStem) * t - dMain;
          const x = xVert - dMain / 2;

          // Twist tail pointing outward/backwards slightly
          dummy.position.set(x - 0.013, y + 0.005, z + 0.005);
          dummy.rotation.set(0, -Math.PI / 4, -Math.PI / 3);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireTailsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Base Bottom
      for (let i = 0; i < baseTrans.count; i++) {
        const z = baseTrans.zStart + i * baseTrans.spacing;
        for (let j = 0; j < baseLong.count; j++) {
          const x = baseLong.xStart + j * baseLong.spacing;
          const y = (baseTrans.yBottom + baseLong.yBottom) / 2;

          // Twist tail pointing upward/sideways
          dummy.position.set(x + 0.005, y + 0.011, z + 0.005);
          dummy.rotation.set(Math.PI / 6, 0, Math.PI / 4);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireTailsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Base Top
      for (let i = 0; i < baseTrans.count; i++) {
        const z = baseTrans.zStart + i * baseTrans.spacing;
        for (let j = 0; j < baseLong.count; j++) {
          const x = baseLong.xStart + j * baseLong.spacing;
          const y = (baseTrans.yTop + baseLong.yTop) / 2;

          // Twist tail pointing upward/sideways
          dummy.position.set(x + 0.005, y + 0.011, z + 0.005);
          dummy.rotation.set(Math.PI / 6, 0, Math.PI / 4);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instWireTailsRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }

      instWireTailsRef.current.instanceMatrix.needsUpdate = true;
    }

  }, [cageData, H, x1, x2, x3, x4, x5, L]);

  // Cylinder Geometries shared across instances
  const geomMain = useMemo(() => new THREE.CylinderGeometry(dMain / 2, dMain / 2, 1, 6), [dMain]);
  const geomDist = useMemo(() => new THREE.CylinderGeometry(dDist / 2, dDist / 2, 1, 6), [dDist]);

  // Make geometries with correct lengths for specific instanced groups
  const geomHoriz = useMemo(() => new THREE.CylinderGeometry(dDist / 2, dDist / 2, cageData.horiz.length, 6), [dDist, cageData.horiz.length]);
  const geomBaseLong = useMemo(() => new THREE.CylinderGeometry(dBase / 2, dBase / 2, cageData.baseLong.length, 6), [dBase, cageData.baseLong.length]);
  const geomBaseTrans = useMemo(() => new THREE.CylinderGeometry(dBase / 2, dBase / 2, cageData.baseTrans.length, 6), [dBase, cageData.baseTrans.length]);
  const geomHooks = useMemo(() => new THREE.CylinderGeometry(dMain / 2, dMain / 2, cageData.hooks.length, 6), [dMain, cageData.hooks.length]);
  const geomBaseEdgeVert = useMemo(() => new THREE.CylinderGeometry(dBase / 2, dBase / 2, 1, 6), [dBase]);
  const geomStemTopCap = useMemo(() => new THREE.CylinderGeometry(dMain / 2, dMain / 2, 1, 6), [dMain]);
  const geomWireLoop = useMemo(() => new THREE.TorusGeometry(0.013, 0.0012, 6, 10), []);
  const geomWireTail = useMemo(() => new THREE.CylinderGeometry(0.001, 0.001, 0.012, 4), []);
  const geomTiesFrontHook = useMemo(() => new THREE.TorusGeometry(0.013, dDist / 2, 6, 10, Math.PI), [dDist]);
  const geomTiesBackHook = useMemo(() => new THREE.TorusGeometry(0.013, dDist / 2, 6, 10, Math.PI * 0.75), [dDist]);

  return (
    <group visible={visibleParts.rebars}>
      {/* 1. Vertical Back Main Rebars */}
      <instancedMesh
        ref={instVertBackRef}
        args={[geomMain, undefined, cageData.vertBack.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 2. Vertical Front Secondary Rebars */}
      <instancedMesh
        ref={instVertFrontRef}
        args={[geomMain, undefined, cageData.vertFront.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 3. Horizontal Back Distribution Rebars */}
      <instancedMesh
        ref={instHorizBackRef}
        args={[geomHoriz, undefined, cageData.horiz.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 4. Horizontal Front Distribution Rebars */}
      <instancedMesh
        ref={instHorizFrontRef}
        args={[geomHoriz, undefined, cageData.horiz.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 5. Base Transverse Bottom */}
      <instancedMesh
        ref={instBaseTransBottomRef}
        args={[geomBaseTrans, undefined, cageData.baseTrans.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 6. Base Transverse Top */}
      <instancedMesh
        ref={instBaseTransTopRef}
        args={[geomBaseTrans, undefined, cageData.baseTrans.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 7. Base Longitudinal Bottom */}
      <instancedMesh
        ref={instBaseLongBottomRef}
        args={[geomBaseLong, undefined, cageData.baseLong.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 8. Base Longitudinal Top */}
      <instancedMesh
        ref={instBaseLongTopRef}
        args={[geomBaseLong, undefined, cageData.baseLong.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 9. L-Hooks for anchoring */}
      <instancedMesh
        ref={instHooksRef}
        args={[geomHooks, undefined, cageData.hooks.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 10. Stem Stirrup/Tie (Çiroz) Rebars */}
      <instancedMesh
        ref={instTiesRef}
        args={[geomDist, undefined, cageData.ties.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 11. Base Edge Verticals */}
      <instancedMesh
        ref={instBaseEdgeVertRef}
        args={[geomBaseEdgeVert, undefined, cageData.baseEdgeVert.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 12. Stem Top Caps */}
      <instancedMesh
        ref={instStemTopCapRef}
        args={[geomStemTopCap, undefined, cageData.stemTopCap.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 13. Rebar Intersection Wire Loops */}
      <instancedMesh
        ref={instWireLoopsRef}
        args={[geomWireLoop, undefined, cageData.wireTies.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color="#2d3748" roughness={0.65} metalness={0.75} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 14. Rebar Intersection Wire Tails */}
      <instancedMesh
        ref={instWireTailsRef}
        args={[geomWireTail, undefined, cageData.wireTies.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color="#2d3748" roughness={0.65} metalness={0.75} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 15. Stirrup/Tie Front Hooks */}
      <instancedMesh
        ref={instTiesFrontHookRef}
        args={[geomTiesFrontHook, undefined, cageData.tiesFrontHook.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 16. Stirrup/Tie Back Hooks */}
      <instancedMesh
        ref={instTiesBackHookRef}
        args={[geomTiesBackHook, undefined, cageData.tiesBackHook.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 17. Stem Top Cap Legs */}
      <instancedMesh
        ref={instStemTopCapLegsRef}
        args={[geomMain, undefined, cageData.stemTopCapLegs.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>

      {/* 18. Base Edge Horizontal Return Legs */}
      <instancedMesh
        ref={instBaseEdgeHorizRef}
        args={[geomBaseEdgeVert, undefined, cageData.baseEdgeHoriz.count]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={REBAR_COLOR} roughness={REBAR_ROUGHNESS} metalness={REBAR_METALNESS} clippingPlanes={clippingPlanes} />
      </instancedMesh>
    </group>
  );
}
