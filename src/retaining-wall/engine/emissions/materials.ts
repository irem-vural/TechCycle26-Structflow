import {
  getCoefficientValue,
  getMaterialEmissionCoefficient,
  MATERIAL_EMISSION_COEFFICIENT_KEYS,
} from '../../coefficients/defaults';
import { calculateMixMetrics } from '../../material-selection/mixModel';
import type { ConcreteMixDesign } from '../../material-selection/types';
import { materialQuantityAccountingState } from '../../material-selection/units';
import type { ConcreteClass, EmissionResult, QuantityResult } from '../../types';

export interface MaterialsEmissionInput {
  quantities: QuantityResult;
  concreteClass: ConcreteClass;
  concreteMix?: ConcreteMixDesign;
  customCoefficients?: Map<string, number>;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface ResolvedEmissionFactor {
  value: number | null;
  source?: string | null;
  sourceUrl?: string | null;
  region?: string | null;
  year?: number | null;
  notes?: string | null;
}

function factorFor(
  mix: ConcreteMixDesign,
  material: { id: string; emissionFactor?: import('../../material-selection/types').EmissionFactor | null },
  customCoefficients: Map<string, number> | undefined,
): ResolvedEmissionFactor {
  const configured = mix.emissionFactors?.[material.id] ?? material.emissionFactor ?? undefined;
  const configuredValue = finite(configured?.value);
  if (configured && configuredValue != null) {
    return { ...configured, value: configuredValue };
  }

  // An explicitly maintained factor table is authoritative. If a material was
  // removed from that table, surface the missing-data warning instead of
  // silently replacing the user's active recipe data with a fallback.
  if (Object.keys(mix.emissionFactors ?? {}).length > 0) {
    return { value: null };
  }

  const coefficient = getMaterialEmissionCoefficient(material.id);
  const coefficientKey = MATERIAL_EMISSION_COEFFICIENT_KEYS[material.id];
  const customValue = coefficientKey ? finite(customCoefficients?.get(coefficientKey)) : null;
  if (customValue != null) {
    return {
      value: customValue,
      source: coefficient
        ? `Kullanıcı katsayısı · varsayılan kaynak: ${coefficient.source}`
        : 'Kullanıcı tanımlı emisyon katsayısı',
      sourceUrl: coefficient?.sourceUrl ?? null,
      region: coefficient?.region ?? null,
      year: coefficient?.year ?? null,
      notes: coefficient?.notes ?? null,
    };
  }
  if (!coefficient) return { value: null };
  return {
    value: coefficient.value,
    source: coefficient.source,
    sourceUrl: coefficient.sourceUrl ?? null,
    region: coefficient.region ?? null,
    year: coefficient.year ?? null,
    notes: coefficient.notes ?? null,
  };
}

/**
 * Material production emissions are driven by the active recipe. Missing
 * factors remain missing; the result is never made exact by treating them as
 * zero.
 */
export function calculateMaterialsEmissions(input: MaterialsEmissionInput): EmissionResult['materials'] {
  const { quantities, concreteMix, customCoefficients } = input;
  const projectVolume = quantities.concreteVolume;
  const mix = concreteMix;
  const byMaterial: EmissionResult['materials']['byMaterial'] = [];
  const missingFactors: string[] = [];
  const missingAmounts: string[] = [];

  if (mix) {
    const metrics = calculateMixMetrics(mix, projectVolume);
    const hasActiveActivator = metrics.materials.some((item) => {
      if (item.category !== 'activator') return false;
      const state = materialQuantityAccountingState(item);
      return state === 'resolved' || state === 'missing';
    });
    if (mix.materialSystem === 'geopolymer' && !hasActiveActivator) {
      missingAmounts.push('alkali_activator');
    }
    for (const material of metrics.materials) {
      const quantityState = materialQuantityAccountingState(material);
      if (quantityState === 'disabled' || quantityState === 'zero') continue;
      const amountKgM3 = quantityState === 'resolved' ? finite(material.canonicalKgPerM3) : null;
      const projectAmountKg = amountKgM3 == null ? null : amountKgM3 * projectVolume;
      const factor = factorFor(mix, material, customCoefficients);
      if (amountKgM3 == null) missingAmounts.push(material.id);
      if (amountKgM3 != null && amountKgM3 > 0 && factor.value == null) missingFactors.push(material.id);
      byMaterial.push({
        id: material.id,
        name: material.name,
        amountKgM3,
        projectAmountKg,
        factorKgCo2ePerKg: factor.value,
        factorRegion: factor.region ?? null,
        factorYear: factor.year ?? null,
        factorNotes: factor.notes ?? null,
        emissionKgCo2eM3: amountKgM3 == null ? null : amountKgM3 === 0 ? 0 : factor.value == null ? null : amountKgM3 * factor.value,
        emissionKgCo2eProject: projectAmountKg == null ? null : projectAmountKg === 0 ? 0 : factor.value == null ? null : projectAmountKg * factor.value,
        source: factor.source ?? null,
        sourceUrl: factor.sourceUrl ?? null,
      });
    }
  } else {
    // A legacy scenario without a concreteMix remains calculable only through
    // the old explicit user coefficient map. Do not silently synthesize a standard-class mix.
    missingAmounts.push('active_concrete_mix');
  }

  const steelCoefficient = getMaterialEmissionCoefficient('reinforcement_steel');
  const customSteelFactor = finite(customCoefficients?.get('EF_steel'));
  const steelFactor = customSteelFactor ?? finite(getCoefficientValue('EF_steel', customCoefficients));
  const steelAmountKg = quantities.reinforcementWeight * 1000;
  if (steelAmountKg > 0) {
    byMaterial.push({
      id: 'reinforcement_steel',
      name: 'Donatı çeliği',
      amountKgM3: projectVolume > 0 ? steelAmountKg / projectVolume : null,
      projectAmountKg: steelAmountKg,
      factorKgCo2ePerKg: steelFactor,
      factorRegion: steelCoefficient?.region ?? null,
      factorYear: steelCoefficient?.year ?? null,
      factorNotes: steelCoefficient?.notes ?? null,
      emissionKgCo2eM3: projectVolume > 0 && steelFactor != null ? steelAmountKg / projectVolume * steelFactor : null,
      emissionKgCo2eProject: steelFactor == null ? null : steelAmountKg * steelFactor,
      source: customSteelFactor != null
        ? `Kullanıcı katsayısı · varsayılan kaynak: ${steelCoefficient?.source ?? 'tanımsız'}`
        : steelCoefficient?.source ?? null,
      sourceUrl: steelCoefficient?.sourceUrl ?? null,
    });
    if (steelFactor == null) missingFactors.push('reinforcement_steel');
  }

  const total = byMaterial.reduce((sum, item) => sum + (item.emissionKgCo2eProject ?? 0), 0);
  const dataComplete = missingFactors.length === 0 && missingAmounts.length === 0;
  const concrete = (id: string): number | null => {
    const items = byMaterial.filter((item) => item.id === id);
    if (items.length === 0) return 0;
    return items.some((item) => item.emissionKgCo2eProject == null)
      ? null
      : items.reduce((sum, item) => sum + (item.emissionKgCo2eProject ?? 0), 0);
  };
  const groupEmission = (ids: Set<string>): number | null => {
    const items = byMaterial.filter((item) => ids.has(item.id));
    if (items.length === 0) return 0;
    return items.some((item) => item.emissionKgCo2eProject == null)
      ? null
      : items.reduce((sum, item) => sum + (item.emissionKgCo2eProject ?? 0), 0);
  };
  const aggregateIds = new Set(byMaterial.filter((item) => ['natural_fine_aggregate', 'natural_coarse_aggregate', 'recycled_aggregate_unspecified', 'recycled_fine_aggregate', 'recycled_coarse_aggregate', 'lightweight_aggregate', 'heavyweight_aggregate', 'custom_aggregate'].includes(item.id)).map((item) => item.id));
  const aggregate = groupEmission(aggregateIds);
  const coarseAggregate = groupEmission(new Set(['natural_coarse_aggregate', 'recycled_coarse_aggregate']));
  const fineAggregate = groupEmission(new Set(['natural_fine_aggregate', 'recycled_fine_aggregate']));
  const cement = concrete('cement');
  const steel = concrete('reinforcement_steel');
  const knownSubtotal = total;
  return {
    cement,
    aggregate,
    coarseAggregate,
    fineAggregate,
    steel,
    totalEmission: dataComplete ? total : null,
    knownSubtotal,
    byMaterial,
    missingFactors: [...new Set(missingFactors)],
    missingAmounts: [...new Set(missingAmounts)],
    dataComplete,
  };
}
