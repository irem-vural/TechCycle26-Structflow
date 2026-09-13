import { create } from 'zustand';
import {
  GeometryFieldKey,
  GeometryValidationError,
  LogisticsInput,
  RetainingWallInput,
  Scenario,
  WallGeometry,
} from '@/retaining-wall/types';
import { runEngine } from '@/retaining-wall/engine';
import { calculateGeometryMetrics } from '@/retaining-wall/engine/geometry';
import {
  clampGeometryValue,
  hasBlockingErrors,
  validateGeometry,
} from '@/retaining-wall/engine/validation';
import { applyConcreteClassProfile, createDefaultConcreteMix, normalizeConcreteMix } from '@/retaining-wall/material-selection/mixModel';
import type { ConcreteMixDesign } from '@/retaining-wall/material-selection/types';
import { createDefaultSustainableConcreteData } from '@/retaining-wall/sustainable-concrete/defaults';
import type { SustainableConcreteData } from '@/retaining-wall/sustainable-concrete/types';
import { approvedRebarPriceTlPerTon } from '@/retaining-wall/coefficients/materialData';

export interface RetainingWallState {
  // Inputs
  wallInput: RetainingWallInput;
  logistics: LogisticsInput;
  customCoefficients: Map<string, number>;
  concreteMix: ConcreteMixDesign;
  sustainableConcrete: SustainableConcreteData;

  // Validation
  geometryErrors: GeometryValidationError[];

  // Output / Current Scenario
  activeScenario: Scenario | null;

  // UI State
  renderMode: 'wireframe' | 'shaded' | 'realistic';
  cameraView: 'iso' | 'front' | 'top' | 'side';
  visibleParts: {
    wall: boolean;
    soil: boolean;
    ground: boolean;
    excavation: boolean;
    dimensions: boolean;
    rebars: boolean;
    concreteTransparent: boolean;
  };
  focusedGeoField: GeometryFieldKey | null;
  selectedGeoField: GeometryFieldKey | null;
  activeInputCategory: 'geometry' | 'params' | 'logistics' | 'concrete' | 'rebar';

  // Actions
  setWallInput: (input: Partial<RetainingWallInput>) => void;
  setGeometry: (geo: Partial<WallGeometry>) => void;
  setLogistics: (logistics: Partial<LogisticsInput>) => void;
  setCoefficient: (key: string, value: number) => void;
  resetCoefficient: (key: string) => void;
  setConcreteMix: (mix: ConcreteMixDesign) => void;
  setSustainableConcreteData: (
    data: SustainableConcreteData | ((current: SustainableConcreteData) => SustainableConcreteData),
  ) => void;

  // Engine Trigger
  calculate: () => void;

  setRenderMode: (mode: 'wireframe' | 'shaded' | 'realistic') => void;
  setCameraView: (view: 'iso' | 'front' | 'top' | 'side') => void;
  toggleVisibility: (
    part: 'wall' | 'soil' | 'ground' | 'excavation' | 'dimensions' | 'rebars' | 'concreteTransparent'
  ) => void;
  setFocusedGeoField: (field: GeometryFieldKey | null) => void;
  setSelectedGeoField: (field: GeometryFieldKey | null) => void;
  setActiveInputCategory: (category: RetainingWallState['activeInputCategory']) => void;

  exportProjectData: () => {
    wallInput: RetainingWallInput;
    logistics: LogisticsInput;
    customCoefficients: Record<string, number>;
    concreteMix: ConcreteMixDesign;
    sustainableConcrete: SustainableConcreteData;
  };
  loadProjectData: (payload: {
    wallInput: RetainingWallInput;
    logistics: LogisticsInput;
    customCoefficients?: Record<string, number>;
    concreteMix?: ConcreteMixDesign | Partial<ConcreteMixDesign>;
    sustainableConcrete?: Partial<SustainableConcreteData>;
  }) => void;
}

// Varsayılan Değerler
export const DEFAULT_WALL_INPUT: RetainingWallInput = {
  geometry: {
    H: 6.0,
    x1: 4.0,
    x2: 1.0,
    x3: 0.5,
    x4: 0.3,
    x5: 0.6,
    x6: 2.5,
    Df: 0.75,
    L: 10.0,
  },
  backfillSoil: { type: 'granular', gamma: 17.5, phi: 30, c: 0, beta: 0 },
  foundationSoil: { type: 'custom', gamma: 18.5, phi: 34, c: 0, beta: 0 },
  concreteClass: 'C30',
  rebarClass: 'B420C',
  rcDesign: {
    fcMpa: 21,
    fyMpa: 400,
    shrinkageTemperatureRatio: 0.002,
  },
  reinforcement: {
    mode: 'automatic',
    customRatioKgM3: 70,
    coverMm: 70,
    preferredDiameterMm: 16,
    preferredSpacingMm: 200,
    minSpacingMm: 100,
    maxSpacingMm: 300,
  },
  surchargeLoad: 30,
  earthPressureTheory: 'coulomb',
  bearingCapacityMethod: 'terzaghi',
  wallFrictionAngle: 0, // final convention: heel-edge vertical virtual plane, δ=0
};

export const DEFAULT_LOGISTICS: LogisticsInput = {
  distancePlant: 20, // km
  distanceDump: 15, // km
  distanceRebar: 50, // km
  distanceFormwork: 30, // km - Kalıp tedarikçisi mesafesi
  distanceCrushedStone: 25, // km - Kırmaşas ocağı mesafesi (placeholder)
  dieselPrice: 42.5, // ₺/L
  dailyWorkHours: 8,
  concretePrice: 2500, // ₺/m³
  concretePricesByClass: {
    C20: 2250, C25: 2375, C30: 2500, C35: 2675, C40: 2875, C45: 3100, C50: 3350,
  },
  rebarPrice: approvedRebarPriceTlPerTon(), // ₺/ton; approved 30.76 TL/kg benchmark
  // Yeni kalemler (Türkiye ortalama referansları — kullanıcı düzenleyebilir)
  excavationUnitCost: 250, // ₺/m³
  backfillUnitCost: 180, // ₺/m³
  formworkUnitCost: 650, // ₺/m²
  rebarLaborUnitCost: 3500, // ₺/ton
  transportRatePerTonKm: 4.5, // ₺/ton·km
  overheadPercent: 15, // %
  vatPercent: 20, // %
};

export const useRetainingWallStore = create<RetainingWallState>((set, get) => ({
  wallInput: DEFAULT_WALL_INPUT,
  logistics: DEFAULT_LOGISTICS,
  customCoefficients: new Map(),
  concreteMix: createDefaultConcreteMix(DEFAULT_WALL_INPUT.concreteClass),
  sustainableConcrete: createDefaultSustainableConcreteData(),
  geometryErrors: validateGeometry(DEFAULT_WALL_INPUT.geometry),
  activeScenario: null,
  renderMode: 'realistic',
  cameraView: 'iso',
  visibleParts: {
    wall: true,
    soil: true,
    ground: true,
    excavation: true,
    dimensions: true,
    rebars: true,
    concreteTransparent: false,
  },
  focusedGeoField: null,
  selectedGeoField: null,
  activeInputCategory: 'geometry',

  setWallInput: (input) => {
    set((state) => {
      const selectedConcreteClass = input.concreteClass ?? state.wallInput.concreteClass;
      const shouldApplyConcreteProfile = selectedConcreteClass !== state.concreteMix.targetConcreteClass;
      const projectConcreteVolumeM3 = state.activeScenario?.quantities?.concreteVolume
        ?? calculateGeometryMetrics(state.wallInput.geometry).totalConcreteVolume;
      return {
        wallInput: { ...state.wallInput, ...input },
        concreteMix: shouldApplyConcreteProfile
          ? applyConcreteClassProfile(state.concreteMix, selectedConcreteClass, { projectConcreteVolumeM3 })
          : state.concreteMix,
      };
    });
    get().calculate();
  },

  setGeometry: (geo) => {
    set((state) => {
      // Değerleri clamp et (sınır aşımını otomatik önle)
      const clamped: Partial<WallGeometry> = {};
      (Object.keys(geo) as (keyof WallGeometry)[]).forEach((key) => {
        if (key === 'x6') return;
        const val = geo[key];
        if (typeof val === 'number' && Number.isFinite(val)) {
          clamped[key] = clampGeometryValue(key, val);
        }
      });
      const merged: WallGeometry = { ...state.wallInput.geometry, ...clamped };
      const derivedX6 = merged.x1 - merged.x2 - merged.x3;
      const newGeometry: WallGeometry = {
        ...merged,
        x6: Number.isFinite(derivedX6) ? derivedX6 : merged.x6,
      };
      const errors = validateGeometry(newGeometry);
      return {
        wallInput: { ...state.wallInput, geometry: newGeometry },
        geometryErrors: errors,
        activeScenario: hasBlockingErrors(errors) ? null : state.activeScenario,
      };
    });
    // Sadece kritik hatalar yoksa hesaplama yap
    const { geometryErrors } = get();
    if (!hasBlockingErrors(geometryErrors)) {
      get().calculate();
    }
  },

  setLogistics: (logistics) => {
    set((state) => ({
      logistics: { ...state.logistics, ...logistics },
    }));
    get().calculate();
  },

  setCoefficient: (key, value) => {
    set((state) => {
      const newMap = new Map(state.customCoefficients);
      newMap.set(key, value);
      return { customCoefficients: newMap };
    });
    get().calculate();
  },

  resetCoefficient: (key) => {
    set((state) => {
      const newMap = new Map(state.customCoefficients);
      newMap.delete(key);
      return { customCoefficients: newMap };
    });
    get().calculate();
  },
  setConcreteMix: (concreteMix) => {
    set((state) => ({
      // The structural selection is the source of truth. A recipe imported
      // from elsewhere must not silently switch the project to stale class metadata.
      concreteMix: normalizeConcreteMix({
        ...concreteMix,
        targetConcreteClass: state.wallInput.concreteClass,
      }, {
        projectConcreteVolumeM3: state.activeScenario?.quantities?.concreteVolume
          ?? calculateGeometryMetrics(state.wallInput.geometry).totalConcreteVolume,
      }),
    }));
    get().calculate();
  },

  setSustainableConcreteData: (data) => {
    set((state) => ({
      sustainableConcrete: typeof data === 'function' ? data(state.sustainableConcrete) : data,
    }));
  },

  calculate: () => {
    const state = get();
    if (hasBlockingErrors(state.geometryErrors)) {
      // Geçersiz geometri: eski/geçerli görünen sonucu ekranda bırakma.
      set({ activeScenario: null });
      return;
    }
    try {
      const scenario = runEngine({
        wallInput: state.wallInput,
        logistics: state.logistics,
        customCoefficients: state.customCoefficients,
        concreteMix: state.concreteMix,
        scenarioName: 'Aktif Tasarım',
      });
      set({ activeScenario: scenario });
    } catch (error) {
      console.error('Hesaplama sırasında hata oluştu:', error);
      // Geçersiz zemin/hesap kombinasyonunda önceki senaryoyu güncelmiş gibi
      // göstermemek, mühendislik sonucu için fail-closed davranıştır.
      set({ activeScenario: null });
    }
  },

  setRenderMode: (mode) => set({ renderMode: mode }),
  setCameraView: (view) => set({ cameraView: view }),
  toggleVisibility: (part) =>
    set((state) => ({
      visibleParts: { ...state.visibleParts, [part]: !state.visibleParts[part] },
    })),
  setFocusedGeoField: (field) => set({ focusedGeoField: field }),
  setSelectedGeoField: (field) => set({ selectedGeoField: field }),
  setActiveInputCategory: (activeInputCategory) => set({ activeInputCategory }),
  exportProjectData: () => {
    const state = get();
    return {
      wallInput: state.wallInput,
      logistics: state.logistics,
      customCoefficients: Object.fromEntries(state.customCoefficients.entries()),
      concreteMix: state.concreteMix,
      sustainableConcrete: state.sustainableConcrete,
    };
  },
  loadProjectData: (payload) => {
    const geometry = payload.wallInput.geometry;
    const derivedX6 = geometry.x1 - geometry.x2 - geometry.x3;
    // Rebuild the active geometry explicitly. Legacy project objects may still
    // carry x7/x8 shear-key fields; they are intentionally ignored on load.
    const normalizedGeometry: WallGeometry = {
      H: geometry.H,
      x1: geometry.x1,
      x2: geometry.x2,
      x3: geometry.x3,
      x4: geometry.x4,
      x5: geometry.x5,
      x6: Number.isFinite(derivedX6) ? derivedX6 : geometry.x6,
      Df: geometry.Df,
      L: geometry.L,
    };
    const normalizedWallInput: RetainingWallInput = {
      ...payload.wallInput,
      backfillSoil: {
        ...payload.wallInput.backfillSoil,
        beta: 0,
      },
      geometry: normalizedGeometry,
      earthPressureTheory: 'coulomb',
      bearingCapacityMethod: 'terzaghi',
      wallFrictionAngle: 0,
      rcDesign: {
        fcMpa: payload.wallInput.rcDesign?.fcMpa ?? DEFAULT_WALL_INPUT.rcDesign?.fcMpa ?? 21,
        fyMpa: payload.wallInput.rcDesign?.fyMpa ?? DEFAULT_WALL_INPUT.rcDesign?.fyMpa ?? 400,
        shrinkageTemperatureRatio: payload.wallInput.rcDesign?.shrinkageTemperatureRatio
          ?? DEFAULT_WALL_INPUT.rcDesign?.shrinkageTemperatureRatio
          ?? 0.002,
      },
      reinforcement: {
        mode: payload.wallInput.reinforcement?.mode ?? DEFAULT_WALL_INPUT.reinforcement?.mode ?? 'automatic',
        customRatioKgM3: payload.wallInput.reinforcement?.customRatioKgM3 ?? DEFAULT_WALL_INPUT.reinforcement?.customRatioKgM3 ?? 70,
        coverMm: payload.wallInput.reinforcement?.coverMm ?? DEFAULT_WALL_INPUT.reinforcement?.coverMm ?? 70,
        preferredDiameterMm: payload.wallInput.reinforcement?.preferredDiameterMm ?? DEFAULT_WALL_INPUT.reinforcement?.preferredDiameterMm ?? 16,
        preferredSpacingMm: payload.wallInput.reinforcement?.preferredSpacingMm ?? DEFAULT_WALL_INPUT.reinforcement?.preferredSpacingMm ?? 200,
        minSpacingMm: payload.wallInput.reinforcement?.minSpacingMm ?? DEFAULT_WALL_INPUT.reinforcement?.minSpacingMm ?? 100,
        maxSpacingMm: payload.wallInput.reinforcement?.maxSpacingMm ?? DEFAULT_WALL_INPUT.reinforcement?.maxSpacingMm ?? 300,
      },
    };
    const custom = new Map(Object.entries(payload.customCoefficients ?? {}));
    const concreteMix = payload.concreteMix
      ? normalizeConcreteMix({
        ...payload.concreteMix,
        targetConcreteClass: normalizedWallInput.concreteClass,
      }, { projectConcreteVolumeM3: calculateGeometryMetrics(normalizedGeometry).totalConcreteVolume })
      : createDefaultConcreteMix(normalizedWallInput.concreteClass);
    const defaultSustainableConcrete = createDefaultSustainableConcreteData();
    const persistedSustainableConcrete = payload.sustainableConcrete;
    const sustainableConcrete: SustainableConcreteData = {
      ...defaultSustainableConcrete,
      ...persistedSustainableConcrete,
      schemaVersion: 2,
      emissionFactors: {
        ...defaultSustainableConcrete.emissionFactors,
        ...(persistedSustainableConcrete?.emissionFactors ?? {}),
      },
      referenceStrengths: {
        ...defaultSustainableConcrete.referenceStrengths,
        ...(persistedSustainableConcrete?.referenceStrengths ?? {}),
      },
      filters: {
        ...defaultSustainableConcrete.filters,
        ...(persistedSustainableConcrete?.filters ?? {}),
      },
      referenceMode: persistedSustainableConcrete?.referenceMode ?? 'none',
      referenceMixId: persistedSustainableConcrete?.referenceMixId ?? null,
    };
    set({
      wallInput: normalizedWallInput,
      logistics: {
        ...DEFAULT_LOGISTICS,
        ...payload.logistics,
        concretePricesByClass: {
          ...(DEFAULT_LOGISTICS.concretePricesByClass ?? {}),
          ...(payload.logistics.concretePricesByClass ?? {}),
        },
      },
      customCoefficients: custom,
      concreteMix,
      sustainableConcrete,
      geometryErrors: validateGeometry(normalizedGeometry),
    });
    get().calculate();
  },
}));
