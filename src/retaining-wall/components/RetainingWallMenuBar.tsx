'use client';

import React from 'react';
import {
  Eye,
  EyeOff,
  Box,
  Grid3x3,
  Camera,
} from 'lucide-react';
import MenuBar, { type MenuGroup, type MenuItem } from '@/components/ui/MenuBar';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';

const RENDER_MODES: { mode: 'wireframe' | 'shaded' | 'realistic'; label: string }[] = [
  { mode: 'wireframe', label: 'Tel Kafes' },
  { mode: 'shaded', label: 'Gölgeli' },
  { mode: 'realistic', label: 'Gerçekçi' },
];

const CAMERA_VIEWS: { view: 'iso' | 'front' | 'top' | 'side'; label: string }[] = [
  { view: 'iso', label: 'İzometrik' },
  { view: 'front', label: 'Ön Görünüm' },
  { view: 'top', label: 'Üst Görünüm' },
  { view: 'side', label: 'Yan Görünüm' },
];

const VIS_PARTS: { part: 'wall' | 'soil' | 'ground' | 'excavation' | 'dimensions'; label: string }[] = [
  { part: 'wall', label: 'Duvar' },
  { part: 'soil', label: 'Zemin Dolgusu' },
  { part: 'ground', label: 'Zemin Yüzeyi' },
  { part: 'excavation', label: 'Kazı Hattı' },
  { part: 'dimensions', label: 'Boyutlar' },
];

interface Props {
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onReturnToHub?: () => void;
}

export default function RetainingWallMenuBar({ onOpen, onSave, onSaveAs, onReturnToHub }: Props) {
  const renderMode = useRetainingWallStore((s) => s.renderMode);
  const setRenderMode = useRetainingWallStore((s) => s.setRenderMode);
  const cameraView = useRetainingWallStore((s) => s.cameraView);
  const setCameraView = useRetainingWallStore((s) => s.setCameraView);
  const visibleParts = useRetainingWallStore((s) => s.visibleParts);
  const toggleVisibility = useRetainingWallStore((s) => s.toggleVisibility);

  const viewMenuItems: (MenuItem | 'separator')[] = [
    ...RENDER_MODES.map((m) => ({
      icon: m.mode === 'wireframe' ? <Grid3x3 className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />,
      label: m.label,
      active: renderMode === m.mode,
      onClick: () => setRenderMode(m.mode),
    })),
    'separator',
    ...CAMERA_VIEWS.map((c) => ({
      icon: <Camera className="h-3.5 w-3.5" />,
      label: c.label,
      active: cameraView === c.view,
      onClick: () => setCameraView(c.view),
    })),
    'separator',
    ...VIS_PARTS.map((v) => ({
      icon: visibleParts[v.part] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />,
      label: v.label,
      active: visibleParts[v.part],
      onClick: () => toggleVisibility(v.part),
    })),
  ];

  const moduleMenus: MenuGroup[] = [
    { id: 'view', label: 'Görünüm', items: viewMenuItems },
  ];

  return (
    <MenuBar
      onOpen={onOpen}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onReturnToHub={onReturnToHub}
      moduleMenus={moduleMenus}
    />
  );
}
