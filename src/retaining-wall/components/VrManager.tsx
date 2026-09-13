'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Text, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useRetainingWallStore } from '../store/useRetainingWallStore';
import { STABILITY_REQUIRED_FS } from '../engine/stability';

interface VrButtonProps {
  id: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isHovered: boolean;
  registerButton: (id: string, mesh: THREE.Mesh | null, onClick: () => void) => void;
}

type XRControllerGroup = THREE.Group & {
  gamepad?: Gamepad;
  addEventListener: (type: 'selectstart', listener: (event: THREE.Event) => void) => void;
  removeEventListener: (type: 'selectstart', listener: (event: THREE.Event) => void) => void;
};
type XRSystemLike = {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string, options?: XRSessionInit) => Promise<XRSession>;
};

// Stable outer component to prevent unmounting/remounting & memory leaks
const VRButtonComponent = React.memo(({
  id,
  position,
  width = 1.2,
  height = 0.22,
  label,
  onClick,
  isActive,
  isHovered,
  registerButton,
}: VrButtonProps) => {
  const btnColor = isActive 
    ? '#10b981' // Green active
    : isHovered 
      ? '#3b82f6' // Blue hover
      : '#1e293b'; // Base gray

  return (
    <group position={position}>
      <mesh
        ref={(m) => registerButton(id, m as THREE.Mesh, onClick)}
        castShadow
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={btnColor} side={THREE.DoubleSide} transparent opacity={0.9} />
        <Edges color={isHovered ? '#ffffff' : '#334155'} />
      </mesh>

      <Text
        position={[0, 0, 0.01]}
        fontSize={0.065}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
});
VRButtonComponent.displayName = 'VRButtonComponent';

export default function VrManager({
  sceneOffset,
  setSceneOffset,
  vrScale,
  setVrScale,
}: {
  sceneOffset: [number, number, number];
  setSceneOffset: (offset: [number, number, number]) => void;
  vrScale: number;
  setVrScale: (scale: number) => void;
}) {
  const { gl, scene, camera } = useThree();
  const { wallInput, activeScenario, visibleParts, toggleVisibility } = useRetainingWallStore();
  const { H, x1, x5, Df } = wallInput.geometry;

  const [isPresenting, setIsPresenting] = useState(false);
  const [hoveredButtonId, setHoveredButtonId] = useState<string | null>(null);

  // Keep track of clickable buttons in the scene for raycasting
  const buttonsRef = useRef<Map<string, { mesh: THREE.Mesh; onClick: () => void }>>(new Map());

  // Controller states
  const controllerGroups = useRef<THREE.Group[]>([]);
  const controllerLines = useRef<THREE.Line[]>([]);

  // Keyboard WASD state tracking
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const sceneOffsetRef = useRef(sceneOffset);
  
  useEffect(() => {
    sceneOffsetRef.current = sceneOffset;
  }, [sceneOffset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        keysPressed.current[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        keysPressed.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Check XR status and add WebXR launcher event listeners
  useEffect(() => {
    if (!gl.xr) return;
    
    const onSessionStart = () => {
      setIsPresenting(true);
      const pitDepth = Math.max(Df + x5, 0.5);
      setSceneOffset([-x1 / 2, pitDepth, -5]);
      
      // Notify layout that VR has started (so it can enter windowed fullscreen)
      window.dispatchEvent(new CustomEvent('vr-session-start'));
    };
    const onSessionEnd = () => {
      setIsPresenting(false);
      setSceneOffset([0, 0, 0]); // Reset offset
      setVrScale(1);
      
      // Notify layout that VR has ended
      window.dispatchEvent(new CustomEvent('vr-session-end'));
    };

    gl.xr.addEventListener('sessionstart', onSessionStart);
    gl.xr.addEventListener('sessionend', onSessionEnd);

    // Custom event listener to request VR session from DOM toolbar
    const handleRequest = async () => {
      const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
      if (xr) {
        try {
          const isSupported = await xr.isSessionSupported('immersive-vr');
          if (!isSupported) {
            alert('Tarayıcınız veya cihazınız WebXR VR modunu desteklemiyor.');
            return;
          }

          const session = await xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor']
          });
          
          await gl.xr.setSession(session);
        } catch (error) {
          console.error('VR oturumu başlatılamadı:', error);
          alert('VR oturumu başlatılırken hata oluştu: ' + (error as Error).message);
        }
      } else {
        alert('WebXR bu tarayıcıda veya HTTPS bağlantısında mevcut değil. Lütfen HTTPS veya localhost bağlantısı kullanın.');
      }
    };

    window.addEventListener('request-vr-session', handleRequest);

    return () => {
      gl.xr.removeEventListener('sessionstart', onSessionStart);
      gl.xr.removeEventListener('sessionend', onSessionEnd);
      window.removeEventListener('request-vr-session', handleRequest);
    };
  }, [Df, x1, x5, gl, setSceneOffset, setVrScale]);

  // Set up VR controllers and select events
  useEffect(() => {
    const controllers: THREE.Group[] = [];
    const lines: THREE.Line[] = [];

    const handleSelectStart = (event: THREE.Event) => {
      const controller = event.target;
      if (!(controller instanceof THREE.Group)) return;
      const controllerWithGamepad = controller as XRControllerGroup;
      const raycaster = new THREE.Raycaster();
      const tempMatrix = new THREE.Matrix4();
      
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const buttonMeshes = Array.from(buttonsRef.current.values()).map(b => b.mesh);
      const intersects = raycaster.intersectObjects(buttonMeshes);
      
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        // Find matching action
        buttonsRef.current.forEach((val) => {
          if (val.mesh === hitMesh) {
            val.onClick();
            // Subtle click sound or haptic feedback if supported
            if (controllerWithGamepad.gamepad?.hapticActuators) {
              const actuator = controllerWithGamepad.gamepad.hapticActuators[0];
              if (actuator) actuator.pulse(0.8, 100);
            }
          }
        });
      }
    };

    for (let i = 0; i < 2; i++) {
      const controller = gl.xr.getController(i);
      const xrController = controller as XRControllerGroup;
      xrController.addEventListener('selectstart', handleSelectStart);
      scene.add(controller);
      controllers.push(controller);

      // Create a visual pointer line
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -10),
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color('#3b82f6'), // Laser blue
        transparent: true,
        opacity: 0.8,
        linewidth: 2,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      controller.add(line);
      lines.push(line);
    }

    controllerGroups.current = controllers;
    controllerLines.current = lines;

    return () => {
      controllers.forEach((c) => {
        const xrController = c as XRControllerGroup;
        xrController.removeEventListener('selectstart', handleSelectStart);
        scene.remove(c);
      });
    };
  }, [gl, scene]);

  // Frame loop for WASD movement and pointer hover check
  useFrame((state, delta) => {
    if (!isPresenting) return;

    // ── WASD Keyboard Movement ──
    const moveSpeed = 3.0 * delta; // 3 meters per second
    const moveVec = new THREE.Vector3();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Lock movement horizontally on the floor
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).negate().normalize();
    right.y = 0;
    right.normalize();

    if (keysPressed.current['w']) moveVec.add(forward);
    if (keysPressed.current['s']) moveVec.sub(forward);
    if (keysPressed.current['d']) moveVec.add(right);
    if (keysPressed.current['a']) moveVec.sub(right);

    if (moveVec.lengthSq() > 0) {
      moveVec.normalize().multiplyScalar(moveSpeed);
      const current = sceneOffsetRef.current;
      setSceneOffset([
        current[0] - moveVec.x,
        current[1] - moveVec.y,
        current[2] - moveVec.z,
      ]);
    }

    // ── Pointer Hover Checking ──
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    let currentHovered: string | null = null;

    controllerGroups.current.forEach((controller) => {
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const buttonMeshes = Array.from(buttonsRef.current.values()).map(b => b.mesh);
      const intersects = raycaster.intersectObjects(buttonMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        buttonsRef.current.forEach((val, id) => {
          if (val.mesh === hitMesh) {
            currentHovered = id;
          }
        });
      }
    });

    if (currentHovered !== hoveredButtonId) {
      setHoveredButtonId(currentHovered);
    }
  });

  // Teleportation offsets
  const teleportToBase = () => {
    // Standing at the base of the excavation pit looking at the wall center
    setSceneOffset([0, 0, 0]);
  };

  const teleportToTop = () => {
    // Teleport on top of the wall stem looking down
    setSceneOffset([-x1 / 2, -(x5 + H) + 1.6, 2]);
  };

  const teleportToHeel = () => {
    // Stand behind the wall on the backfill looking at the stem
    setSceneOffset([-x1 + 1, -x5 + 1.6, -2]);
  };

  // Click handler wrapper to save refs
  const registerButton = (id: string, mesh: THREE.Mesh | null, onClick: () => void) => {
    if (mesh) {
      buttonsRef.current.set(id, { mesh, onClick });
    } else {
      buttonsRef.current.delete(id);
    }
  };

  // Format quantities & safety factors
  const metrics = useMemo(() => {
    if (!activeScenario) return {
      fsSliding: STABILITY_REQUIRED_FS.sliding.toFixed(2),
      fsSlidingLimit: STABILITY_REQUIRED_FS.sliding.toFixed(2),
      fsOverturning: STABILITY_REQUIRED_FS.overturning.toFixed(2),
      fsBearing: STABILITY_REQUIRED_FS.bearingCapacity.toFixed(2),
      statusSliding: 'safe',
      statusOverturning: 'safe',
      statusBearing: 'safe',
      concrete: '0.00',
      rebar: '0.00',
      cost: '0 ₺',
    };
    const stab = activeScenario.stability;
    const quant = activeScenario.quantities;
    const cost = activeScenario.cost;

    return {
      fsSliding: stab?.sliding.factorOfSafety.toFixed(2) || '0.00',
      fsSlidingLimit: stab?.sliding.requiredFS.toFixed(2) || STABILITY_REQUIRED_FS.sliding.toFixed(2),
      fsOverturning: stab?.overturning.factorOfSafety.toFixed(2) || '0.00',
      fsBearing: stab?.bearingCapacity.factorOfSafety.toFixed(2) || '0.00',
      statusSliding: stab?.sliding.status || 'safe',
      statusOverturning: stab?.overturning.status || 'safe',
      statusBearing: stab?.bearingCapacity.status || 'safe',
      concrete: quant?.concreteVolume.toFixed(1) || '0.0',
      rebar: quant?.reinforcementWeight.toFixed(2) || '0.00',
      cost: cost?.totalCost == null ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(cost.totalCost),
    };
  }, [activeScenario]);

  // Hologram backing layout
  const panelMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.05,
    clearcoat: 1,
    side: THREE.DoubleSide,
  }), []);

  // Only render panels during active VR session to prevent desktop canvas crash/clutter
  if (!isPresenting) return null;

  // Placing holographic panels slightly to the sides of the retaining wall.
  // Wall center is around [x1/2, 0, 0].
  const panelX = -2;
  const panelY = H / 2;
  const panelZ = 2.5;

  return (
    <group>
      {/* Hologram Panel 1: VR CONTROLS */}
      <group position={[panelX, panelY, panelZ]} rotation={[0, Math.PI / 6, 0]}>
        {/* Glass panel background */}
        <mesh material={panelMaterial} castShadow>
          <planeGeometry args={[1.8, 2.2]} />
        </mesh>
        
        {/* Panel outline */}
        <mesh position={[0, 0, 0.002]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.8, 2.2)]} />
          <lineBasicMaterial color="#3b82f6" opacity={0.6} transparent />
        </mesh>

        {/* Panel Title */}
        <Text
          position={[0, 0.95, 0.02]}
          fontSize={0.11}
          color="#60a5fa"
          fontWeight="bold"
          anchorX="center"
        >
          VR KONTROL
        </Text>


        {/* Dynamic Buttons */}
        <VRButtonComponent
          id="btn_transparent"
          position={[0, 0.75, 0.02]}
          label={visibleParts.concreteTransparent ? 'Beton: SAYDAM' : 'Beton: OPAK'}
          onClick={() => toggleVisibility('concreteTransparent')}
          isActive={visibleParts.concreteTransparent}
          isHovered={hoveredButtonId === 'btn_transparent'}
          registerButton={registerButton}
        />

        <VRButtonComponent
          id="btn_rebars"
          position={[0, 0.50, 0.02]}
          label={visibleParts.rebars ? 'Donatılar: AÇIK' : 'Donatılar: KAPALI'}
          onClick={() => toggleVisibility('rebars')}
          isActive={visibleParts.rebars}
          isHovered={hoveredButtonId === 'btn_rebars'}
          registerButton={registerButton}
        />

        <VRButtonComponent
          id="btn_soil"
          position={[0, 0.25, 0.02]}
          label={visibleParts.soil ? 'Zemin/Dolgu: AÇIK' : 'Zemin/Dolgu: KAPALI'}
          onClick={() => {
            toggleVisibility('soil');
            toggleVisibility('ground');
            toggleVisibility('excavation');
          }}
          isActive={visibleParts.soil}
          isHovered={hoveredButtonId === 'btn_soil'}
          registerButton={registerButton}
        />

        <VRButtonComponent
          id="btn_dimensions"
          position={[0, 0.00, 0.02]}
          label={visibleParts.dimensions ? 'Ölçüler: AÇIK' : 'Ölçüler: KAPALI'}
          onClick={() => toggleVisibility('dimensions')}
          isActive={visibleParts.dimensions}
          isHovered={hoveredButtonId === 'btn_dimensions'}
          registerButton={registerButton}
        />

        {/* VR Scale toggle */}
        <VRButtonComponent
          id="btn_scale"
          position={[0, -0.25, 0.02]}
          label={vrScale === 1 ? 'Ölçek: 1:1 GERÇEK' : 'Ölçek: 1:10 MODEL'}
          onClick={() => setVrScale(vrScale === 1 ? 0.1 : 1)}
          isActive={vrScale === 1}
          isHovered={hoveredButtonId === 'btn_scale'}
          registerButton={registerButton}
        />

        {/* Teleport nodes */}
        <Text
          position={[0, -0.43, 0.02]}
          fontSize={0.065}
          color="#94a3b8"
          anchorX="center"
        >
          --- IŞINLANMA NOKTALARI ---
        </Text>

        <VRButtonComponent
          id="btn_tele_base"
          position={[0, -0.55, 0.02]}
          width={1.4}
          label="Temel Taban Gözlemi"
          onClick={teleportToBase}
          isHovered={hoveredButtonId === 'btn_tele_base'}
          registerButton={registerButton}
        />

        <VRButtonComponent
          id="btn_tele_top"
          position={[0, -0.75, 0.02]}
          width={1.4}
          label="Duvar Üstü Gözlemi"
          onClick={teleportToTop}
          isHovered={hoveredButtonId === 'btn_tele_top'}
          registerButton={registerButton}
        />

        <VRButtonComponent
          id="btn_tele_heel"
          position={[0, -0.95, 0.02]}
          width={1.4}
          label="Duvar Arkası Gözlemi"
          onClick={teleportToHeel}
          isHovered={hoveredButtonId === 'btn_tele_heel'}
          registerButton={registerButton}
        />
      </group>

      {/* Hologram Panel 2: CALCULATION HUD DASHBOARD */}
      <group position={[x1 + panelX + 3.5, panelY, panelZ]} rotation={[0, -Math.PI / 6, 0]}>
        {/* Glass panel background */}
        <mesh material={panelMaterial} castShadow>
          <planeGeometry args={[2.0, 2.2]} />
        </mesh>
        
        {/* Panel outline */}
        <mesh position={[0, 0, 0.002]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(2.0, 2.2)]} />
          <lineBasicMaterial color="#10b981" opacity={0.6} transparent />
        </mesh>

        {/* Panel Title */}
        <Text
          position={[0, 0.95, 0.02]}
          fontSize={0.11}
          color="#34d399"
          fontWeight="bold"
          anchorX="center"
        >
          ANALİZ & METRAJ
        </Text>

        {/* Quantities */}
        <group position={[-0.8, 0.6, 0.02]}>
          <Text fontSize={0.075} color="#94a3b8" anchorX="left">Beton Hacmi:</Text>
          <Text fontSize={0.08} color="#ffffff" anchorX="left" position={[0, -0.09, 0]}>{metrics.concrete} m³</Text>
        </group>

        <group position={[0.1, 0.6, 0.02]}>
          <Text fontSize={0.075} color="#94a3b8" anchorX="left">Donatı Ağırlığı:</Text>
          <Text fontSize={0.08} color="#ffffff" anchorX="left" position={[0, -0.09, 0]}>{metrics.rebar} ton</Text>
        </group>

        <group position={[-0.8, 0.35, 0.02]}>
          <Text fontSize={0.075} color="#94a3b8" anchorX="left">Proje Yaklaşık Maliyeti:</Text>
          <Text fontSize={0.09} color="#fbbf24" fontWeight="bold" anchorX="left" position={[0, -0.09, 0]}>{metrics.cost}</Text>
        </group>

        {/* Separation Line */}
        <mesh position={[0, 0.05, 0.01]}>
          <planeGeometry args={[1.8, 0.005]} />
          <meshBasicMaterial color="#334155" />
        </mesh>

        <Text
          position={[0, -0.07, 0.02]}
          fontSize={0.08}
          color="#34d399"
          fontWeight="bold"
          anchorX="center"
        >
          STABİLİTE GÜVENLİK FAKTÖRLERİ
        </Text>

        {/* Sliding check */}
        <group position={[-0.8, -0.25, 0.02]}>
          <Text fontSize={0.07} color="#e2e8f0" anchorX="left">{`Kayma Güvenliği (F.S.sliding >= ${metrics.fsSlidingLimit}):`}</Text>
          <Text
            fontSize={0.095}
            fontWeight="bold"
            color={metrics.statusSliding === 'unsafe' ? '#ef4444' : '#10b981'}
            anchorX="left"
            position={[0, -0.09, 0]}
          >
            {metrics.fsSliding} ({metrics.statusSliding === 'unsafe' ? 'YETERSİZ' : 'GÜVENLİ'})
          </Text>
        </group>

        {/* Overturning check */}
        <group position={[-0.8, -0.5, 0.02]}>
          <Text fontSize={0.07} color="#e2e8f0" anchorX="left">{"Devrilme Güvenliği (F.S.overturning >= 1.5):"}</Text>
          <Text
            fontSize={0.095}
            fontWeight="bold"
            color={metrics.statusOverturning === 'unsafe' ? '#ef4444' : '#10b981'}
            anchorX="left"
            position={[0, -0.09, 0]}
          >
            {metrics.fsOverturning} ({metrics.statusOverturning === 'unsafe' ? 'YETERSİZ' : 'GÜVENLİ'})
          </Text>
        </group>

        {/* Bearing capacity check */}
        <group position={[-0.8, -0.75, 0.02]}>
          <Text fontSize={0.07} color="#e2e8f0" anchorX="left">{"Taşıma Gücü Güvenliği (F.S.bearing >= 3.0):"}</Text>
          <Text
            fontSize={0.095}
            fontWeight="bold"
            color={metrics.statusBearing === 'unsafe' ? '#ef4444' : '#10b981'}
            anchorX="left"
            position={[0, -0.09, 0]}
          >
            {metrics.fsBearing} ({metrics.statusBearing === 'unsafe' ? 'YETERSİZ' : 'GÜVENLİ'})
          </Text>
        </group>
      </group>
    </group>
  );
}
