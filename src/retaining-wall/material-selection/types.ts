import type { ConcreteClass } from '@/retaining-wall/types';
import type { InputBasis, MaterialQuantityInput, MaterialQuantityUnit } from './units';

export type { InputBasis, MaterialQuantityInput, MaterialQuantityUnit } from './units';

export type MaterialSystem = 'concrete' | 'mortar' | 'geopolymer' | 'other';

export type MaterialCategory = 'binder' | 'aggregate' | 'water' | 'admixture' | 'fiber' | 'air' | 'activator' | 'other';

/** The declared circularity source of a material. Unknown is intentionally
 * excluded from recovered-material totals until the user supplies metadata. */
export type CircularityOrigin =
  | 'virgin'
  | 'industrial_byproduct'
  | 'recycled_waste'
  | 'secondary_material'
  | 'alternative_mineral'
  | 'unknown';

export type MaterialId = string;

export type AggregateMaterialId =
  | 'natural_fine_aggregate'
  | 'natural_coarse_aggregate'
  | 'recycled_aggregate_unspecified'
  | 'recycled_fine_aggregate'
  | 'recycled_coarse_aggregate'
  | 'lightweight_aggregate'
  | 'heavyweight_aggregate'
  | 'custom_aggregate';

export type BinderMaterialId =
  | 'cement'
  | 'fly_ash'
  | 'slag'
  | 'silica_fume'
  | 'metakaolin'
  | 'other_binder'
  | 'other_pozzolanic';

export type AdmixtureMaterialId =
  | 'superplasticizer'
  | 'air_entraining'
  | 'accelerator'
  | 'retarder'
  | 'custom_admixture';

export type FiberMaterialId = 'steel_fiber' | 'pp_fiber' | 'glass_fiber' | 'other_fiber';
export type ActivatorMaterialId = 'sodium_hydroxide' | 'sodium_silicate' | 'alkali_activator' | 'custom_activator';

export interface SourceMetadata {
  source?: string | null;
  sourceUrl?: string | null;
  sourceRow?: number | null;
  region?: string | null;
  year?: number | null;
  notes?: string | null;
}

export interface MaterialPrice extends SourceMetadata {
  value: number | null;
  unit: 'TL/kg' | 'TL/ton' | 'TL/m³' | 'TL/L' | 'TL/m3';
  currency: string;
  date?: string | null;
}

export interface EmissionFactor extends SourceMetadata {
  value: number | null;
  unit: 'kgCO₂e/kg' | 'kgCO2e/kg';
}

export interface MaterialInput extends MaterialQuantityInput, SourceMetadata {
  id: MaterialId;
  name: string;
  category: MaterialCategory;
  enabled: boolean;
  /** Optional on legacy records; undefined is treated as unknown. */
  circularityOrigin?: CircularityOrigin | null;
  /** Percentage is derived from canonical kg/m³ and never a second source of truth. */
  percentage?: number | null;
  price?: MaterialPrice | null;
  emissionFactor?: EmissionFactor | null;
}

/** Compatibility view retained for older saved projects and the VR payload. */
export interface AggregateSelection {
  type: AggregateMaterialId;
  enabled: boolean;
  percentage: number;
  amountKgM3: number;
  waterAbsorption: number;
  specificGravity: number;
  grading: string;
  rawValue?: number | string | null;
  rawUnit?: MaterialQuantityUnit | string | null;
  inputBasis?: InputBasis;
  densityKgM3?: number | null;
}

/** Compatibility view retained for older saved projects and the VR payload. */
export interface BinderSelection {
  type: BinderMaterialId;
  enabled: boolean;
  percentage: number;
  amountKgM3: number;
  description: string;
  rawValue?: number | string | null;
  rawUnit?: MaterialQuantityUnit | string | null;
  inputBasis?: InputBasis;
  densityKgM3?: number | null;
}

export interface ChemicalAdmixture {
  id: string;
  name: string;
  enabled: boolean;
  amountKgM3: number;
  rawValue?: number | string | null;
  rawUnit?: MaterialQuantityUnit | string | null;
  inputBasis?: InputBasis;
  densityKgM3?: number | null;
}

export interface CompressiveStrengthMeasurement extends SourceMetadata {
  ageDays: number | null;
  valueMpa: number;
}

export interface LiteratureInfo extends SourceMetadata {
  studyName?: string | null;
  sourceLine?: string | null;
  warnings?: string[];
}

export interface ConcreteMixDesign {
  /** 1 is the legacy amount/percentage model; 2 is the canonical material model. */
  schemaVersion: 1 | 2;
  id: string;
  name: string;
  materialSystem: MaterialSystem;
  targetConcreteClass: ConcreteClass;
  targetSlumpClass: string;
  targetStrength7DaysMpa: number | null;
  targetStrength28DaysMpa: number | null;
  targetLongTermAgeDays: 56 | 90;
  targetLongTermStrengthMpa: number | null;
  targetAirContentPercent: number | null;
  /** Canonical active recipe. All engine calculations start here. */
  materials: MaterialInput[];
  /** Legacy projections; kept to load old JSON and keep VR integrations working. */
  aggregates: AggregateSelection[];
  binders: BinderSelection[];
  water: {
    amountKgM3: number;
    waterBinderRatio: number;
    ratioMode: 'automatic' | 'manual';
  };
  superplasticizer: {
    enabled: boolean;
    amountKgM3: number;
  };
  admixtures: ChemicalAdmixture[];
  compressiveStrengthMeasurements: CompressiveStrengthMeasurement[];
  literature?: LiteratureInfo | null;
  prices?: Record<string, MaterialPrice>;
  emissionFactors?: Record<string, EmissionFactor>;
  priceMode: 'readyMix' | 'recipe';
  readyMixPrice?: MaterialPrice | null;
  /** Composition origin; price edits do not change this status. */
  recipeMode?: 'default' | 'custom' | 'imported';
  /** Measurements can remain stored but become unverified after recipe edits. */
  compressiveStrengthVerification?: 'verified' | 'unverified';
  referenceMixId?: string | null;
  notes?: string | null;
}

export interface MixMetrics {
  materials: MaterialInput[];
  totalBinderKgM3: number | null;
  totalAggregateKgM3: number | null;
  totalNaturalAggregateKgM3: number | null;
  totalRecycledAggregateKgM3: number | null;
  totalScmKgM3: number | null;
  totalAdmixtureKgM3: number | null;
  totalFreshMassKgM3: number | null;
  binderPercentages: Record<string, number | null>;
  aggregatePercentages: Record<string, number | null>;
  totalRecycledAggregatePercent: number | null;
  recycledFineReplacementPercent: number | null;
  recycledCoarseReplacementPercent: number | null;
  waterBinderRatio: number | null;
  admixtureBinderRatios: Record<string, number | null>;
  warnings: string[];
  errors: string[];
}

export interface MixValidationMessage {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** UI hint used to route the user directly to the input that needs review. */
  target?: 'air_target' | 'water' | 'strength' | 'activator' | 'materials';
  materialId?: string;
  measurementIndex?: number;
  /** Only deterministic, user-triggered corrections are exposed as auto-fixes. */
  autoFix?: 'clamp_water_binder' | 'clear_air_target' | 'remove_strength_outlier';
}

export interface VrMaterialSelection {
  id: string;
  name: string;
  category: MaterialCategory;
  enabled: boolean;
  percentage: number | null;
  amountKgM3: number | null;
}

export interface VrConcreteMixPayload {
  schemaVersion: 2;
  targetConcreteClass: ConcreteClass;
  materials: VrMaterialSelection[];
  waterBinderRatio: number | null;
}
