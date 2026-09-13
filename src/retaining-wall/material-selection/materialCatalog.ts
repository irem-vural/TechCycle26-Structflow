import type {
  AdmixtureMaterialId,
  AggregateMaterialId,
  ActivatorMaterialId,
  BinderMaterialId,
  FiberMaterialId,
  MaterialCategory,
  MaterialId,
  CircularityOrigin,
} from './types';

export interface MaterialDefinition<TId extends string = MaterialId> {
  id: TId;
  label: string;
  shortLabel: string;
  category: MaterialCategory;
  defaultUnit: '%' | 'kg/m³';
  group: 'binder' | 'aggregate' | 'water' | 'admixture' | 'fiber' | 'air' | 'activator';
  circularityOrigin: CircularityOrigin;
}

export const AGGREGATE_MATERIALS: readonly MaterialDefinition<AggregateMaterialId>[] = [
  { id: 'natural_fine_aggregate', label: 'Doğal ince agrega', shortLabel: 'Doğal ince', category: 'aggregate', defaultUnit: 'kg/m³', group: 'aggregate', circularityOrigin: 'virgin' },
  { id: 'natural_coarse_aggregate', label: 'Doğal iri agrega', shortLabel: 'Doğal iri', category: 'aggregate', defaultUnit: 'kg/m³', group: 'aggregate', circularityOrigin: 'virgin' },
  { id: 'recycled_aggregate_unspecified', label: 'RCA (türü belirtilmemiş)', shortLabel: 'RCA', category: 'aggregate', defaultUnit: 'kg/m³', group: 'aggregate', circularityOrigin: 'recycled_waste' },
  { id: 'recycled_fine_aggregate', label: 'Geri dönüştürülmüş ince agrega', shortLabel: 'RCA ince', category: 'aggregate', defaultUnit: 'kg/m³', group: 'aggregate', circularityOrigin: 'recycled_waste' },
  { id: 'recycled_coarse_aggregate', label: 'Geri dönüştürülmüş iri agrega', shortLabel: 'RCA iri', category: 'aggregate', defaultUnit: 'kg/m³', group: 'aggregate', circularityOrigin: 'recycled_waste' },
] as const;

export const BINDER_MATERIALS: readonly MaterialDefinition<BinderMaterialId>[] = [
  { id: 'cement', label: 'Portland çimentosu', shortLabel: 'Çimento', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'virgin' },
  { id: 'fly_ash', label: 'Uçucu kül', shortLabel: 'Uçucu kül', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'industrial_byproduct' },
  { id: 'slag', label: 'Yüksek fırın cürufu (GGBFS)', shortLabel: 'GGBFS', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'industrial_byproduct' },
  { id: 'silica_fume', label: 'Silis dumanı', shortLabel: 'Silis dumanı', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'industrial_byproduct' },
  { id: 'metakaolin', label: 'Metakaolin', shortLabel: 'Metakaolin', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'alternative_mineral' },
  { id: 'other_binder', label: 'Kullanıcı tanımlı diğer bağlayıcı/puzolan', shortLabel: 'Diğer bağlayıcı', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'unknown' },
  { id: 'other_pozzolanic', label: 'Eski kayıt: diğer puzolan', shortLabel: 'Diğer puzolan', category: 'binder', defaultUnit: '%', group: 'binder', circularityOrigin: 'unknown' },
] as const;

export const WATER_MATERIALS: readonly MaterialDefinition<'water'>[] = [
  { id: 'water', label: 'Su', shortLabel: 'Su', category: 'water', defaultUnit: 'kg/m³', group: 'water', circularityOrigin: 'virgin' },
] as const;

export const ADMIXTURE_MATERIALS: readonly MaterialDefinition<AdmixtureMaterialId>[] = [
  { id: 'superplasticizer', label: 'Süperakışkanlaştırıcı / su azaltıcı', shortLabel: 'Süperakışkanlaştırıcı', category: 'admixture', defaultUnit: 'kg/m³', group: 'admixture', circularityOrigin: 'virgin' },
  { id: 'air_entraining', label: 'Hava sürükleyici katkı', shortLabel: 'Hava sürükleyici', category: 'admixture', defaultUnit: 'kg/m³', group: 'admixture', circularityOrigin: 'virgin' },
  { id: 'accelerator', label: 'Priz hızlandırıcı', shortLabel: 'Hızlandırıcı', category: 'admixture', defaultUnit: 'kg/m³', group: 'admixture', circularityOrigin: 'virgin' },
  { id: 'retarder', label: 'Priz geciktirici', shortLabel: 'Geciktirici', category: 'admixture', defaultUnit: 'kg/m³', group: 'admixture', circularityOrigin: 'virgin' },
  { id: 'custom_admixture', label: 'Kullanıcı tanımlı katkı', shortLabel: 'Özel katkı', category: 'admixture', defaultUnit: 'kg/m³', group: 'admixture', circularityOrigin: 'unknown' },
] as const;

export const FIBER_MATERIALS: readonly MaterialDefinition<FiberMaterialId>[] = [
  { id: 'steel_fiber', label: 'Çelik fiber', shortLabel: 'Çelik fiber', category: 'fiber', defaultUnit: 'kg/m³', group: 'fiber', circularityOrigin: 'virgin' },
  { id: 'pp_fiber', label: 'PP fiber', shortLabel: 'PP fiber', category: 'fiber', defaultUnit: 'kg/m³', group: 'fiber', circularityOrigin: 'virgin' },
  { id: 'glass_fiber', label: 'Cam fiber', shortLabel: 'Cam fiber', category: 'fiber', defaultUnit: 'kg/m³', group: 'fiber', circularityOrigin: 'virgin' },
  { id: 'other_fiber', label: 'Diğer fiber', shortLabel: 'Diğer fiber', category: 'fiber', defaultUnit: 'kg/m³', group: 'fiber', circularityOrigin: 'unknown' },
] as const;

export const ACTIVATOR_MATERIALS: readonly MaterialDefinition<ActivatorMaterialId>[] = [
  { id: 'sodium_hydroxide', label: 'Sodyum hidroksit (NaOH)', shortLabel: 'NaOH', category: 'activator', defaultUnit: 'kg/m³', group: 'activator', circularityOrigin: 'virgin' },
  { id: 'sodium_silicate', label: 'Sodyum silikat (Na₂SiO₃)', shortLabel: 'Na₂SiO₃', category: 'activator', defaultUnit: 'kg/m³', group: 'activator', circularityOrigin: 'virgin' },
  { id: 'alkali_activator', label: 'Alkali aktivatör çözeltisi', shortLabel: 'Alkali aktivatör', category: 'activator', defaultUnit: 'kg/m³', group: 'activator', circularityOrigin: 'virgin' },
  { id: 'custom_activator', label: 'Kullanıcı tanımlı aktivatör', shortLabel: 'Özel aktivatör', category: 'activator', defaultUnit: 'kg/m³', group: 'activator', circularityOrigin: 'unknown' },
] as const;

export const SLUMP_CLASSES = ['S1', 'S2', 'S3', 'S4', 'S5'] as const;

export const ALL_MATERIAL_DEFINITIONS = [
  ...BINDER_MATERIALS,
  ...AGGREGATE_MATERIALS,
  ...WATER_MATERIALS,
  ...ADMIXTURE_MATERIALS,
  ...FIBER_MATERIALS,
  ...ACTIVATOR_MATERIALS,
];

export function materialLabel(id: string): string {
  return ALL_MATERIAL_DEFINITIONS.find((item) => item.id === id)?.label ?? id;
}

export function materialDefinition(id: string): MaterialDefinition | undefined {
  return ALL_MATERIAL_DEFINITIONS.find((item) => item.id === id);
}

export function resolveCircularityOrigin(
  material: Pick<import('./types').MaterialInput, 'id' | 'circularityOrigin'>,
): CircularityOrigin {
  return material.circularityOrigin ?? materialDefinition(material.id)?.circularityOrigin ?? 'unknown';
}
