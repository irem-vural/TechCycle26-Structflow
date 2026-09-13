import { calculateMaterialsEmissions } from '../engine/emissions/materials';
import type { QuantityResult } from '../types';
import { calculateMixMetrics, createDefaultConcreteMix, normalizeConcreteMix } from './mixModel';
import type { ConcreteMixDesign, MaterialInput, MixMetrics } from './types';

export const TEKNOFEST_DATASET_LABEL = 'Teknofest 2026 beton karışım tablosu';

// The curated optimization rows below are sourced from studies whose selected
// compressive-strength values are reported at 28 days. The imported spreadsheet
// keeps the generic MPa column age-unknown, but these curated pairs carry the
// source-verified age explicitly so applying a recipe does not create a fake
// "unknown age" measurement.
const CURATED_MEASURED_STRENGTH_AGE_DAYS = 28 as const;

export interface OptimizationCatalogMix {
  id: string;
  name: string;
  sourceRow: number;
  materialSystem: ConcreteMixDesign['materialSystem'];
  amountsKgM3: Record<string, number>;
  measuredStrengthMpa: number;
  measuredStrengthAgeDays: number | null;
}

export interface OptimizationScenarioDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  referenceMixId: string;
  candidateMixId: string;
  focus: 'ggbfs' | 'metakaolin' | 'silica-fume' | 'hybrid-scm' | 'rca';
}

export interface MixCarbonResult {
  kgCo2eM3: number | null;
  knownKgCo2eM3: number;
  dataComplete: boolean;
  missingFactors: string[];
  missingAmounts: string[];
}

export interface OptimizationComparison {
  scenario: OptimizationScenarioDefinition;
  referenceDefinition: OptimizationCatalogMix;
  candidateDefinition: OptimizationCatalogMix;
  referenceMix: ConcreteMixDesign;
  candidateMix: ConcreteMixDesign;
  referenceMetrics: MixMetrics;
  candidateMetrics: MixMetrics;
  referenceCarbon: MixCarbonResult;
  candidateCarbon: MixCarbonResult;
  carbonSavingKgM3: number | null;
  carbonSavingPercent: number | null;
  projectCarbonSavingKg: number | null;
  cementReductionKgM3: number;
  cementReductionPercent: number | null;
  scmIncreaseKgM3: number | null;
  recycledAggregateIncreaseKgM3: number | null;
  measuredStrengthDeltaMpa: number;
  status: 'recommended' | 'tradeoff' | 'incomplete';
}

export interface ActiveReferenceComparison {
  scenario: OptimizationScenarioDefinition;
  referenceDefinition: OptimizationCatalogMix;
  matchedActiveDefinition: OptimizationCatalogMix | null;
  referenceMix: ConcreteMixDesign;
  referenceMetrics: MixMetrics;
  activeMetrics: MixMetrics;
  referenceCarbon: MixCarbonResult;
  activeCarbon: MixCarbonResult;
  carbonSavingKgM3: number | null;
  carbonSavingPercent: number | null;
  projectCarbonSavingKg: number | null;
  cementReductionKgM3: number;
  cementReductionPercent: number | null;
  scmIncreaseKgM3: number | null;
  recycledAggregateIncreaseKgM3: number | null;
  measuredStrengthMpa: number | null;
  measuredStrengthDeltaMpa: number | null;
  exactDatasetMatch: boolean;
  status: 'evidence-positive' | 'tradeoff' | 'unverified' | 'incomplete';
}

export interface SelectedConcreteComparison {
  scenario: OptimizationScenarioDefinition;
  referenceDefinition: OptimizationCatalogMix | null;
  candidateDefinition: OptimizationCatalogMix;
  referenceMix: ConcreteMixDesign;
  candidateMix: ConcreteMixDesign;
  referenceMetrics: MixMetrics;
  candidateMetrics: MixMetrics;
  referenceCarbon: MixCarbonResult;
  candidateCarbon: MixCarbonResult;
  referenceCementKgM3: number;
  candidateCementKgM3: number;
  carbonSavingKgM3: number | null;
  carbonSavingPercent: number | null;
  projectCarbonSavingKg: number | null;
  cementReductionKgM3: number;
  cementReductionPercent: number | null;
  scmIncreaseKgM3: number | null;
  recycledAggregateIncreaseKgM3: number | null;
  referenceMeasuredStrengthMpa: number | null;
  referenceMeasuredStrengthAgeDays: number | null;
  candidateMeasuredStrengthMpa: number;
  candidateMeasuredStrengthAgeDays: number | null;
  measuredStrengthDeltaMpa: number | null;
  exactDatasetMatch: boolean;
  status: 'evidence-positive' | 'tradeoff' | 'unverified' | 'incomplete';
}

const MIXES: OptimizationCatalogMix[] = [
  {
    id: 'dataset-kc40-control-row-116',
    name: 'GGBFS kontrol reçetesi',
    sourceRow: 116,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 360, natural_fine_aggregate: 868, natural_coarse_aggregate: 982, water: 163, superplasticizer: 5.8 },
    measuredStrengthMpa: 46.9,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-c50-ggbfs-row-111',
    name: '%50 GGBFS ikameli reçete',
    sourceRow: 111,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 200, slag: 200, natural_fine_aggregate: 814, natural_coarse_aggregate: 986, water: 168, superplasticizer: 5 },
    measuredStrengthMpa: 58.8,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-mix-1-row-7',
    name: 'Metakaolin kontrol reçetesi',
    sourceRow: 7,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 488, natural_fine_aggregate: 866, natural_coarse_aggregate: 897, water: 170, superplasticizer: 3.39 },
    measuredStrengthMpa: 76.9,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-mix-6-row-12',
    name: 'Metakaolin ikameli reçete',
    sourceRow: 12,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 320, metakaolin: 61, natural_fine_aggregate: 901, natural_coarse_aggregate: 931, water: 172, superplasticizer: 3.25 },
    measuredStrengthMpa: 84.4,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-control-row-13',
    name: 'Silis dumanı kontrol reçetesi',
    sourceRow: 13,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 500, natural_fine_aggregate: 967, natural_coarse_aggregate: 694, water: 175, superplasticizer: 8 },
    measuredStrengthMpa: 78.3,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-sf15-row-16',
    name: '%15 silis dumanı ikameli reçete',
    sourceRow: 16,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 425, silica_fume: 75, natural_fine_aggregate: 948, natural_coarse_aggregate: 681, water: 175, superplasticizer: 10 },
    measuredStrengthMpa: 87.6,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-cm-control-row-93',
    name: 'Hibrit SCM kontrol reçetesi',
    sourceRow: 93,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 455, natural_fine_aggregate: 693, natural_coarse_aggregate: 1179, water: 186 },
    measuredStrengthMpa: 43,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-f15-row-94',
    name: 'Uçucu kül + GGBFS ikameli reçete',
    sourceRow: 94,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 368, fly_ash: 68, slag: 19, natural_fine_aggregate: 670, natural_coarse_aggregate: 1140, water: 186 },
    measuredStrengthMpa: 51,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-nac-row-88',
    name: 'Doğal agrega kontrol reçetesi',
    sourceRow: 88,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 400, natural_fine_aggregate: 660.22, natural_coarse_aggregate: 1180, water: 173 },
    measuredStrengthMpa: 39.57,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
  {
    id: 'dataset-rac-row-89',
    name: '%30 iri RCA reçetesi',
    sourceRow: 89,
    materialSystem: 'concrete',
    amountsKgM3: { cement: 400, natural_fine_aggregate: 660.22, natural_coarse_aggregate: 826, recycled_coarse_aggregate: 354, water: 167 },
    measuredStrengthMpa: 35.59,
    measuredStrengthAgeDays: CURATED_MEASURED_STRENGTH_AGE_DAYS,
  },
];

export const OPTIMIZATION_SCENARIOS: OptimizationScenarioDefinition[] = [
  {
    id: 'ggbfs-strength-carbon',
    title: 'GGBFS ile yüksek karbon azaltımı',
    shortTitle: 'GGBFS',
    description: 'Çimentonun yarısını GGBFS ile değiştirirken tabloda ölçülmüş dayanımı artıran reçete çifti.',
    referenceMixId: 'dataset-kc40-control-row-116',
    candidateMixId: 'dataset-c50-ggbfs-row-111',
    focus: 'ggbfs',
  },
  {
    id: 'metakaolin-strength-carbon',
    title: 'Metakaolin ile çimento optimizasyonu',
    shortTitle: 'Metakaolin',
    description: 'Çimento miktarını düşürürken ölçülmüş dayanımı artıran aynı veri grubu karşılaştırması.',
    referenceMixId: 'dataset-mix-1-row-7',
    candidateMixId: 'dataset-mix-6-row-12',
    focus: 'metakaolin',
  },
  {
    id: 'silica-fume-strength-carbon',
    title: 'Silis dumanı ile dayanım kazanımı',
    shortTitle: 'Silis dumanı',
    description: '%15 silis dumanı ikamesiyle daha düşük reçete karbonu ve daha yüksek ölçülmüş dayanım.',
    referenceMixId: 'dataset-control-row-13',
    candidateMixId: 'dataset-sf15-row-16',
    focus: 'silica-fume',
  },
  {
    id: 'hybrid-scm-strength-carbon',
    title: 'Uçucu kül + GGBFS hibrit ikame',
    shortTitle: 'UK + GGBFS',
    description: 'Uçucu kül ve GGBFS birlikte kullanılarak çimento azaltımı ve ölçülmüş dayanım artışı.',
    referenceMixId: 'dataset-cm-control-row-93',
    candidateMixId: 'dataset-f15-row-94',
    focus: 'hybrid-scm',
  },
  {
    id: 'rca-circularity-tradeoff',
    title: 'İri RCA ile döngüsellik',
    shortTitle: 'İri RCA',
    description: '%30 iri RCA ikamesi karbonu düşürür; tabloda ölçülmüş dayanım düşüşü olduğu için doğrulama gerektirir.',
    referenceMixId: 'dataset-nac-row-88',
    candidateMixId: 'dataset-rac-row-89',
    focus: 'rca',
  },
];

export const DEFAULT_OPTIMIZATION_SCENARIO_ID = 'ggbfs-strength-carbon';

const MATERIAL_TOLERANCE_KG_M3 = 0.001;

function finite(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

function amount(mix: ConcreteMixDesign, materialId: string): number {
  const item = mix.materials.find((candidate) => candidate.id === materialId);
  return finite(item?.canonicalKgPerM3);
}

function percentDifference(reduction: number, reference: number): number | null {
  return reference > 0 ? reduction / reference * 100 : null;
}

function comparisonMeasurement(
  mix: ConcreteMixDesign,
  preferredAgeDays: number | null,
): { valueMpa: number; ageDays: number | null } | null {
  const measurements = (mix.compressiveStrengthMeasurements ?? []).filter((measurement) => (
    Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
  ));
  if (measurements.length === 0) return null;
  const preferred = preferredAgeDays == null
    ? null
    : measurements.find((measurement) => measurement.ageDays === preferredAgeDays);
  const measurement = preferred ?? measurements[0];
  return measurement ? { valueMpa: measurement.valueMpa, ageDays: measurement.ageDays } : null;
}

function projectQuantities(concreteVolumeM3: number): QuantityResult {
  return {
    concreteVolume: concreteVolumeM3,
    reinforcementWeight: 0,
    formworkArea: 0,
    excavationVolume: 0,
    backfillVolume: 0,
    concreteVolumePerMeter: concreteVolumeM3,
    reinforcementWeightPerMeter: 0,
    formworkAreaPerMeter: 0,
    excavationVolumePerMeter: 0,
    backfillVolumePerMeter: 0,
    wallLength: 1,
  };
}

export function getOptimizationCatalogMix(id: string | null | undefined): OptimizationCatalogMix | null {
  return MIXES.find((item) => item.id === id) ?? null;
}

export function getOptimizationScenario(id: string | null | undefined): OptimizationScenarioDefinition {
  const scenario = OPTIMIZATION_SCENARIOS.find((item) => item.id === id)
    ?? OPTIMIZATION_SCENARIOS.find((item) => item.referenceMixId === id)
    ?? OPTIMIZATION_SCENARIOS.find((item) => item.id === DEFAULT_OPTIMIZATION_SCENARIO_ID);
  if (!scenario) throw new Error('Varsayılan optimizasyon senaryosu bulunamadı.');
  return scenario;
}

export function createCatalogConcreteMix(
  definitionOrId: OptimizationCatalogMix | string,
  template: ConcreteMixDesign,
): ConcreteMixDesign {
  const definition = typeof definitionOrId === 'string' ? getOptimizationCatalogMix(definitionOrId) : definitionOrId;
  if (!definition) throw new Error(`Bilinmeyen optimizasyon reçetesi: ${definitionOrId}`);
  const base = createDefaultConcreteMix(template.targetConcreteClass);
  const materials: MaterialInput[] = base.materials.map((item) => {
    const value = definition.amountsKgM3[item.id] ?? 0;
    return {
      ...item,
      enabled: value > 0,
      value,
      unit: 'kg/m³',
      basis: 'amount',
      rawValue: value,
      rawUnit: 'kg/m³',
      canonicalKgPerM3: value,
      percentage: null,
      price: template.prices?.[item.id] ?? item.price ?? null,
      emissionFactor: template.emissionFactors?.[item.id] ?? item.emissionFactor ?? null,
    };
  });
  return normalizeConcreteMix({
    ...base,
    id: definition.id,
    name: `${template.targetConcreteClass} hedef · ${definition.name}`,
    materialSystem: definition.materialSystem,
    targetConcreteClass: template.targetConcreteClass,
    targetSlumpClass: template.targetSlumpClass,
    targetStrength7DaysMpa: template.targetStrength7DaysMpa,
    targetStrength28DaysMpa: template.targetStrength28DaysMpa,
    targetLongTermAgeDays: template.targetLongTermAgeDays,
    targetLongTermStrengthMpa: template.targetLongTermStrengthMpa,
    targetAirContentPercent: null,
    materials,
    compressiveStrengthMeasurements: [{
      ageDays: definition.measuredStrengthAgeDays,
      valueMpa: definition.measuredStrengthMpa,
      source: TEKNOFEST_DATASET_LABEL,
      sourceRow: definition.sourceRow,
      notes: definition.measuredStrengthAgeDays == null
        ? 'Ölçülmüş veri; deney yaşı kaynakta belirtilmediği için yaş bilinmiyor. Yazılımsal tahmin değildir.'
        : `${definition.measuredStrengthAgeDays} günlük ölçülmüş veri; yazılımsal tahmin değildir.`,
    }],
    literature: null,
    prices: template.prices ?? {},
    emissionFactors: template.emissionFactors ?? {},
    priceMode: template.priceMode,
    readyMixPrice: template.readyMixPrice ?? null,
    referenceMixId: template.referenceMixId,
    notes: `${TEKNOFEST_DATASET_LABEL}, satır ${definition.sourceRow}. ${definition.measuredStrengthAgeDays == null ? 'Deney yaşı kaynakta belirtilmemiştir.' : `Deney yaşı: ${definition.measuredStrengthAgeDays} gün.`}`,
  });
}

export function findExactOptimizationCatalogMatch(
  mix: ConcreteMixDesign,
  projectConcreteVolumeM3?: number | null,
): OptimizationCatalogMix | null {
  const normalized = normalizeConcreteMix(mix, { projectConcreteVolumeM3 });
  return MIXES.find((definition) => {
    if (definition.materialSystem !== normalized.materialSystem) return false;
    return normalized.materials.every((item) => {
      const actual = item.enabled ? item.canonicalKgPerM3 : 0;
      if (actual == null) return false;
      const expected = definition.amountsKgM3[item.id] ?? 0;
      return Math.abs(actual - expected) <= MATERIAL_TOLERANCE_KG_M3;
    });
  }) ?? null;
}

export function calculateMixCarbonKgM3(
  mix: ConcreteMixDesign,
  customCoefficients?: Map<string, number>,
  sourceProjectVolumeM3 = 1,
): MixCarbonResult {
  const normalized = normalizeConcreteMix(mix, { projectConcreteVolumeM3: sourceProjectVolumeM3 });
  const canonicalMix = normalizeConcreteMix({
    ...normalized,
    materials: normalized.materials.map((item) => {
      const canonicalKgPerM3 = item.canonicalKgPerM3 ?? null;
      return {
        ...item,
        value: canonicalKgPerM3,
        unit: 'kg/m³',
        basis: 'amount',
        rawValue: canonicalKgPerM3,
        rawUnit: 'kg/m³',
      };
    }),
  }, { projectConcreteVolumeM3: 1 });
  const result = calculateMaterialsEmissions({
    quantities: projectQuantities(1),
    concreteClass: mix.targetConcreteClass,
    concreteMix: canonicalMix,
    customCoefficients,
  });
  return {
    kgCo2eM3: result.totalEmission,
    knownKgCo2eM3: result.knownSubtotal,
    dataComplete: result.dataComplete,
    missingFactors: result.missingFactors,
    missingAmounts: result.missingAmounts,
  };
}

function compareValues(
  referenceMix: ConcreteMixDesign,
  candidateMix: ConcreteMixDesign,
  referenceStrengthMpa: number | null,
  candidateStrengthMpa: number | null,
  concreteVolumeM3: number,
  customCoefficients?: Map<string, number>,
  candidateSourceVolumeM3 = 1,
  referenceSourceVolumeM3 = 1,
) {
  const normalizedReference = normalizeConcreteMix(referenceMix, { projectConcreteVolumeM3: referenceSourceVolumeM3 });
  const referenceMetrics = calculateMixMetrics(normalizedReference, referenceSourceVolumeM3);
  const normalizedCandidate = normalizeConcreteMix(candidateMix, { projectConcreteVolumeM3: candidateSourceVolumeM3 });
  const candidateMetrics = calculateMixMetrics(normalizedCandidate, candidateSourceVolumeM3);
  const referenceCarbon = calculateMixCarbonKgM3(referenceMix, customCoefficients, referenceSourceVolumeM3);
  const candidateCarbon = calculateMixCarbonKgM3(candidateMix, customCoefficients, candidateSourceVolumeM3);
  const carbonSavingKgM3 = referenceCarbon.kgCo2eM3 == null || candidateCarbon.kgCo2eM3 == null
    ? null
    : referenceCarbon.kgCo2eM3 - candidateCarbon.kgCo2eM3;
  const referenceCement = amount(normalizedReference, 'cement');
  const candidateCement = amount(normalizedCandidate, 'cement');
  const cementReductionKgM3 = referenceCement - candidateCement;
  const scmIncreaseKgM3 = referenceMetrics.totalScmKgM3 == null || candidateMetrics.totalScmKgM3 == null
    ? null
    : candidateMetrics.totalScmKgM3 - referenceMetrics.totalScmKgM3;
  const recycledAggregateIncreaseKgM3 = referenceMetrics.totalRecycledAggregateKgM3 == null || candidateMetrics.totalRecycledAggregateKgM3 == null
    ? null
    : candidateMetrics.totalRecycledAggregateKgM3 - referenceMetrics.totalRecycledAggregateKgM3;
  return {
    referenceMetrics,
    candidateMetrics,
    referenceCarbon,
    candidateCarbon,
    carbonSavingKgM3,
    carbonSavingPercent: carbonSavingKgM3 == null || referenceCarbon.kgCo2eM3 == null
      ? null
      : percentDifference(carbonSavingKgM3, referenceCarbon.kgCo2eM3),
    projectCarbonSavingKg: carbonSavingKgM3 == null ? null : carbonSavingKgM3 * concreteVolumeM3,
    cementReductionKgM3,
    cementReductionPercent: percentDifference(cementReductionKgM3, referenceCement),
    scmIncreaseKgM3,
    recycledAggregateIncreaseKgM3,
    referenceCementKgM3: referenceCement,
    candidateCementKgM3: candidateCement,
    measuredStrengthDeltaMpa: referenceStrengthMpa == null || candidateStrengthMpa == null
      ? null
      : candidateStrengthMpa - referenceStrengthMpa,
  };
}

export function evaluateOptimizationScenario(
  scenarioOrId: OptimizationScenarioDefinition | string | null | undefined,
  template: ConcreteMixDesign,
  concreteVolumeM3: number,
  customCoefficients?: Map<string, number>,
): OptimizationComparison {
  const scenario = typeof scenarioOrId === 'object' && scenarioOrId
    ? scenarioOrId
    : getOptimizationScenario(scenarioOrId);
  const referenceDefinition = getOptimizationCatalogMix(scenario.referenceMixId);
  const candidateDefinition = getOptimizationCatalogMix(scenario.candidateMixId);
  if (!referenceDefinition || !candidateDefinition) throw new Error('Optimizasyon senaryosu reçeteleri bulunamadı.');
  const referenceMix = createCatalogConcreteMix(referenceDefinition, { ...template, referenceMixId: scenario.referenceMixId });
  const candidateMix = createCatalogConcreteMix(candidateDefinition, { ...template, referenceMixId: scenario.referenceMixId });
  const compared = compareValues(
    referenceMix,
    candidateMix,
    referenceDefinition.measuredStrengthMpa,
    candidateDefinition.measuredStrengthMpa,
    concreteVolumeM3,
    customCoefficients,
  );
  const status = !compared.referenceCarbon.dataComplete || !compared.candidateCarbon.dataComplete
    ? 'incomplete'
    : (compared.measuredStrengthDeltaMpa ?? -Infinity) >= 0
      ? 'recommended'
      : 'tradeoff';
  return {
    scenario,
    referenceDefinition,
    candidateDefinition,
    referenceMix,
    candidateMix,
    ...compared,
    measuredStrengthDeltaMpa: compared.measuredStrengthDeltaMpa ?? 0,
    status,
  };
}

export function evaluateActiveAgainstReference(
  activeMix: ConcreteMixDesign,
  scenarioOrId: OptimizationScenarioDefinition | string | null | undefined,
  concreteVolumeM3: number,
  customCoefficients?: Map<string, number>,
): ActiveReferenceComparison {
  const scenario = typeof scenarioOrId === 'object' && scenarioOrId
    ? scenarioOrId
    : getOptimizationScenario(scenarioOrId);
  const referenceDefinition = getOptimizationCatalogMix(scenario.referenceMixId);
  if (!referenceDefinition) throw new Error('Referans reçetesi bulunamadı.');
  const referenceMix = createCatalogConcreteMix(referenceDefinition, { ...activeMix, referenceMixId: scenario.referenceMixId });
  const matchedActiveDefinition = findExactOptimizationCatalogMatch(activeMix, concreteVolumeM3);
  const compared = compareValues(
    referenceMix,
    activeMix,
    referenceDefinition.measuredStrengthMpa,
    matchedActiveDefinition?.measuredStrengthMpa ?? null,
    concreteVolumeM3,
    customCoefficients,
    concreteVolumeM3,
  );
  const measuredStrengthDeltaMpa = compared.measuredStrengthDeltaMpa;
  const status = !compared.referenceCarbon.dataComplete || !compared.candidateCarbon.dataComplete
    ? 'incomplete'
    : !matchedActiveDefinition
      ? 'unverified'
      : (measuredStrengthDeltaMpa ?? -Infinity) >= 0
        ? 'evidence-positive'
        : 'tradeoff';
  return {
    scenario,
    referenceDefinition,
    matchedActiveDefinition,
    referenceMix,
    referenceMetrics: compared.referenceMetrics,
    activeMetrics: compared.candidateMetrics,
    referenceCarbon: compared.referenceCarbon,
    activeCarbon: compared.candidateCarbon,
    carbonSavingKgM3: compared.carbonSavingKgM3,
    carbonSavingPercent: compared.carbonSavingPercent,
    projectCarbonSavingKg: compared.projectCarbonSavingKg,
    cementReductionKgM3: compared.cementReductionKgM3,
    cementReductionPercent: compared.cementReductionPercent,
    scmIncreaseKgM3: compared.scmIncreaseKgM3,
    recycledAggregateIncreaseKgM3: compared.recycledAggregateIncreaseKgM3,
    measuredStrengthMpa: matchedActiveDefinition?.measuredStrengthMpa ?? null,
    measuredStrengthDeltaMpa,
    exactDatasetMatch: matchedActiveDefinition != null,
    status,
  };
}

export function evaluateSelectedConcreteAgainstCandidate(
  selectedMix: ConcreteMixDesign,
  scenarioOrId: OptimizationScenarioDefinition | string | null | undefined,
  concreteVolumeM3: number,
  customCoefficients?: Map<string, number>,
): SelectedConcreteComparison {
  const scenario = typeof scenarioOrId === 'object' && scenarioOrId
    ? scenarioOrId
    : getOptimizationScenario(scenarioOrId);
  const candidateDefinition = getOptimizationCatalogMix(scenario.candidateMixId);
  if (!candidateDefinition) throw new Error('Katkılı alternatif reçetesi bulunamadı.');

  const candidateMix = createCatalogConcreteMix(candidateDefinition, {
    ...selectedMix,
    referenceMixId: scenario.referenceMixId,
  });
  const referenceDefinition = findExactOptimizationCatalogMatch(selectedMix, concreteVolumeM3);
  const referenceMeasurement = comparisonMeasurement(selectedMix, candidateDefinition.measuredStrengthAgeDays);
  const referenceStrengthIsComparable = selectedMix.compressiveStrengthVerification !== 'unverified'
    && referenceMeasurement != null
    && referenceMeasurement.ageDays === candidateDefinition.measuredStrengthAgeDays;
  const compared = compareValues(
    selectedMix,
    candidateMix,
    referenceStrengthIsComparable ? referenceMeasurement?.valueMpa ?? null : null,
    candidateDefinition.measuredStrengthMpa,
    concreteVolumeM3,
    customCoefficients,
    1,
    concreteVolumeM3,
  );
  const exactDatasetMatch = referenceDefinition?.id === scenario.referenceMixId
    || referenceDefinition?.id === scenario.candidateMixId;
  const status = !compared.referenceCarbon.dataComplete || !compared.candidateCarbon.dataComplete
    ? 'incomplete'
    : !exactDatasetMatch || compared.measuredStrengthDeltaMpa == null
      ? 'unverified'
      : compared.measuredStrengthDeltaMpa >= 0
        ? 'evidence-positive'
        : 'tradeoff';

  return {
    scenario,
    referenceDefinition,
    candidateDefinition,
    referenceMix: selectedMix,
    candidateMix,
    referenceMetrics: compared.referenceMetrics,
    candidateMetrics: compared.candidateMetrics,
    referenceCarbon: compared.referenceCarbon,
    candidateCarbon: compared.candidateCarbon,
    referenceCementKgM3: compared.referenceCementKgM3,
    candidateCementKgM3: compared.candidateCementKgM3,
    carbonSavingKgM3: compared.carbonSavingKgM3,
    carbonSavingPercent: compared.carbonSavingPercent,
    projectCarbonSavingKg: compared.projectCarbonSavingKg,
    cementReductionKgM3: compared.cementReductionKgM3,
    cementReductionPercent: compared.cementReductionPercent,
    scmIncreaseKgM3: compared.scmIncreaseKgM3,
    recycledAggregateIncreaseKgM3: compared.recycledAggregateIncreaseKgM3,
    referenceMeasuredStrengthMpa: referenceMeasurement?.valueMpa ?? null,
    referenceMeasuredStrengthAgeDays: referenceMeasurement?.ageDays ?? null,
    candidateMeasuredStrengthMpa: candidateDefinition.measuredStrengthMpa,
    candidateMeasuredStrengthAgeDays: candidateDefinition.measuredStrengthAgeDays,
    measuredStrengthDeltaMpa: compared.measuredStrengthDeltaMpa,
    exactDatasetMatch,
    status,
  };
}

