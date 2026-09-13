import type { ConcreteClass, Scenario } from '@/retaining-wall/types';
import { calculateMixMetrics, normalizeConcreteMix } from './mixModel';
import { getStructFlowCharacteristicStrengthMpa } from './referenceConcreteProfiles';
import {
  calculateMixCarbonKgM3,
  evaluateActiveAgainstReference,
  getOptimizationCatalogMix,
  OPTIMIZATION_SCENARIOS,
  type MixCarbonResult,
  type OptimizationScenarioDefinition,
} from './optimization';
import { resolveCircularityOrigin } from './materialCatalog';
import type { CircularityOrigin, ConcreteMixDesign, MaterialInput, MixMetrics } from './types';

export type ZeroWastePerformanceStatus = 'preserved' | 'loss' | 'incomplete';

export interface ZeroWasteMaterialBreakdownItem {
  id: string;
  name: string;
  category: MaterialInput['category'];
  circularityOrigin: CircularityOrigin;
  kgM3: number;
  projectTon: number | null;
}

export interface ZeroWasteMaterialImpactItem {
  id: string;
  name: string;
  category: MaterialInput['category'];
  circularityOrigin: CircularityOrigin;
  recipeAmountKgM3: number | null;
  accountingAmountKgM3: number | null;
  projectAmountTon: number | null;
  factorKgCo2ePerKg: number | null;
  emissionKgCo2eM3: number | null;
  projectEmissionTon: number | null;
  factorSource: string | null;
  factorNotes: string | null;
}

export interface ZeroWasteMixTotals {
  recoveredMaterialKgM3: number | null;
  recoveredMaterialProjectTon: number | null;
  circularAlternativeMaterialKgM3: number | null;
  circularAlternativeMaterialProjectTon: number | null;
  cementKgM3: number | null;
  cementProjectTon: number | null;
  naturalAggregateKgM3: number | null;
  naturalAggregateProjectTon: number | null;
  recipeCarbonKgM3: number | null;
  recipeCarbonProjectTon: number | null;
  knownRecipeCarbonKgM3: number | null;
  knownRecipeCarbonProjectTon: number | null;
  carbonDataComplete: boolean;
}

export interface ZeroWasteStrengthResult {
  referenceMpa: number | null;
  activeMpa: number | null;
  referenceAgeDays: number | null;
  activeAgeDays: number | null;
  targetConcreteClass: ConcreteClass;
  targetStrengthMpa: number | null;
  targetSatisfied: boolean | null;
  comparableAge: boolean;
  activeMeasurementVerified: boolean;
  status: ZeroWastePerformanceStatus;
}

export interface ZeroWasteImpactResult {
  concreteVolumeM3: number | null;
  wallLengthM: number | null;
  referenceAvailable: boolean;
  referenceMixId: string | null;
  referenceMixName: string | null;
  activeMixName: string;
  activeRecipeMode: NonNullable<ConcreteMixDesign['recipeMode']>;
  reference: ZeroWasteMixTotals;
  active: ZeroWasteMixTotals;
  savings: {
    recoveredMaterialTon: number | null;
    cementTon: number | null;
    naturalAggregateTon: number | null;
    carbonTon: number | null;
    carbonPercent: number | null;
  };
  recoveredBreakdown: ZeroWasteMaterialBreakdownItem[];
  referenceRecoveredBreakdown: ZeroWasteMaterialBreakdownItem[];
  activeMaterialImpacts: ZeroWasteMaterialImpactItem[];
  strength: ZeroWasteStrengthResult;
  warnings: string[];
}

const RECOVERED_ORIGINS = new Set<CircularityOrigin>([
  'industrial_byproduct',
  'recycled_waste',
  'secondary_material',
]);

const CIRCULAR_ALTERNATIVE_ORIGINS = new Set<CircularityOrigin>([
  ...RECOVERED_ORIGINS,
  'alternative_mineral',
]);

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function projectTon(kgM3: number | null, volumeM3: number | null): number | null {
  return kgM3 == null || volumeM3 == null ? null : kgM3 * volumeM3 / 1000;
}

function findReferenceScenario(referenceMixId: string | null | undefined): OptimizationScenarioDefinition | null {
  const id = referenceMixId?.trim();
  if (!id) return null;
  return OPTIMIZATION_SCENARIOS.find((scenario) => scenario.id === id || scenario.referenceMixId === id) ?? null;
}

function materialAmount(material: MaterialInput | undefined): number | null {
  if (!material) return null;
  if (!material.enabled) return 0;
  return finite(material.canonicalKgPerM3);
}

function recoveredBreakdown(
  mix: ConcreteMixDesign,
  volumeM3: number | null,
  sourceLabel: 'aktif' | 'referans',
): {
  kgM3: number | null;
  projectTon: number | null;
  circularAlternativeKgM3: number | null;
  circularAlternativeProjectTon: number | null;
  breakdown: ZeroWasteMaterialBreakdownItem[];
  warnings: string[];
} {
  const normalized = normalizeConcreteMix(mix, { projectConcreteVolumeM3: volumeM3 });
  const breakdown: ZeroWasteMaterialBreakdownItem[] = [];
  const warnings: string[] = [];
  const unknownMaterials: string[] = [];
  let totalKgM3 = 0;
  let circularAlternativeKgM3 = 0;
  let hasMissingRecoveredAmount = false;
  let hasMissingCircularAlternativeAmount = false;

  normalized.materials
    .filter((material) => material.enabled)
    .forEach((material) => {
      const amountKgM3 = materialAmount(material);
      const origin = resolveCircularityOrigin(material);
      if (origin === 'unknown' && (amountKgM3 == null || amountKgM3 > 0)) {
        unknownMaterials.push(material.name);
      }
      if (CIRCULAR_ALTERNATIVE_ORIGINS.has(origin) && amountKgM3 !== 0) {
        if (amountKgM3 == null) hasMissingCircularAlternativeAmount = true;
        else circularAlternativeKgM3 += amountKgM3;
      }
      if (!RECOVERED_ORIGINS.has(origin) || amountKgM3 === 0) return;
      if (amountKgM3 == null) {
        hasMissingRecoveredAmount = true;
        return;
      }
      totalKgM3 += amountKgM3;
      breakdown.push({
        id: material.id,
        name: material.name,
        category: material.category,
        circularityOrigin: origin,
        kgM3: amountKgM3,
        projectTon: projectTon(amountKgM3, volumeM3),
      });
    });

  if (unknownMaterials.length > 0) {
    warnings.push(`${sourceLabel === 'aktif' ? 'Aktif reçetede ' : 'Referans reçetede '}${unknownMaterials.length} malzemenin döngüsellik sınıfı bilinmiyor; geri kazanım toplamına dahil edilmedi.`);
  }
  if (hasMissingRecoveredAmount) {
    warnings.push(`${sourceLabel === 'aktif' ? 'Aktif' : 'Referans'} reçetedeki geri kazanılabilir malzeme miktarı eksik; geri kazanım toplamı tamamlanamadı.`);
  }

  const kgM3 = hasMissingRecoveredAmount ? null : totalKgM3;
  const circularKgM3 = hasMissingCircularAlternativeAmount ? null : circularAlternativeKgM3;
  return {
    kgM3,
    projectTon: projectTon(kgM3, volumeM3),
    circularAlternativeKgM3: circularKgM3,
    circularAlternativeProjectTon: projectTon(circularKgM3, volumeM3),
    breakdown,
    warnings,
  };
}

function mixTotals(
  metrics: MixMetrics,
  carbon: MixCarbonResult,
  recoveredKgM3: number | null,
  circularAlternativeKgM3: number | null,
  volumeM3: number | null,
): ZeroWasteMixTotals {
  const cementKgM3 = materialAmount(metrics.materials.find((material) => material.id === 'cement'));
  const naturalAggregateKgM3 = metrics.totalNaturalAggregateKgM3;
  return {
    recoveredMaterialKgM3: recoveredKgM3,
    recoveredMaterialProjectTon: projectTon(recoveredKgM3, volumeM3),
    circularAlternativeMaterialKgM3: circularAlternativeKgM3,
    circularAlternativeMaterialProjectTon: projectTon(circularAlternativeKgM3, volumeM3),
    cementKgM3,
    cementProjectTon: projectTon(cementKgM3, volumeM3),
    naturalAggregateKgM3,
    naturalAggregateProjectTon: projectTon(naturalAggregateKgM3, volumeM3),
    recipeCarbonKgM3: carbon.kgCo2eM3,
    recipeCarbonProjectTon: projectTon(carbon.kgCo2eM3, volumeM3),
    knownRecipeCarbonKgM3: carbon.knownKgCo2eM3,
    knownRecipeCarbonProjectTon: projectTon(carbon.knownKgCo2eM3, volumeM3),
    carbonDataComplete: carbon.dataComplete,
  };
}

function difference(active: number | null, reference: number | null): number | null {
  return active == null || reference == null ? null : active - reference;
}

function findMeasurement(mix: ConcreteMixDesign, ageDays: number | null | undefined) {
  const measurements = (mix.compressiveStrengthMeasurements ?? []).filter((measurement) => (
    Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
  ));
  if (measurements.length === 0) return null;
  if (ageDays != null) {
    const sameAge = measurements.find((measurement) => measurement.ageDays === ageDays);
    if (sameAge) return sameAge;
  }
  return measurements[0] ?? null;
}

function strengthResult(
  activeMix: ConcreteMixDesign,
  referenceMix: ConcreteMixDesign | null,
  targetConcreteClass: ConcreteClass,
): ZeroWasteStrengthResult {
  const referenceMeasurement = referenceMix ? findMeasurement(referenceMix, null) : null;
  const activeMeasurement = findMeasurement(activeMix, referenceMeasurement?.ageDays ?? null);
  const referenceAgeDays = referenceMeasurement?.ageDays ?? null;
  const activeAgeDays = activeMeasurement?.ageDays ?? null;
  const comparableAge = referenceMeasurement != null
    && activeMeasurement != null
    && referenceAgeDays != null
    && activeAgeDays != null
    && referenceAgeDays === activeAgeDays;
  const targetStrengthMpa = getStructFlowCharacteristicStrengthMpa(targetConcreteClass);
  const targetSatisfied = activeMeasurement == null
    ? null
    : activeMeasurement.valueMpa >= targetStrengthMpa;
  const activeMeasurementVerified = activeMix.compressiveStrengthVerification !== 'unverified';
  const complete = referenceMeasurement != null
    && activeMeasurement != null
    && comparableAge
    && activeMeasurementVerified
    && targetSatisfied === true;
  const preserved = complete
    && activeMeasurement != null
    && referenceMeasurement != null
    && activeMeasurement.valueMpa >= referenceMeasurement.valueMpa;
  return {
    referenceMpa: referenceMeasurement?.valueMpa ?? null,
    activeMpa: activeMeasurement?.valueMpa ?? null,
    referenceAgeDays,
    activeAgeDays,
    targetConcreteClass,
    targetStrengthMpa,
    targetSatisfied,
    comparableAge,
    activeMeasurementVerified,
    status: !referenceMeasurement || !activeMeasurement || !comparableAge || !activeMeasurementVerified
      ? 'incomplete'
      : preserved
        ? 'preserved'
        : 'loss',
  };
}

function addCarbonWarnings(warnings: string[], label: string, carbon: MixCarbonResult): void {
  if (carbon.missingFactors.length > 0) {
    warnings.push(`${label} CO₂ karşılaştırması için emisyon faktörleri eksik.`);
  }
  if (carbon.missingAmounts.length > 0) {
    warnings.push(`${label} reçetede malzeme miktarı eksik; CO₂ karşılaştırması tamamlanamadı.`);
  }
  if (!carbon.dataComplete && carbon.missingFactors.length === 0 && carbon.missingAmounts.length === 0) {
    warnings.push(`${label} CO₂ karşılaştırması tamamlanamadı.`);
  }
}

/**
 * Converts the existing normalized recipe, quantity and emission results into
 * Zero Waste KPIs. It deliberately does not calculate site, logistics or
 * reinforcement emissions and never turns missing data into zero.
 */
export function calculateZeroWasteImpact(scenario: Scenario): ZeroWasteImpactResult {
  const volumeM3 = finite(scenario.quantities?.concreteVolume);
  const wallLengthM = finite(scenario.input.geometry.L);
  const activeMix = normalizeConcreteMix(scenario.concreteMix, { projectConcreteVolumeM3: volumeM3 });
  const activeMetrics = scenario.mixMetrics ?? calculateMixMetrics(activeMix, volumeM3);
  const customCoefficients = new Map(Object.entries(scenario.customCoefficients ?? {}));
  const activeCarbon = calculateMixCarbonKgM3(activeMix, customCoefficients, 1);
  const activeRecovered = recoveredBreakdown(activeMix, volumeM3, 'aktif');
  const referenceScenario = findReferenceScenario(activeMix.referenceMixId);
  const activeEmissionById = new Map(
    (scenario.emissions?.materials.byMaterial ?? [])
      .filter((item) => item.id !== 'reinforcement_steel')
      .map((item) => [item.id, item]),
  );
  const activeMaterialImpacts: ZeroWasteMaterialImpactItem[] = activeMetrics.materials
    .filter((material) => material.enabled && ((material.canonicalKgPerM3 ?? 0) > 0 || activeEmissionById.has(material.id)))
    .map((material) => {
      const emission = activeEmissionById.get(material.id);
      const recipeAmountKgM3 = finite(material.canonicalKgPerM3);
      const factorKgCo2ePerKg = emission?.factorKgCo2ePerKg ?? null;
      const accountingAmountKgM3 = emission?.amountKgM3 ?? recipeAmountKgM3;
      const emissionKgCo2eM3 = emission?.emissionKgCo2eM3 ?? null;
      return {
        id: material.id,
        name: material.name,
        category: material.category,
        circularityOrigin: resolveCircularityOrigin(material),
        recipeAmountKgM3,
        accountingAmountKgM3,
        projectAmountTon: projectTon(recipeAmountKgM3, volumeM3),
        factorKgCo2ePerKg,
        emissionKgCo2eM3,
        projectEmissionTon: projectTon(emissionKgCo2eM3, volumeM3),
        factorSource: emission?.source ?? null,
        factorNotes: emission?.factorNotes ?? null,
      };
    });

  const warnings: string[] = [
    ...activeRecovered.warnings,
    ...(activeMetrics.warnings ?? []),
  ];
  const missingFactorItems = activeMaterialImpacts.filter((item) => (
    (item.recipeAmountKgM3 ?? 0) > 0
    && item.factorKgCo2ePerKg == null
  ));
  if (missingFactorItems.length > 0) {
    warnings.push(`${missingFactorItems.map((item) => item.name).join(', ')} için emisyon faktörü eksik; kesin reçete CO₂ toplamı yerine bilinen alt toplam gösteriliyor.`);
  }
  if (volumeM3 == null || volumeM3 < 0) warnings.push('Beton hacmi eksik; proje toplamları hesaplanamadı.');
  if (wallLengthM == null || wallLengthM <= 0) warnings.push('Duvar uzunluğu eksik; proje geometrisi doğrulanamadı.');
  addCarbonWarnings(warnings, 'Aktif reçete', activeCarbon);

  let reference: ZeroWasteMixTotals = {
    recoveredMaterialKgM3: null,
    recoveredMaterialProjectTon: null,
    circularAlternativeMaterialKgM3: null,
    circularAlternativeMaterialProjectTon: null,
    cementKgM3: null,
    cementProjectTon: null,
    naturalAggregateKgM3: null,
    naturalAggregateProjectTon: null,
    recipeCarbonKgM3: null,
    recipeCarbonProjectTon: null,
    knownRecipeCarbonKgM3: null,
    knownRecipeCarbonProjectTon: null,
    carbonDataComplete: false,
  };
  let referenceRecoveredBreakdown: ZeroWasteMaterialBreakdownItem[] = [];
  let referenceMixName: string | null = null;
  let strength = strengthResult(activeMix, null, scenario.input.concreteClass);

  if (!referenceScenario) {
    warnings.push('Aktif reçete hesaplandı; karşılaştırmalı Sıfır Atık kazancı için referans reçete seçilmedi.');
  } else {
    const referenceCatalog = getOptimizationCatalogMix(referenceScenario.referenceMixId);
    if (!referenceCatalog) {
      warnings.push('Seçili referans reçete çözümlenemedi; karşılaştırmalı analiz yapılamaz.');
    } else {
      const comparison = evaluateActiveAgainstReference(
        activeMix,
        referenceScenario,
        volumeM3 ?? 1,
        customCoefficients,
      );
      const referenceRecovered = recoveredBreakdown(comparison.referenceMix, volumeM3, 'referans');
      referenceRecoveredBreakdown = referenceRecovered.breakdown;
      referenceMixName = comparison.referenceDefinition.name;
      reference = mixTotals(
        comparison.referenceMetrics,
        comparison.referenceCarbon,
        referenceRecovered.kgM3,
        referenceRecovered.circularAlternativeKgM3,
        volumeM3,
      );
      strength = strengthResult(activeMix, comparison.referenceMix, scenario.input.concreteClass);
      warnings.push(...referenceRecovered.warnings);
      addCarbonWarnings(warnings, 'Referans reçete', comparison.referenceCarbon);
      addCarbonWarnings(warnings, 'Aktif reçete', comparison.activeCarbon);
      if (comparison.referenceCarbon.kgCo2eM3 == null || comparison.activeCarbon.kgCo2eM3 == null) {
        warnings.push('CO₂ karşılaştırması tamamlanamadı; eksik emisyon faktörü veya miktar 0 kabul edilmedi.');
      }
    }
  }

  if (strength.referenceAgeDays == null && strength.referenceMpa != null) {
    warnings.push('Referans deney yaşı belirtilmemiş; 28 gün varsayılmadı.');
  }
  if (strength.activeAgeDays == null && strength.activeMpa != null) {
    warnings.push('Aktif deney yaşı belirtilmemiş; 28 gün varsayılmadı.');
  }
  if (strength.activeMpa == null) warnings.push('Aktif reçete için deneysel basınç dayanımı bulunmuyor.');
  if (strength.activeMpa != null && !strength.activeMeasurementVerified) {
    warnings.push('Aktif reçetedeki dayanım ölçümü reçete değişikliği sonrası doğrulanmamış durumda.');
  }
  if (strength.referenceMpa == null && referenceScenario) warnings.push('Referans reçete için deneysel basınç dayanımı bulunmuyor.');

  const active = mixTotals(
    activeMetrics,
    activeCarbon,
    activeRecovered.kgM3,
    activeRecovered.circularAlternativeKgM3,
    volumeM3,
  );
  const carbonTon = difference(active.recipeCarbonProjectTon, reference.recipeCarbonProjectTon);
  const carbonKgM3 = difference(active.recipeCarbonKgM3, reference.recipeCarbonKgM3);
  const referenceCarbonKgM3 = reference.recipeCarbonKgM3;
  const recoveredMaterialTon = difference(active.recoveredMaterialProjectTon, reference.recoveredMaterialProjectTon);
  const cementTon = difference(active.cementProjectTon, reference.cementProjectTon);
  const naturalAggregateTon = difference(active.naturalAggregateProjectTon, reference.naturalAggregateProjectTon);
  const carbonPercent = carbonKgM3 == null || referenceCarbonKgM3 == null || referenceCarbonKgM3 <= 0
    ? null
    : carbonKgM3 / referenceCarbonKgM3 * 100;

  return {
    concreteVolumeM3: volumeM3,
    wallLengthM,
    referenceAvailable: referenceScenario != null && referenceMixName != null,
    referenceMixId: referenceScenario?.referenceMixId ?? null,
    referenceMixName,
    activeMixName: activeMix.name,
    activeRecipeMode: activeMix.recipeMode ?? 'custom',
    reference,
    active,
    savings: {
      recoveredMaterialTon,
      cementTon: cementTon == null ? null : -cementTon,
      naturalAggregateTon: naturalAggregateTon == null ? null : -naturalAggregateTon,
      carbonTon: carbonTon == null ? null : -carbonTon,
      carbonPercent: carbonPercent == null ? null : -carbonPercent,
    },
    recoveredBreakdown: activeRecovered.breakdown,
    referenceRecoveredBreakdown,
    activeMaterialImpacts,
    strength,
    warnings: [...new Set(warnings.filter((warning) => warning.trim().length > 0))],
  };
}
