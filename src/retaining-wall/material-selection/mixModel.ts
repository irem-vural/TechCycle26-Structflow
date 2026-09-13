import { ALL_MATERIAL_DEFINITIONS, materialDefinition, materialLabel } from './materialCatalog';
import {
  getStructFlowReferenceConcreteProfile,
  STRUCTFLOW_REFERENCE_PROFILE_NOTE,
} from './referenceConcreteProfiles';
import { normalizeMaterialQuantity, type MaterialQuantityUnit } from './units';
import type { ConcreteClass } from '../types';
import type {
  AggregateSelection,
  BinderSelection,
  ConcreteMixDesign,
  MaterialCategory,
  MaterialInput,
  MixMetrics,
  MixValidationMessage,
  VrConcreteMixPayload,
  VrMaterialSelection,
} from './types';

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const BINDER_IDS = new Set(['cement', 'fly_ash', 'slag', 'silica_fume', 'metakaolin', 'other_binder', 'other_pozzolanic']);
const AGGREGATE_IDS = new Set([
  'natural_fine_aggregate',
  'natural_coarse_aggregate',
  'recycled_aggregate_unspecified',
  'recycled_fine_aggregate',
  'recycled_coarse_aggregate',
  'custom_aggregate',
]);
const NATURAL_AGGREGATE_IDS = new Set(['natural_fine_aggregate', 'natural_coarse_aggregate']);
const RECYCLED_IDS = new Set(['recycled_aggregate_unspecified', 'recycled_fine_aggregate', 'recycled_coarse_aggregate']);
const WATER_BINDER_REVIEW_MIN = 0.30;
const WATER_BINDER_REVIEW_MAX = 0.70;
const MAX_REVIEW_AIR_CONTENT_PERCENT = 15;
const MAX_REVIEW_COMPRESSIVE_STRENGTH_MPA = 300;

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inferredRecipeMode(source: Partial<ConcreteMixDesign>): NonNullable<ConcreteMixDesign['recipeMode']> {
  // Kimlik, eski proje dosyalarinda recipeMode alanindan daha guvenilir olabilir.
  // Ozellikle daha once elle duzenlenmis bir karisim `custom-*` kimligi tasirken
  // stale `recipeMode: default` ile kaydedilmis olabilir. Normalizasyon bu
  // celiskiyi otomatik onarir ki sonuc ekranlari ve Sifir Atik ayni modu gorsun.
  if (source.id?.startsWith('custom-')) return 'custom';
  if (source.id?.startsWith('dataset-')) return 'imported';
  if (source.id === 'active-default') return source.recipeMode === 'custom' ? 'custom' : 'default';
  if (source.recipeMode) return source.recipeMode;
  if (source.name?.toLocaleLowerCase('tr-TR').includes('özel beton reçetesi')) return 'custom';
  return 'custom';
}

function amountMaterial(
  id: string,
  name: string,
  category: MaterialCategory,
  value: number,
  unit: MaterialQuantityUnit = 'kg/m³',
  enabled = value > 0,
): MaterialInput {
  return {
    id,
    name,
    category,
    enabled,
    circularityOrigin: materialDefinition(id)?.circularityOrigin ?? 'unknown',
    value,
    unit,
    basis: 'amount',
    rawValue: value,
    rawUnit: unit,
    canonicalKgPerM3: unit === 'kg/m³' ? value : null,
    percentage: null,
  };
}

function legacyToMaterials(input: Partial<ConcreteMixDesign>): MaterialInput[] {
  const materials: MaterialInput[] = [];
  for (const item of input.binders ?? []) {
    const id = item.type as string;
    materials.push({
      ...amountMaterial(id, materialLabel(id), 'binder', finite(item.amountKgM3) ?? 0, 'kg/m³', item.enabled),
      percentage: finite(item.percentage),
      description: item.description,
      rawValue: item.rawValue ?? item.amountKgM3,
      rawUnit: item.rawUnit ?? 'kg/m³',
      basis: item.inputBasis ?? 'amount',
      densityKgM3: item.densityKgM3,
    } as MaterialInput & { description?: string });
  }
  for (const item of input.aggregates ?? []) {
    const id = item.type as string;
    materials.push({
      ...amountMaterial(id, materialLabel(id), 'aggregate', finite(item.amountKgM3) ?? 0, 'kg/m³', item.enabled),
      percentage: finite(item.percentage),
      rawValue: item.rawValue ?? item.amountKgM3,
      rawUnit: item.rawUnit ?? 'kg/m³',
      basis: item.inputBasis ?? 'amount',
      densityKgM3: item.densityKgM3 ?? (item.specificGravity > 0 ? item.specificGravity * 1000 : null),
    });
  }
  const water = input.water;
  materials.push(amountMaterial('water', 'Su', 'water', finite(water?.amountKgM3) ?? 0, 'kg/m³', (finite(water?.amountKgM3) ?? 0) > 0));
  const superplasticizer = input.superplasticizer;
  materials.push(amountMaterial(
    'superplasticizer',
    'Süperakışkanlaştırıcı / su azaltıcı',
    'admixture',
    finite(superplasticizer?.amountKgM3) ?? 0,
    'kg/m³',
    Boolean(superplasticizer?.enabled),
  ));
  for (const item of input.admixtures ?? []) {
    materials.push({
      ...amountMaterial(item.id, item.name, 'admixture', finite(item.amountKgM3) ?? 0, 'kg/m³', item.enabled),
      rawValue: item.rawValue ?? item.amountKgM3,
      rawUnit: item.rawUnit ?? 'kg/m³',
      basis: item.inputBasis ?? 'amount',
      densityKgM3: item.densityKgM3,
    });
  }
  return materials;
}

function hasPositiveAmount(material: MaterialInput | undefined): boolean {
  if (!material?.enabled) return false;
  return (finite(material.canonicalKgPerM3) ?? finite(material.value) ?? 0) > 0;
}

function restrictAggregateMaterials(source: MaterialInput[]): MaterialInput[] {
  const unspecified = source.find((item) => item.id === 'recycled_aggregate_unspecified');
  const explicitCoarse = source.find((item) => item.id === 'recycled_coarse_aggregate');
  const migrateUnspecifiedToCoarse = hasPositiveAmount(unspecified) && !hasPositiveAmount(explicitCoarse);
  const supported = source.filter((item) => item.category !== 'aggregate' || AGGREGATE_IDS.has(item.id) || item.id.includes('-custom-'));
  if (!migrateUnspecifiedToCoarse || !unspecified) return supported;
  const migrated: MaterialInput = {
    ...unspecified,
    id: 'recycled_coarse_aggregate',
    name: 'Geri dönüştürülmüş iri agrega',
    notes: [unspecified.notes, 'Eski genel RCA alanından geri dönüştürülmüş iri agregaya taşındı.'].filter(Boolean).join(' '),
  };
  // Keep a zero legacy row for imported projects and old integrations while
  // making the explicit coarse aggregate the active calculation row.
  const compatibilityAlias: MaterialInput = {
    ...unspecified,
    enabled: true,
    value: 0,
    rawValue: 0,
    canonicalKgPerM3: 0,
    percentage: null,
  };
  // The canonical catalog already contains an explicit coarse-RCA row. Replacing
  // that row is important: appending `migrated` would create two materials with
  // the same `recycled_coarse_aggregate` id. Besides producing duplicate React
  // keys in the UI, a later edit could hit the zero compatibility row and erase
  // the migrated dosage. Keep exactly one canonical coarse-RCA row.
  let coarseInserted = false;
  const next = supported.flatMap((item) => {
    if (item.id === 'recycled_aggregate_unspecified') return [compatibilityAlias];
    if (item.id === 'recycled_coarse_aggregate') {
      if (coarseInserted) return [];
      coarseInserted = true;
      return [migrated];
    }
    return [item];
  });
  if (!coarseInserted) next.push(migrated);
  return next;
}

function baseMaterials(input: Partial<ConcreteMixDesign>): MaterialInput[] {
  const source = Array.isArray(input.materials) && input.materials.length > 0 ? input.materials : legacyToMaterials(input);
  return restrictAggregateMaterials(source);
}

function groupFor(material: MaterialInput): 'binder' | 'aggregate' | null {
  if (material.category === 'binder' || BINDER_IDS.has(material.id)) return 'binder';
  if (material.category === 'aggregate' || AGGREGATE_IDS.has(material.id)) return 'aggregate';
  return null;
}

function isBinder(material: MaterialInput): boolean {
  return material.category === 'binder' || BINDER_IDS.has(material.id);
}

function isAggregate(material: MaterialInput): boolean {
  return material.category === 'aggregate' || AGGREGATE_IDS.has(material.id);
}

function isScm(material: MaterialInput): boolean {
  return isBinder(material) && material.id !== 'cement';
}

function normalizedMaterials(
  source: MaterialInput[],
  projectConcreteVolumeM3?: number | null,
): { materials: MaterialInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const knownGroupTotals = new Map<'binder' | 'aggregate', number>();
  for (const group of ['binder', 'aggregate'] as const) {
    const known = source
      .filter((item) => item.enabled && groupFor(item) === group && item.unit !== '%' && item.unit !== 'kg/m3')
      .map((item) => normalizeMaterialQuantity(item, {
        projectConcreteVolumeM3,
        defaultDensityKgM3: item.id === 'water' ? 1000 : undefined,
      }).canonicalKgPerM3)
      .filter((value): value is number => value != null);
    const direct = source
      .filter((item) => item.enabled && groupFor(item) === group && (item.unit === '%' || item.unit === 'kg/m3' || item.unit === 'kg/m³'))
      .map((item) => item.unit === '%' ? null : normalizeMaterialQuantity(item, { projectConcreteVolumeM3 }).canonicalKgPerM3)
      .filter((value): value is number => value != null);
    const total = [...known, ...direct].reduce((sum, value) => sum + value, 0);
    if (total > 0) knownGroupTotals.set(group, total);
  }

  const materials = source.map((item) => {
    const defaultDensity = item.id === 'water' ? 1000 : undefined;
    const result = normalizeMaterialQuantity(item, {
      projectConcreteVolumeM3,
      groupTotalKgPerM3: groupFor(item) ? knownGroupTotals.get(groupFor(item) as 'binder' | 'aggregate') : null,
      defaultDensityKgM3: defaultDensity,
    });
    let canonical = item.enabled ? result.canonicalKgPerM3 : 0;
    if (canonical == null && item.enabled && finite(item.canonicalKgPerM3) != null && item.unit !== '%') {
      canonical = finite(item.canonicalKgPerM3);
    }
    if (item.enabled && result.warning) warnings.push(`${item.name}: ${result.warning}`);
    const group = groupFor(item);
    const groupTotal = group ? knownGroupTotals.get(group) ?? null : null;
    const percentage = canonical != null && groupTotal != null && groupTotal > 0 ? (canonical / groupTotal) * 100 : null;
    return {
      ...item,
      rawValue: item.rawValue ?? item.value,
      rawUnit: item.rawUnit ?? item.unit,
      canonicalKgPerM3: canonical,
      percentage,
    };
  });
  return { materials, warnings: [...new Set(warnings)] };
}

function materialById(materials: MaterialInput[], id: string): MaterialInput | undefined {
  return materials.find((item) => item.id === id);
}

function value(materials: MaterialInput[], id: string): number {
  return finite(materialById(materials, id)?.canonicalKgPerM3) ?? 0;
}

function makeLegacyAggregates(materials: MaterialInput[]): AggregateSelection[] {
  return [
    ...[
      'natural_fine_aggregate',
      'natural_coarse_aggregate',
      'recycled_fine_aggregate',
      'recycled_coarse_aggregate',
    ].map((id) => {
      const item = materialById(materials, id);
      return {
        type: id as AggregateSelection['type'],
        enabled: Boolean(item?.enabled),
        percentage: finite(item?.percentage) ?? 0,
        amountKgM3: value(materials, id),
        waterAbsorption: 0,
        specificGravity: finite(item?.densityKgM3) != null ? (item?.densityKgM3 as number) / 1000 : 0,
        grading: '',
        rawValue: item?.rawValue,
        rawUnit: item?.rawUnit,
        inputBasis: item?.basis,
        densityKgM3: item?.densityKgM3,
      };
    }),
  ];
}

function makeLegacyBinders(materials: MaterialInput[]): BinderSelection[] {
  return [
    'cement',
    'fly_ash',
    'slag',
    'silica_fume',
    'metakaolin',
    'other_binder',
    'other_pozzolanic',
  ].map((id) => {
    const item = materialById(materials, id);
    return {
      type: id as BinderSelection['type'],
      enabled: Boolean(item?.enabled),
      percentage: finite(item?.percentage) ?? 0,
      amountKgM3: value(materials, id),
      description: '',
      rawValue: item?.rawValue,
      rawUnit: item?.rawUnit,
      inputBasis: item?.basis,
      densityKgM3: item?.densityKgM3,
    };
  });
}

export interface MixNormalizationOptions {
  projectConcreteVolumeM3?: number | null;
}

function sourceVerifiedStrengthMeasurements(
  measurements: ConcreteMixDesign['compressiveStrengthMeasurements'] | undefined,
): boolean {
  const usable = (measurements ?? []).filter((measurement) => Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0);
  return usable.length > 0 && usable.every((measurement) => Boolean(
    measurement.source?.trim()
    || measurement.sourceUrl?.trim()
    || measurement.sourceRow != null,
  ));
}

/** Migrate v1 mixes and refresh the compatibility projections. */
export function normalizeConcreteMix(
  input: ConcreteMixDesign | Partial<ConcreteMixDesign>,
  options: MixNormalizationOptions = {},
): ConcreteMixDesign {
  const source = input as Partial<ConcreteMixDesign>;
  const normalized = normalizedMaterials(baseMaterials(source), options.projectConcreteVolumeM3);
  const materials = normalized.materials;
  const waterAmount = value(materials, 'water');
  const binder = materials.filter((item) => item.enabled && isBinder(item)).reduce((sum, item) => sum + (item.canonicalKgPerM3 ?? 0), 0);
  const ratio = binder > 0 ? waterAmount / binder : 0;
  const targetClass = source.targetConcreteClass ?? 'C30';
  return {
    schemaVersion: 2,
    id: source.id ?? `mix-${Date.now()}`,
    name: source.name ?? 'Aktif beton reçetesi',
    materialSystem: source.materialSystem ?? 'concrete',
    targetConcreteClass: targetClass,
    targetSlumpClass: source.targetSlumpClass ?? 'S3',
    targetStrength7DaysMpa: source.targetStrength7DaysMpa ?? 22,
    targetStrength28DaysMpa: source.targetStrength28DaysMpa ?? 30,
    targetLongTermAgeDays: source.targetLongTermAgeDays ?? 56,
    targetLongTermStrengthMpa: source.targetLongTermStrengthMpa ?? 35,
    targetAirContentPercent: source.targetAirContentPercent ?? null,
    materials,
    aggregates: makeLegacyAggregates(materials),
    binders: makeLegacyBinders(materials),
    water: {
      amountKgM3: waterAmount,
      waterBinderRatio: ratio,
      ratioMode: source.water?.ratioMode ?? 'automatic',
    },
    superplasticizer: {
      enabled: Boolean(materialById(materials, 'superplasticizer')?.enabled),
      amountKgM3: value(materials, 'superplasticizer'),
    },
    admixtures: materials
      .filter((item) => item.category === 'admixture' && item.id !== 'superplasticizer')
      .map((item) => ({ id: item.id, name: item.name, enabled: item.enabled, amountKgM3: item.canonicalKgPerM3 ?? 0, rawValue: item.rawValue, rawUnit: item.rawUnit, inputBasis: item.basis, densityKgM3: item.densityKgM3 })),
    compressiveStrengthMeasurements: source.compressiveStrengthMeasurements ?? [],
    literature: source.literature ?? null,
    prices: source.prices ?? {},
    emissionFactors: source.emissionFactors ?? {},
    // Beton proje maliyeti hazır-beton + lojistik modelinden gelir. Reçetedeki
    // mineral ikameler ayrı satın alma maliyeti üretmez.
    priceMode: 'readyMix',
    readyMixPrice: source.readyMixPrice ?? null,
    recipeMode: inferredRecipeMode(source),
    compressiveStrengthVerification: source.compressiveStrengthVerification
      ?? ((source.compressiveStrengthMeasurements?.length ?? 0) > 0
        ? (sourceVerifiedStrengthMeasurements(source.compressiveStrengthMeasurements) ? 'verified' : 'unverified')
        : 'verified'),
    referenceMixId: source.referenceMixId ?? null,
    notes: source.notes ?? (normalized.warnings.length > 0 ? normalized.warnings.join(' ') : null),
  };
}

function hasUsableStrengthMeasurement(mix: ConcreteMixDesign): boolean {
  return (mix.compressiveStrengthMeasurements ?? []).some((measurement) => (
    Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
  ));
}

function effectiveCompositionSignature(
  mix: ConcreteMixDesign,
  options: MixNormalizationOptions = {},
): string[] {
  const normalized = normalizeConcreteMix(mix, options);
  return normalized.materials
    .flatMap((item) => {
      if (!item.enabled) return [];
      const amount = finite(item.canonicalKgPerM3);
      if (amount != null && Math.abs(amount) <= 1e-9) return [];
      if (amount == null) {
        return [`${item.id}|${item.category}|unknown|${item.rawValue ?? item.value ?? ''}|${item.rawUnit ?? item.unit}`];
      }
      return [`${item.id}|${item.category}|${round(amount, 6)}`];
    })
    .sort();
}

/**
 * Compares the effective material composition only. Merely adding/enabling a
 * zero-dose row does not invalidate laboratory strength measurements.
 */
export function hasConcreteCompositionChanged(
  previousMix: ConcreteMixDesign,
  nextMix: ConcreteMixDesign,
  options: MixNormalizationOptions = {},
): boolean {
  if (previousMix.materialSystem !== nextMix.materialSystem) return true;
  const previous = effectiveCompositionSignature(previousMix, options);
  const next = effectiveCompositionSignature(nextMix, options);
  return previous.length !== next.length || previous.some((entry, index) => entry !== next[index]);
}

/**
 * Manual material editing promotes the active mix to a custom mix. The project
 * cost remains ready-mix/logistics based: SCM/pozzolan replacement dosages are
 * used for carbon accounting, not as separately purchased recipe-cost items.
 * Strength verification is invalidated only when the effective dosage
 * actually changes and there is a real strength measurement to invalidate.
 */
export function makeCustomConcreteMix(
  previousMix: ConcreteMixDesign,
  nextMix: ConcreteMixDesign,
  options: MixNormalizationOptions = {},
): ConcreteMixDesign {
  const normalized = normalizeConcreteMix(nextMix, options);
  const wasCustom = normalized.recipeMode === 'custom';
  const startedFromDefault = previousMix.recipeMode === 'default' || previousMix.id === 'active-default';
  const compositionChanged = hasConcreteCompositionChanged(previousMix, normalized, options);
  const strengthMeasurements = startedFromDefault ? [] : (normalized.compressiveStrengthMeasurements ?? []);
  const hasStrengthMeasurement = strengthMeasurements.some((measurement) => (
    Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
  ));
  const verification = hasStrengthMeasurement
    ? (compositionChanged ? 'unverified' : normalized.compressiveStrengthVerification ?? 'verified')
    : 'verified';

  return normalizeConcreteMix({
    ...normalized,
    id: wasCustom ? normalized.id : `custom-${Date.now()}`,
    name: wasCustom ? normalized.name : 'Özel beton reçetesi',
    recipeMode: 'custom',
    priceMode: 'readyMix',
    compressiveStrengthMeasurements: strengthMeasurements,
    compressiveStrengthVerification: verification,
    notes: compositionChanged && hasStrengthMeasurement
      ? 'Reçete bileşimi değişti. Kayıtlı deney sonuçları saklandı ancak yeni bileşimi doğrulamaz; yeni laboratuvar doğrulaması gerekir.'
      : startedFromDefault
        ? null
        : normalized.notes,
  }, options);
}

export function createDefaultConcreteMix(concreteClass: ConcreteClass = 'C30'): ConcreteMixDesign {
  const profile = getStructFlowReferenceConcreteProfile(concreteClass);
  const starter = profile.starterRecipe;
  const materials: MaterialInput[] = [
    amountMaterial('cement', 'Portland çimentosu', 'binder', starter.cementKgM3),
    amountMaterial('fly_ash', 'Uçucu kül', 'binder', 0, 'kg/m³', false),
    amountMaterial('slag', 'Yüksek fırın cürufu (GGBFS)', 'binder', 0, 'kg/m³', false),
    amountMaterial('silica_fume', 'Silis dumanı', 'binder', 0, 'kg/m³', false),
    amountMaterial('metakaolin', 'Metakaolin', 'binder', 0, 'kg/m³', false),
    amountMaterial('other_binder', 'Kullanıcı tanımlı diğer bağlayıcı/puzolan', 'binder', 0, 'kg/m³', false),
    amountMaterial('natural_fine_aggregate', 'Doğal ince agrega', 'aggregate', starter.fineAggregateKgM3),
    amountMaterial('natural_coarse_aggregate', 'Doğal iri agrega', 'aggregate', starter.coarseAggregateKgM3),
    amountMaterial('recycled_fine_aggregate', 'Geri dönüştürülmüş ince agrega', 'aggregate', 0, 'kg/m³', false),
    amountMaterial('recycled_coarse_aggregate', 'Geri dönüştürülmüş iri agrega', 'aggregate', 0, 'kg/m³', false),
    amountMaterial('water', 'Su', 'water', starter.waterKgM3),
    amountMaterial('superplasticizer', 'Süperakışkanlaştırıcı / su azaltıcı', 'admixture', 0, 'kg/m³', false),
    amountMaterial('air_entraining', 'Hava sürükleyici katkı', 'admixture', 0, 'kg/m³', false),
    amountMaterial('accelerator', 'Priz hızlandırıcı', 'admixture', 0, 'kg/m³', false),
    amountMaterial('retarder', 'Priz geciktirici', 'admixture', 0, 'kg/m³', false),
    amountMaterial('steel_fiber', 'Çelik fiber', 'fiber', 0, 'kg/m³', false),
    amountMaterial('pp_fiber', 'PP fiber', 'fiber', 0, 'kg/m³', false),
    amountMaterial('glass_fiber', 'Cam fiber', 'fiber', 0, 'kg/m³', false),
    amountMaterial('sodium_hydroxide', 'Sodyum hidroksit (NaOH)', 'activator', 0, 'kg/m³', false),
    amountMaterial('sodium_silicate', 'Sodyum silikat (Na₂SiO₃)', 'activator', 0, 'kg/m³', false),
    amountMaterial('alkali_activator', 'Alkali aktivatör çözeltisi', 'activator', 0, 'kg/m³', false),
  ];
  materials.push(amountMaterial('recycled_aggregate_unspecified', 'RCA (turu belirtilmemis)', 'aggregate', 0, 'kg/m3', false));
  return normalizeConcreteMix({
    schemaVersion: 2,
    id: 'active-default',
    name: `StructFlow ${concreteClass} başlangıç reçetesi`,
    materialSystem: 'concrete',
    targetConcreteClass: concreteClass,
    targetSlumpClass: 'S3',
    targetStrength7DaysMpa: profile.targetStrength7DaysMpa,
    targetStrength28DaysMpa: profile.targetStrength28DaysMpa,
    targetLongTermAgeDays: profile.targetLongTermAgeDays,
    targetLongTermStrengthMpa: profile.targetLongTermStrengthMpa,
    targetAirContentPercent: null,
    materials,
    aggregates: [],
    binders: [],
    water: { amountKgM3: starter.waterKgM3, waterBinderRatio: starter.waterKgM3 / starter.cementKgM3, ratioMode: 'automatic' },
    superplasticizer: { enabled: false, amountKgM3: 0 },
    admixtures: [],
    compressiveStrengthMeasurements: [],
    priceMode: 'readyMix',
    readyMixPrice: null,
    notes: STRUCTFLOW_REFERENCE_PROFILE_NOTE,
  });
}

/**
 * Beton sınıfı değiştiğinde StructFlow başlangıç profilini aktif reçeteye uygular.
 * Fiyat/faktör kayıtları ve sınıfa bağlı olmayan özel malzemeler korunur;
 * mevcut deney ölçümleri yeni bileşimi doğrulamadığı için geçersiz işaretlenir.
 */
export function applyConcreteClassProfile(
  mix: ConcreteMixDesign,
  concreteClass: ConcreteClass,
  options: MixNormalizationOptions = {},
): ConcreteMixDesign {
  if (mix.targetConcreteClass === concreteClass) return mix;

  const defaults = createDefaultConcreteMix(concreteClass);
  const classProfileMaterialIds = new Set(['cement', 'natural_fine_aggregate', 'natural_coarse_aggregate', 'water']);
  const defaultMaterialIds = new Set(defaults.materials.map((item) => item.id));
  const existingById = new Map(mix.materials.map((item) => [item.id, item]));
  const materials = [
    ...defaults.materials.map((item) => {
      const existing = existingById.get(item.id);
      if (existing && !classProfileMaterialIds.has(item.id)) {
        return {
          ...existing,
          price: existing.price ?? mix.prices?.[item.id] ?? null,
          emissionFactor: existing.emissionFactor ?? mix.emissionFactors?.[item.id] ?? null,
        };
      }
      return {
        ...item,
        price: existing?.price ?? mix.prices?.[item.id] ?? null,
        emissionFactor: existing?.emissionFactor ?? mix.emissionFactors?.[item.id] ?? null,
      };
    }),
    ...mix.materials.filter((item) => !defaultMaterialIds.has(item.id)),
  ];
  const hasMeasurements = hasUsableStrengthMeasurement(mix);

  return normalizeConcreteMix({
    ...defaults,
    id: mix.recipeMode === 'default' ? 'active-default' : `class-${concreteClass.toLowerCase()}-${Date.now()}`,
    name: mix.recipeMode === 'default' ? `StructFlow ${concreteClass} başlangıç reçetesi` : `${concreteClass} sınıfı beton reçetesi`,
    targetSlumpClass: mix.targetSlumpClass,
    targetAirContentPercent: mix.targetAirContentPercent,
    materials,
    prices: mix.prices ?? {},
    emissionFactors: mix.emissionFactors ?? {},
    priceMode: mix.priceMode,
    readyMixPrice: mix.readyMixPrice ?? null,
    recipeMode: mix.recipeMode ?? 'custom',
    compressiveStrengthMeasurements: mix.compressiveStrengthMeasurements ?? [],
    compressiveStrengthVerification: hasMeasurements ? 'unverified' : 'verified',
    referenceMixId: mix.referenceMixId ?? null,
    notes: hasMeasurements
      ? 'Beton sınıfı değişti ve StructFlow başlangıç profili uygulandı. Kayıtlı deney sonuçları yeni bileşimi doğrulayamaz; yeni laboratuvar doğrulaması gerekir.'
      : STRUCTFLOW_REFERENCE_PROFILE_NOTE,
  }, options);
}

export function activeMaterials(mix: ConcreteMixDesign, projectConcreteVolumeM3?: number | null): MaterialInput[] {
  return normalizeConcreteMix(mix, { projectConcreteVolumeM3 }).materials.filter((item) => item.enabled);
}

function sumCategory(materials: MaterialInput[], predicate: (item: MaterialInput) => boolean): number | null {
  const selected = materials.filter(predicate);
  if (selected.some((item) => item.canonicalKgPerM3 == null)) return null;
  return round(selected.reduce((sum, item) => sum + (item.canonicalKgPerM3 ?? 0), 0));
}

function percentage(valueToDivide: number | null | undefined, denominator: number | null | undefined): number | null {
  return valueToDivide == null || denominator == null || denominator <= 0 ? null : round(valueToDivide / denominator * 100, 3);
}

export function calculateMixMetrics(mix: ConcreteMixDesign, projectConcreteVolumeM3?: number | null): MixMetrics {
  const materialNormalization = normalizedMaterials(baseMaterials(mix), projectConcreteVolumeM3);
  const normalized = normalizeConcreteMix(mix, { projectConcreteVolumeM3 });
  const materials = normalized.materials;
  const binderItems = materials.filter((item) => item.enabled && isBinder(item));
  const aggregateItems = materials.filter((item) => item.enabled && isAggregate(item));
  const binder = sumCategory(materials, (item) => item.enabled && isBinder(item));
  const aggregate = sumCategory(materials, (item) => item.enabled && isAggregate(item));
  const natural = sumCategory(materials, (item) => item.enabled && NATURAL_AGGREGATE_IDS.has(item.id));
  const recycled = sumCategory(materials, (item) => item.enabled && RECYCLED_IDS.has(item.id));
  const scm = sumCategory(materials, (item) => item.enabled && isScm(item));
  const admixtures = sumCategory(materials, (item) => item.enabled && ['admixture', 'fiber', 'activator'].includes(item.category));
  const allMassItems = materials.filter((item) => item.enabled && item.category !== 'air');
  const freshMass = allMassItems.some((item) => item.canonicalKgPerM3 == null)
    ? null
    : round(allMassItems.reduce((sum, item) => sum + (item.canonicalKgPerM3 ?? 0), 0));
  const water = sumCategory(materials, (item) => item.enabled && item.id === 'water');
  const binderPercentages: Record<string, number | null> = {};
  for (const item of binderItems) binderPercentages[item.id] = percentage(item.canonicalKgPerM3, binder);
  const aggregatePercentages: Record<string, number | null> = {};
  for (const item of aggregateItems) aggregatePercentages[item.id] = percentage(item.canonicalKgPerM3, aggregate);
  const admixtureBinderRatios: Record<string, number | null> = {};
  for (const item of materials.filter((candidate) => candidate.enabled && candidate.category === 'admixture')) {
    admixtureBinderRatios[item.id] = percentage(item.canonicalKgPerM3, binder);
  }
  const fineNatural = sumCategory(materials, (item) => item.enabled && item.id === 'natural_fine_aggregate');
  const fineRecycled = sumCategory(materials, (item) => item.enabled && item.id === 'recycled_fine_aggregate');
  const coarseNatural = sumCategory(materials, (item) => item.enabled && item.id === 'natural_coarse_aggregate');
  const coarseRecycled = sumCategory(materials, (item) => item.enabled && item.id === 'recycled_coarse_aggregate');
  const waterBinderRatio = water == null || binder == null || binder <= 0
    ? null
    : round(water / binder, 5);
  const warnings = [...materialNormalization.warnings];
  const errors: string[] = [];
  if (binder == null) warnings.push('Toplam bağlayıcı hesaplanamıyor; bağlı malzeme miktarlarını tamamlayın.');
  if (binder === 0) errors.push('Bağlayıcı bulunmuyor.');
  if (aggregate == null) warnings.push('Toplam agrega hesaplanamıyor; yoğunluk veya proje hacmi eksik olabilir.');
  if (normalized.materialSystem === 'geopolymer' && !materials.some((item) => item.enabled && item.category === 'activator' && (item.canonicalKgPerM3 ?? 0) > 0)) {
    warnings.push('Karbon hesabı eksik: alkali aktivatör verisi bulunmuyor.');
  }
  const usableStrengthMeasurements = normalized.compressiveStrengthMeasurements.filter((measurement) => (
    Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
  ));
  const hasIncompleteStrengthMetadata = usableStrengthMeasurements.some((measurement) => (
    measurement.ageDays == null || !Boolean(measurement.source?.trim() || measurement.sourceUrl?.trim())
  ));
  if (hasIncompleteStrengthMetadata) {
    warnings.push('Dayanım ölçümünün deney yaşı veya kaynak bilgisi eksik; ölçüm doğrulanmış kabul edilmedi.');
  }
  if (normalized.compressiveStrengthVerification === 'unverified' && hasUsableStrengthMeasurement(normalized) && !hasIncompleteStrengthMetadata) {
    warnings.push('Reçete değişti; kayıtlı dayanım ölçümleri yeni bileşimi doğrulamıyor.');
  }
  if (waterBinderRatio != null && (waterBinderRatio < WATER_BINDER_REVIEW_MIN || waterBinderRatio > WATER_BINDER_REVIEW_MAX)) {
    warnings.push('Su/bağlayıcı oranı 0,30–0,70 ön kontrol aralığının dışında; karışım gözden geçirilmeli.');
  }
  if (normalized.targetAirContentPercent != null && (
    !Number.isFinite(normalized.targetAirContentPercent)
    || normalized.targetAirContentPercent < 0
    || normalized.targetAirContentPercent > 100
  )) {
    warnings.push('Hava hedefi yüzde olarak 0–100 aralığında olmalıdır.');
  } else if ((normalized.targetAirContentPercent ?? 0) > MAX_REVIEW_AIR_CONTENT_PERCENT) {
    warnings.push(`Hava hedefi %${round(normalized.targetAirContentPercent ?? 0, 2)}; yapısal beton için olağandışı yüksek görünüyor ve kaynak veri kontrol edilmelidir.`);
  }
  normalized.compressiveStrengthMeasurements.forEach((measurement) => {
    if (Number.isFinite(measurement.valueMpa) && measurement.valueMpa > MAX_REVIEW_COMPRESSIVE_STRENGTH_MPA) {
      warnings.push(`Basınç dayanımı ${round(measurement.valueMpa, 2)} MPa; kaynak/format hatası olasılığı nedeniyle kontrol edilmelidir.`);
    }
  });
  if (freshMass != null && (freshMass < 1000 || freshMass > 3000)) warnings.push('Toplam taze karışım kütlesi olağandışı; veri setini kontrol edin.');
  const coarseReplacementAmount = coarseRecycled;
  const coarseReplacementDenominator = coarseNatural == null || coarseReplacementAmount == null
    ? null
    : coarseNatural + coarseReplacementAmount;
  return {
    materials,
    totalBinderKgM3: binder,
    totalAggregateKgM3: aggregate,
    totalNaturalAggregateKgM3: natural,
    totalRecycledAggregateKgM3: recycled,
    totalScmKgM3: scm,
    totalAdmixtureKgM3: admixtures,
    totalFreshMassKgM3: freshMass,
    binderPercentages,
    aggregatePercentages,
    totalRecycledAggregatePercent: percentage(recycled, aggregate),
    recycledFineReplacementPercent: fineRecycled == null || fineRecycled <= 0
      ? null
      : percentage(fineRecycled, fineNatural == null ? null : fineNatural + fineRecycled),
    recycledCoarseReplacementPercent: percentage(coarseReplacementAmount, coarseReplacementDenominator),
    waterBinderRatio,
    admixtureBinderRatios,
    warnings: [...new Set(warnings)],
    errors,
  };
}

export type MixBalanceStatus = 'balanced' | 'review' | 'incomplete';

export interface MixBalance {
  status: MixBalanceStatus;
  label: string;
  tone: 'good' | 'warning' | 'neutral';
  totalMassKgM3: number | null;
  waterBinderRatio: number | null;
  binderSharePercent: number | null;
  waterSharePercent: number | null;
  aggregateSharePercent: number | null;
  fineAggregateSharePercent: number | null;
  coarseAggregateSharePercent: number | null;
  issues: string[];
  notes: string[];
}

/**
 * Lightweight preliminary-dose check for the recipe UI.
 * These ranges are review prompts, not a substitute for a laboratory mix design.
 */
export function evaluateMixBalance(metrics: MixMetrics): MixBalance {
  const amountForIds = (ids: string[]): number | null => {
    const selected = metrics.materials.filter(
      (item) => item.enabled && ids.includes(item.id),
    );

    if (selected.some((item) => item.canonicalKgPerM3 == null)) return null;
    return selected.reduce((sum, item) => sum + (item.canonicalKgPerM3 ?? 0), 0);
  };

  const totalMassKgM3 = metrics.totalFreshMassKgM3;
  const binderKgM3 = metrics.totalBinderKgM3;
  const waterKgM3 = amountForIds(['water']);
  const aggregateKgM3 = metrics.totalAggregateKgM3;
  const fineAggregateKgM3 = amountForIds([
    'natural_fine_aggregate',
    'recycled_fine_aggregate',
  ]);
  const coarseAggregateKgM3 = amountForIds([
    'natural_coarse_aggregate',
    'recycled_coarse_aggregate',
  ]);

  const share = (amount: number | null, total: number | null): number | null => {
    if (amount == null || total == null || total <= 0) return null;
    return (amount / total) * 100;
  };

  const waterBinderRatio = metrics.waterBinderRatio;
  const binderSharePercent = share(binderKgM3, totalMassKgM3);
  const waterSharePercent = share(waterKgM3, totalMassKgM3);
  const aggregateSharePercent = share(aggregateKgM3, totalMassKgM3);
  const fineAggregateSharePercent = share(fineAggregateKgM3, aggregateKgM3);
  const coarseAggregateSharePercent = share(coarseAggregateKgM3, aggregateKgM3);

  if (
    totalMassKgM3 == null
    || binderKgM3 == null
    || waterKgM3 == null
    || aggregateKgM3 == null
    || fineAggregateSharePercent == null
    || coarseAggregateSharePercent == null
    || waterBinderRatio == null
  ) {
    return {
      status: 'incomplete',
      label: 'Eksik dozaj verisi',
      tone: 'neutral',
      totalMassKgM3,
      waterBinderRatio,
      binderSharePercent,
      waterSharePercent,
      aggregateSharePercent,
      fineAggregateSharePercent,
      coarseAggregateSharePercent,
      issues: ['Oran kontrolü için bağlayıcı, su ve agrega miktarları eksiksiz olmalıdır.'],
      notes: [],
    };
  }

  const issues: string[] = [];
  const notes: string[] = [];

  // These are deliberately broad preliminary-design prompts for the UI.
  if (totalMassKgM3 < 2150 || totalMassKgM3 > 2550) {
    issues.push('Toplam taze beton kütlesi tipik ön dozaj aralığının dışında.');
  }
  if (binderKgM3 < 240 || binderKgM3 > 520) {
    issues.push('Bağlayıcı miktarı kontrol gerektiren bir seviyede.');
  }
  if (waterBinderRatio < 0.30 || waterBinderRatio > 0.70) {
    issues.push('Su/bağlayıcı oranı tipik ön kontrol aralığının dışında.');
  }
  if (fineAggregateSharePercent < 30 || fineAggregateSharePercent > 60) {
    issues.push('İnce agrega payı, toplam agregaya göre dengesiz görünüyor.');
  }

  if (waterBinderRatio >= 0.65 && waterBinderRatio <= 0.70) {
    notes.push('Su/bağlayıcı oranı üst sınıra yakın; kıvam ve dayanım deneyiyle doğrulanmalıdır.');
  }
  if (waterBinderRatio >= 0.30 && waterBinderRatio < 0.35) {
    notes.push('Su/bağlayıcı oranı düşük; işlenebilirlik için katkı ve deneme karışımı kontrol edilmelidir.');
  }

  return {
    status: issues.length > 0 ? 'review' : 'balanced',
    label: issues.length > 0 ? 'Kontrol gerekli' : 'Dengeli ön dozaj',
    tone: issues.length > 0 ? 'warning' : 'good',
    totalMassKgM3,
    waterBinderRatio,
    binderSharePercent,
    waterSharePercent,
    aggregateSharePercent,
    fineAggregateSharePercent,
    coarseAggregateSharePercent,
    issues,
    notes,
  };
}

export function totalAggregateAmount(mix: ConcreteMixDesign): number {
  return calculateMixMetrics(mix).totalAggregateKgM3 ?? 0;
}

export function totalBinderAmount(mix: ConcreteMixDesign): number {
  return calculateMixMetrics(mix).totalBinderKgM3 ?? 0;
}

export function totalBinderPercentage(mix: ConcreteMixDesign): number {
  const total = calculateMixMetrics(mix).binderPercentages;
  return round(Object.values(total).reduce<number>((sum, item) => sum + (item ?? 0), 0));
}

export function calculatedWaterBinderRatio(mix: ConcreteMixDesign): number {
  return calculateMixMetrics(mix).waterBinderRatio ?? 0;
}

export function effectiveWaterBinderRatio(mix: ConcreteMixDesign): number {
  return mix.water.ratioMode === 'manual' ? mix.water.waterBinderRatio : calculatedWaterBinderRatio(mix);
}

export function totalMixAmount(mix: ConcreteMixDesign): number {
  return calculateMixMetrics(mix).totalFreshMassKgM3 ?? 0;
}

export function validateConcreteMix(mix: ConcreteMixDesign, projectConcreteVolumeM3?: number | null): MixValidationMessage[] {
  const metrics = calculateMixMetrics(mix, projectConcreteVolumeM3);
  const normalized = normalizeConcreteMix(mix, { projectConcreteVolumeM3 });
  const messages: MixValidationMessage[] = [];
  const suggestedWaterBinderRatio = metrics.waterBinderRatio == null
    ? null
    : Math.min(WATER_BINDER_REVIEW_MAX, Math.max(WATER_BINDER_REVIEW_MIN, metrics.waterBinderRatio));
  const suggestedWaterKgM3 = suggestedWaterBinderRatio == null || metrics.totalBinderKgM3 == null || metrics.totalBinderKgM3 <= 0
    ? null
    : round(metrics.totalBinderKgM3 * suggestedWaterBinderRatio, 3);
  const waterFixPreview = suggestedWaterBinderRatio == null || suggestedWaterKgM3 == null
    ? ''
    : ` Oto düzeltme su dozajını ${suggestedWaterKgM3} kg/m³ yaparak w/b=${round(suggestedWaterBinderRatio, 3)} hedefler.`;
  if (metrics.errors.length > 0) messages.push(...metrics.errors.map((message) => ({ severity: 'error' as const, code: 'mix_error', message })));
  if (metrics.totalBinderKgM3 != null && metrics.totalBinderKgM3 <= 0) messages.push({ severity: 'error', code: 'binder_amount_empty', message: 'Toplam bağlayıcı miktarı sıfırdan büyük olmalıdır.' });
  if (metrics.waterBinderRatio != null && (metrics.waterBinderRatio <= 0 || metrics.waterBinderRatio > 1)) {
    messages.push({
      severity: 'warning',
      code: 'water_binder_ratio_invalid',
      message: `Su/bağlayıcı oranı ${round(metrics.waterBinderRatio, 3)}; miktarları kontrol edin. Ön kontrol aralığı 0,30–0,70'dir.${waterFixPreview}`,
      target: 'water',
      materialId: 'water',
      autoFix: 'clamp_water_binder',
    });
  } else if (metrics.waterBinderRatio != null && (metrics.waterBinderRatio < WATER_BINDER_REVIEW_MIN || metrics.waterBinderRatio > WATER_BINDER_REVIEW_MAX)) {
    messages.push({
      severity: 'warning',
      code: 'water_binder_ratio_review',
      message: `Su/bağlayıcı oranı ${round(metrics.waterBinderRatio, 3)}; 0,30–0,70 ön kontrol aralığının dışında. Bu bir tasarım reddi değil, reçete inceleme uyarısıdır.${waterFixPreview}`,
      target: 'water',
      materialId: 'water',
      autoFix: 'clamp_water_binder',
    });
  }

  if (normalized.targetAirContentPercent != null && (
    !Number.isFinite(normalized.targetAirContentPercent)
    || normalized.targetAirContentPercent < 0
    || normalized.targetAirContentPercent > 100
  )) {
    messages.push({
      severity: 'warning',
      code: 'air_target_invalid',
      message: 'Hava hedefi geçerli bir yüzde değil. Kaynak değeri kontrol edin; Excel tarih/seri numarası gibi bozuk bir değer olabilir.',
      target: 'air_target',
      autoFix: 'clear_air_target',
    });
  } else if ((normalized.targetAirContentPercent ?? 0) > MAX_REVIEW_AIR_CONTENT_PERCENT) {
    messages.push({
      severity: 'warning',
      code: 'air_target_review',
      message: `Hava hedefi %${round(normalized.targetAirContentPercent ?? 0, 2)}; yapısal beton için olağandışı yüksek görünüyor. Kaynağı doğrulamadan hesap varsayımı olarak kullanmayın.`,
      target: 'air_target',
    });
  }

  normalized.compressiveStrengthMeasurements.forEach((measurement, measurementIndex) => {
    if (Number.isFinite(measurement.valueMpa) && measurement.valueMpa > MAX_REVIEW_COMPRESSIVE_STRENGTH_MPA) {
      messages.push({
        severity: 'warning',
        code: 'strength_outlier',
        message: `${round(measurement.valueMpa, 2)} MPa basınç dayanımı olağandışı; Excel tarih/seri numarası veya hücre biçimi hatası olabilir. Kaynağı doğrulayın.`,
        target: 'strength',
        measurementIndex,
        autoFix: 'remove_strength_outlier',
      });
    }
    if (Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0 && (
      measurement.ageDays == null || !Boolean(measurement.source?.trim() || measurement.sourceUrl?.trim())
    )) {
      const missingParts = [
        measurement.ageDays == null ? 'deney yaşı' : null,
        !Boolean(measurement.source?.trim() || measurement.sourceUrl?.trim()) ? 'kaynak bilgisi' : null,
      ].filter(Boolean).join(' ve ');
      messages.push({
        severity: 'warning',
        code: 'strength_metadata_missing',
        message: `Dayanım ölçümünde ${missingParts} eksik. Eksik bilgiyi kaynağından tamamlayın; program 28 gün veya kaynak bilgisi uydurmaz.`,
        target: 'strength',
        measurementIndex,
      });
    }
  });

  const usableMeasurements = normalized.compressiveStrengthMeasurements.filter((measurement) => Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0);
  const strengthMetadataComplete = usableMeasurements.every((measurement) => (
    measurement.ageDays != null && Boolean(measurement.source?.trim() || measurement.sourceUrl?.trim())
  ));
  if (normalized.compressiveStrengthVerification === 'unverified' && hasUsableStrengthMeasurement(normalized) && strengthMetadataComplete) {
    messages.push({
      severity: 'warning',
      code: 'strength_unverified_after_recipe_change',
      message: 'Reçete değişti; kayıtlı dayanım ölçümleri yeni bileşimi doğrulamıyor. Yeni reçeteye ait deney kaynağını girin.',
      target: 'strength',
    });
  }
  if (normalized.materialSystem === 'geopolymer' && !normalized.materials.some((item) => item.enabled && item.category === 'activator' && (item.canonicalKgPerM3 ?? 0) > 0)) {
    messages.push({
      severity: 'warning',
      code: 'geopolymer_activator_missing',
      message: 'Geopolimer reçetede alkali aktivatör verisi eksik; karbon ve maliyet toplamı tamamlanamaz. Aktivatör dozajını girin.',
      target: 'activator',
      materialId: 'alkali_activator',
    });
  }

  const handledWarnings = [
    'Su/bağlayıcı oranı 0,30–0,70',
    'Hava hedefi',
    'Basınç dayanımı',
    'Dayanım ölçümünün deney yaşı veya kaynak bilgisi eksik',
    'Reçete değişti; kayıtlı dayanım',
    'Karbon hesabı eksik: alkali aktivatör',
  ];
  for (const warning of metrics.warnings) {
    if (handledWarnings.some((prefix) => warning.startsWith(prefix))) continue;
    messages.push({ severity: 'warning', code: 'mix_warning', message: warning, target: 'materials' });
  }
  return messages;
}

/** Applies only explicit, deterministic corrections selected by the user. */
export function autoFixConcreteMixIssue(
  mix: ConcreteMixDesign,
  issue: MixValidationMessage,
  projectConcreteVolumeM3?: number | null,
): ConcreteMixDesign {
  if (issue.autoFix === 'clear_air_target') {
    return normalizeConcreteMix({ ...mix, targetAirContentPercent: null }, { projectConcreteVolumeM3 });
  }

  if (issue.autoFix === 'remove_strength_outlier' && issue.measurementIndex != null) {
    const measurements = (mix.compressiveStrengthMeasurements ?? []).filter((_, index) => index !== issue.measurementIndex);
    return normalizeConcreteMix({
      ...mix,
      compressiveStrengthMeasurements: measurements,
      compressiveStrengthVerification: measurements.length === 0 ? 'verified' : mix.compressiveStrengthVerification,
    }, { projectConcreteVolumeM3 });
  }

  if (issue.autoFix === 'clamp_water_binder') {
    const metrics = calculateMixMetrics(mix, projectConcreteVolumeM3);
    const binder = metrics.totalBinderKgM3;
    const currentRatio = metrics.waterBinderRatio;
    if (binder == null || binder <= 0 || currentRatio == null) return mix;
    const targetRatio = Math.min(WATER_BINDER_REVIEW_MAX, Math.max(WATER_BINDER_REVIEW_MIN, currentRatio));
    if (Math.abs(targetRatio - currentRatio) <= 1e-9) return mix;
    const targetWaterKgM3 = round(binder * targetRatio, 3);
    const materials = mix.materials.map((item) => item.id === 'water'
      ? {
        ...item,
        enabled: true,
        value: targetWaterKgM3,
        rawValue: targetWaterKgM3,
        unit: 'kg/m³' as const,
        rawUnit: 'kg/m³',
        basis: 'amount' as const,
        canonicalKgPerM3: targetWaterKgM3,
      }
      : item);
    return makeCustomConcreteMix(mix, { ...mix, materials }, { projectConcreteVolumeM3 });
  }

  return mix;
}

export function toVrConcreteMixPayload(mix: ConcreteMixDesign): VrConcreteMixPayload {
  const metrics = calculateMixMetrics(mix);
  const materials: VrMaterialSelection[] = metrics.materials.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    enabled: item.enabled,
    percentage: item.percentage ?? null,
    amountKgM3: item.canonicalKgPerM3 ?? null,
  }));
  return {
    schemaVersion: 2,
    targetConcreteClass: mix.targetConcreteClass,
    materials,
    waterBinderRatio: metrics.waterBinderRatio,
  };
}

export function exportConcreteMixJson(mix: ConcreteMixDesign): string {
  return JSON.stringify(toVrConcreteMixPayload(mix), null, 2);
}

export { materialDefinition, ALL_MATERIAL_DEFINITIONS };
