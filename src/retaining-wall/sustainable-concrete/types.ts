export const SUSTAINABLE_CONCRETE_SCHEMA_VERSION = 2 as const;

export const STRENGTH_AGES = [7, 28, 56, 90] as const;
export type StrengthAge = (typeof STRENGTH_AGES)[number];

export type MaterialKey =
  | 'cement'
  | 'flyAsh'
  | 'ggbfs'
  | 'silicaFume'
  | 'metakaolin'
  | 'naturalAggregate'
  | 'recycledAggregate';

export const SUSTAINABLE_MATERIAL_DEFINITIONS: ReadonlyArray<{
  key: MaterialKey;
  label: string;
  field: keyof ConcreteMixComponents;
}> = [
  { key: 'cement', label: 'Çimento', field: 'cementKgM3' },
  { key: 'flyAsh', label: 'Uçucu kül', field: 'flyAshKgM3' },
  { key: 'ggbfs', label: 'GGBFS', field: 'ggbfsKgM3' },
  { key: 'silicaFume', label: 'Silis dumanı', field: 'silicaFumeKgM3' },
  { key: 'metakaolin', label: 'Metakaolin', field: 'metakaolinKgM3' },
  { key: 'naturalAggregate', label: 'Doğal agrega', field: 'naturalAggregateKgM3' },
  { key: 'recycledAggregate', label: 'Geri dönüştürülmüş agrega', field: 'recycledAggregateKgM3' },
];

export interface StrengthValues {
  strength7DaysMpa: number | null;
  strength28DaysMpa: number | null;
  strength56DaysMpa: number | null;
  strength90DaysMpa: number | null;
}

export interface ConcreteMixComponents {
  cementKgM3: number | null;
  flyAshKgM3: number | null;
  ggbfsKgM3: number | null;
  silicaFumeKgM3: number | null;
  metakaolinKgM3: number | null;
  naturalAggregateKgM3: number | null;
  recycledAggregateKgM3: number | null;
  waterKgM3: number | null;
  /** Preserves fine/coarse information when the source provides it. */
  naturalFineAggregateKgM3?: number | null;
  naturalCoarseAggregateKgM3?: number | null;
  recycledAggregateUnspecifiedKgM3?: number | null;
  recycledFineAggregateKgM3?: number | null;
  recycledCoarseAggregateKgM3?: number | null;
  lightweightAggregateKgM3?: number | null;
  heavyweightAggregateKgM3?: number | null;
  superplasticizerKgM3?: number | null;
  airEntrainingKgM3?: number | null;
  acceleratorRetarderKgM3?: number | null;
  fiberKgM3?: number | null;
  airTargetContentPercent?: number | null;
  sodiumHydroxideKgM3?: number | null;
  sodiumSilicateKgM3?: number | null;
  alkaliActivatorKgM3?: number | null;
}

export interface RawMaterialInput {
  rawValue: string | number | null;
  rawUnit: string | null;
}

export interface SustainableConcreteMix extends ConcreteMixComponents, StrengthValues {
  id: string;
  name: string;
  mixNo?: string | null;
  materialSystem?: 'concrete' | 'mortar' | 'geopolymer' | 'other' | null;
  source?: string;
  sourceUrl?: string | null;
  literatureStudy?: string | null;
  sourceLine?: string | null;
  sourceRow?: number;
  rawValues?: Record<string, string | number | null>;
  rawInputs?: Record<string, RawMaterialInput>;
  compressiveStrengthMeasurements?: Array<{
    ageDays: number | null;
    valueMpa: number;
    source?: string | null;
    sourceUrl?: string | null;
    sourceRow?: number | null;
  }>;
}

export interface ReferenceMixComposition extends ConcreteMixComponents {
  name: string;
}

export interface EmissionFactors {
  cement: number | null;
  flyAsh: number | null;
  ggbfs: number | null;
  silicaFume: number | null;
  metakaolin: number | null;
  naturalAggregate: number | null;
  recycledAggregate: number | null;
  metadata?: Partial<Record<MaterialKey, {
    unit: string;
    source?: string | null;
    sourceUrl?: string | null;
    region?: string | null;
    year?: number | null;
    notes?: string | null;
    uncertaintyMin?: number | null;
    uncertaintyMax?: number | null;
  }>>;
}

export interface SustainableConcreteFilters {
  minStrengthMpa: number | null;
  minWasteRatePercent: number | null;
  maxCarbonKgCo2eM3: number | null;
  strengthAge: StrengthAge;
}

export type SustainableConcreteSortKey = 'strength' | 'waste' | 'carbonReduction';
export type SustainableConcreteReferenceMode = 'none' | 'selected' | 'theoretical';

export interface SustainableConcreteData {
  schemaVersion: typeof SUSTAINABLE_CONCRETE_SCHEMA_VERSION;
  mixes: SustainableConcreteMix[];
  emissionFactors: EmissionFactors;
  referenceStrengths: StrengthValues;
  filters: SustainableConcreteFilters;
  sortBy: SustainableConcreteSortKey;
  selectedMixId: string | null;
  referenceMode: SustainableConcreteReferenceMode;
  referenceMixId: string | null;
  importIssues: string[];
}
